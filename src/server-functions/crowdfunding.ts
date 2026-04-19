// app/server-functions/crowdfunding.ts
// TanStack Start server functions for TruaraCrowdfund.
// These run on the Cloudflare edge and bridge client components to Supabase
// (direct DB operations) and to Supabase Edge Functions (AI work).
// Auth is forwarded via the Bearer token present in the incoming request.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

// ── helpers ───────────────────────────────────────────────────────────────────

function getSupabaseWithAuth() {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_KEY = (process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY)!;

  const request = getRequest();
  const authHeader = request?.headers?.get("authorization") ?? "";

  return createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function invokeEdgeFunction(name: string, body: Record<string, unknown>) {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization") ?? "";
  const SUPABASE_URL = process.env.SUPABASE_URL!;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      apikey: (process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY)!,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new Error(`Edge function ${name} failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<Record<string, unknown>>;
}

// ── runSwarmAnalysis ───────────────────────────────────────────────────────────
// Trigger a synthetic AI swarm run on the given campaign.
// Returns { runId, summary, insightCount } or { skipped: true } if throttled.

const runSwarmSchema = z.object({ campaignId: z.string().uuid() });

export const runSwarmAnalysis = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => runSwarmSchema.parse(data))
  .handler(async (ctx) => {
    const result = await invokeEdgeFunction("crowdfund-swarm", {
      campaignId: ctx.data.campaignId,
    });
    return result as { runId?: string; summary?: string; insightCount?: number; skipped?: boolean };
  });

// ── loadAgentState ────────────────────────────────────────────────────────────
// Load the latest checkpoint for a campaign's stateful agent (PostgresSaver pattern).

const loadStateSchema = z.object({ campaignId: z.string().uuid() });

export const loadAgentState = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => loadStateSchema.parse(data))
  .handler(async (ctx) => {
    const supabase = getSupabaseWithAuth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase as any)
      .from("campaign_agent_state")
      .select("*")
      .eq("campaign_id", ctx.data.campaignId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return row ?? null;
  });

// ── saveAgentCheckpoint ───────────────────────────────────────────────────────
// Upsert an agent checkpoint for a campaign (PostgresSaver-style write).

const saveCheckpointSchema = z.object({
  campaignId: z.string().uuid(),
  threadId: z.string().min(1),
  checkpoint: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
});

export const saveAgentCheckpoint = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => saveCheckpointSchema.parse(data))
  .handler(async (ctx) => {
    const supabase = getSupabaseWithAuth();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error("Unauthorized");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const { data: existing } = await sb
      .from("campaign_agent_state")
      .select("step_count")
      .eq("thread_id", ctx.data.threadId)
      .eq("campaign_id", ctx.data.campaignId)
      .maybeSingle();

    const nextStep = (existing?.step_count ?? 0) + 1;

    const { data: row, error } = await sb
      .from("campaign_agent_state")
      .upsert(
        {
          thread_id: ctx.data.threadId,
          campaign_id: ctx.data.campaignId,
          owner_id: user.id,
          checkpoint: ctx.data.checkpoint,
          metadata: ctx.data.metadata ?? {},
          step_count: nextStep,
        },
        { onConflict: "thread_id,campaign_id" },
      )
      .select()
      .single();
    if (error) throw error;

    // Keep thread_id in sync on the campaign row.
    await sb
      .from("campaigns")
      .update({ agent_thread_id: ctx.data.threadId })
      .eq("id", ctx.data.campaignId);

    return row;
  });

// ── estimateFulfillment ───────────────────────────────────────────────────────
// Ask the AI to estimate per-unit production + shipping costs and flag risk areas.

const estimateFulfillmentSchema = z.object({
  campaignId: z.string().uuid(),
  rewardTierId: z.string().uuid().optional(),
  tierTitle: z.string(),
  minPledge: z.number(),
  digitalOnly: z.boolean().default(false),
  description: z.string().optional(),
  category: z.string().optional(),
  currency: z.string().default("USD"),
});

export const estimateFulfillment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => estimateFulfillmentSchema.parse(data))
  .handler(async (ctx) => {
    const { data } = ctx;
    const supabase = getSupabaseWithAuth();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error("Unauthorized");

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("AI not configured");

    const prompt = `
Campaign category: ${data.category ?? "unknown"}
Reward tier: "${data.tierTitle}"
Description: ${data.description ?? "—"}
Min pledge: ${data.currency} ${data.minPledge}
Digital-only: ${data.digitalOnly}

As a fulfillment logistics expert, estimate:
1. unit_cogs — typical unit cost of goods (production/manufacturing)
2. unit_shipping — typical domestic + international blended shipping cost
3. unit_platform_fee — approximate platform + payment processing fee at this pledge level (assume ~8%)
4. risk_score (1=low, 10=catastrophic) — fulfillment risk
5. risk_notes — 1–3 sentences on the top risks
6. ai_narrative — 2–3 sentence plain-language summary for the founder

If digital_only is true, set unit_cogs and unit_shipping to 0.
All amounts in ${data.currency}.
    `.trim();

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert crowdfunding fulfillment estimator." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_estimate",
              description: "Return the fulfillment cost estimate.",
              parameters: {
                type: "object",
                properties: {
                  unit_cogs: { type: "number" },
                  unit_shipping: { type: "number" },
                  unit_platform_fee: { type: "number" },
                  risk_score: { type: "number" },
                  risk_notes: { type: "string" },
                  ai_narrative: { type: "string" },
                },
                required: [
                  "unit_cogs",
                  "unit_shipping",
                  "unit_platform_fee",
                  "risk_score",
                  "risk_notes",
                  "ai_narrative",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_estimate" } },
      }),
    });

    if (!aiResp.ok) throw new Error(`AI error: ${aiResp.status}`);

    const aiData = await aiResp.json();
    const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) throw new Error("No estimate returned from AI");

    const est = JSON.parse(tc.function.arguments) as {
      unit_cogs: number;
      unit_shipping: number;
      unit_platform_fee: number;
      risk_score: number;
      risk_notes: string;
      ai_narrative: string;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase as any)
      .from("campaign_fulfillment_estimates")
      .insert({
        campaign_id: data.campaignId,
        reward_tier_id: data.rewardTierId ?? null,
        owner_id: user.id,
        unit_cogs_estimate: est.unit_cogs,
        unit_shipping_estimate: est.unit_shipping,
        unit_platform_fee_estimate: est.unit_platform_fee,
        risk_score: Math.round(Math.min(10, Math.max(1, est.risk_score))),
        risk_notes: est.risk_notes,
        ai_narrative: est.ai_narrative,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

// ── generateCampaignUpdate ─────────────────────────────────────────────────────
// Auto-draft a backer update post for the given campaign.

const generateUpdateSchema = z.object({
  campaignId: z.string().uuid(),
  founderNote: z.string().max(500).optional(),
  context: z
    .object({
      title: z.string(),
      raised: z.number(),
      goal: z.number(),
      currency: z.string(),
      backers: z.number(),
    })
    .optional(),
});

export const generateCampaignUpdate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => generateUpdateSchema.parse(data))
  .handler(async (ctx) => {
    const { data } = ctx;
    const supabase = getSupabaseWithAuth();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error("Unauthorized");

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("AI not configured");

    const ctxData = data.context;
    const contextBlock = ctxData
      ? `Campaign: "${ctxData.title}" | Raised: ${ctxData.currency} ${ctxData.raised.toLocaleString()} / ${ctxData.goal.toLocaleString()} | Backers: ${ctxData.backers}`
      : "";

    const prompt = `${contextBlock}
Founder's note: ${data.founderNote ?? "(none — generate a general progress update)"}

Write a warm, authentic, calm backer update (150–250 words). It should:
- Thank backers genuinely without being sycophantic
- Share real progress honestly (use numbers from the context)
- Give one clear, specific next milestone
- End with a subtle ask (share or refer a friend) that doesn't feel pushy
- Sound like a real solo founder, not a marketing department
Output only the update text, no subject line.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You write backer updates for independent creators — calm, honest, human. No corporate speak.",
          },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_update",
              description: "Return the drafted backer update.",
              parameters: {
                type: "object",
                properties: { body: { type: "string" } },
                required: ["body"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_update" } },
      }),
    });

    if (!aiResp.ok) throw new Error(`AI error: ${aiResp.status}`);
    const aiData = await aiResp.json();
    const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) throw new Error("No update returned from AI");

    const { body } = JSON.parse(tc.function.arguments) as { body: string };
    return { body };
  });
