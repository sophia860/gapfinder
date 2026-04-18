// crowdfund-swarm — synthetic AI persona swarm for pre-launch campaign intelligence.
// Runs 7 distinct AI personas (skeptical backer, enthusiast, domain critic, logistician,
// growth marketer, price shopper, repeat backer) against the founder's private campaign
// data and returns ranked, categorised insights + an executive summary — all before
// anything is made public. Strictly private: only the campaign owner can trigger.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── helpers ──────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── types ────────────────────────────────────────────────────────────────────

interface Body {
  campaignId: string;
}

interface SwarmInsight {
  persona: string;
  category: string;
  insight: string;
  suggestion: string | null;
  severity: number;
  sentiment: "positive" | "neutral" | "negative";
}

interface SwarmResult {
  insights: SwarmInsight[];
  summary: string;
}

// ── persona definitions ───────────────────────────────────────────────────────

const PERSONAS = [
  {
    key: "skeptical_backer",
    label: "Skeptical Backer",
    brief:
      "You're a repeat Kickstarter backer who has been burned before. You read everything twice, look for red flags, and only back when trust is rock-solid. You are the founder's toughest reviewer.",
  },
  {
    key: "enthusiast_backer",
    label: "Enthusiast Backer",
    brief:
      "You love new ideas and back 20+ campaigns a year. You respond to emotional resonance, mission clarity, and community vibes. You are the founder's most enthusiastic advocate.",
  },
  {
    key: "domain_critic",
    label: "Domain Expert Critic",
    brief:
      "You have deep expertise in this product's industry. You immediately spot technical gaps, competitive blind spots, and anything that contradicts how the market actually works.",
  },
  {
    key: "logistician",
    label: "Fulfillment Logistician",
    brief:
      "You've shipped thousands of crowdfunded products. You care about COGS, lead times, packaging costs, customs, and the specific risks of each reward tier. You surface issues before they become nightmares.",
  },
  {
    key: "growth_marketer",
    label: "Growth Marketer",
    brief:
      "You think in hooks, conversion rates, and virality. You evaluate page copy, the first 5 seconds of the video, the headline, and whether a stranger would immediately understand the value proposition.",
  },
  {
    key: "price_shopper",
    label: "Price-Sensitive Shopper",
    brief:
      "You compare every reward tier against what you could buy on Amazon. You question any price premium and need a clear, memorable reason to pay more for this specific version.",
  },
  {
    key: "repeat_backer",
    label: "Repeat Platform Backer",
    brief:
      "You've backed 50+ projects and have strong opinions about update cadence, founder communication style, and what a trustworthy creator profile looks like. You decide within 90 seconds.",
  },
] as const;

// ── main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_KEY =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { campaignId } = (await req.json()) as Body;
    if (!campaignId) return json({ error: "Missing campaignId" }, 400);

    // Ownership guard — RLS ensures this only returns rows the user owns.
    const { data: campaign, error: camErr } = await supabase
      .from("campaigns")
      .select("*, campaign_reward_tiers(*)")
      .eq("id", campaignId)
      .maybeSingle();
    if (camErr || !campaign) return json({ error: "Campaign not found or access denied" }, 403);

    // Self-throttle: skip if a completed swarm run happened in the last 5 minutes.
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: recentRuns } = await supabase
      .from("campaign_swarm_runs")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("status", "complete")
      .gte("created_at", fiveMinutesAgo)
      .limit(1);
    if (recentRuns && recentRuns.length > 0) {
      return json({ skipped: true, reason: "throttled" });
    }

    // Create a pending run record.
    const { data: run, error: runErr } = await supabase
      .from("campaign_swarm_runs")
      .insert({
        campaign_id: campaignId,
        owner_id: user.id,
        status: "running",
        personas_used: PERSONAS.map((p) => p.key),
        raw_input: {
          title: campaign.title,
          pitch: campaign.pitch,
          story: campaign.story?.slice(0, 800),
          goal_amount: campaign.goal_amount,
          currency: campaign.currency,
          funding_model: campaign.funding_model ?? "all_or_nothing",
          deadline_at: campaign.deadline_at,
          category: campaign.category,
          tier_count: (campaign.campaign_reward_tiers ?? []).length,
        },
      })
      .select()
      .single();
    if (runErr || !run) return json({ error: "Could not create swarm run" }, 500);

    // Build the context string shown to all personas.
    const tierLines = (campaign.campaign_reward_tiers ?? [])
      .map(
        (t: { title: string; min_pledge: number; description?: string }) =>
          `  • ${t.title} — ${campaign.currency} ${t.min_pledge}${t.description ? ` (${t.description.slice(0, 80)})` : ""}`,
      )
      .join("\n");

    const context = `
Campaign title: ${campaign.title}
One-line pitch: ${campaign.pitch ?? "—"}
Story excerpt: ${(campaign.story ?? "").slice(0, 600)}
Funding goal: ${campaign.currency} ${campaign.goal_amount}
Funding model: ${campaign.funding_model ?? "all_or_nothing"}
Deadline: ${campaign.deadline_at ? new Date(campaign.deadline_at).toDateString() : "—"}
Category: ${campaign.category ?? "—"}
Risks: ${(campaign.risks_text ?? "").slice(0, 300) || "None provided"}
Reward tiers (${(campaign.campaign_reward_tiers ?? []).length}):
${tierLines || "  (none yet)"}
    `.trim();

    // Call the AI with all personas in a single request to minimise latency.
    const personaDescriptions = PERSONAS.map(
      (p, i) => `Persona ${i + 1} — ${p.label}: ${p.brief}`,
    ).join("\n\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a synthetic backer swarm — ${PERSONAS.length} distinct AI personas evaluating a pre-launch crowdfunding campaign in private. Your job is to give the founder brutally honest, specific, actionable pre-launch intelligence so they can improve before going public. Be concrete. No filler. Every insight must reference specific campaign details.`,
          },
          {
            role: "user",
            content: `Here are the ${PERSONAS.length} personas:\n\n${personaDescriptions}\n\n---\n\nCAMPAIGN DATA (private):\n${context}\n\n---\n\nEach persona should produce 1–3 insights, each with a category (page_copy | reward_tier | pricing | fulfillment_risk | audience_fit | trust_signal | virality | timing), a severity 1–10, and a specific suggestion. Then provide a short executive summary (2–4 sentences) from the founder's perspective.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_swarm_result",
              description: "Return the full swarm analysis.",
              parameters: {
                type: "object",
                properties: {
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        persona: {
                          type: "string",
                          enum: PERSONAS.map((p) => p.key),
                        },
                        category: {
                          type: "string",
                          enum: [
                            "page_copy",
                            "reward_tier",
                            "pricing",
                            "fulfillment_risk",
                            "audience_fit",
                            "trust_signal",
                            "virality",
                            "timing",
                          ],
                        },
                        insight: { type: "string" },
                        suggestion: { type: "string" },
                        severity: { type: "number" },
                        sentiment: {
                          type: "string",
                          enum: ["positive", "neutral", "negative"],
                        },
                      },
                      required: ["persona", "category", "insight", "suggestion", "severity", "sentiment"],
                      additionalProperties: false,
                    },
                  },
                  summary: { type: "string" },
                },
                required: ["insights", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_swarm_result" } },
      }),
    });

    if (!aiResp.ok) {
      await supabase
        .from("campaign_swarm_runs")
        .update({ status: "failed" })
        .eq("id", run.id);
      if (aiResp.status === 429) return json({ error: "Rate limited" }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: "AI error" }, 500);
    }

    const aiData = await aiResp.json();
    const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) {
      await supabase.from("campaign_swarm_runs").update({ status: "failed" }).eq("id", run.id);
      return json({ error: "No swarm result returned" }, 500);
    }

    const result: SwarmResult = JSON.parse(tc.function.arguments);

    // Persist insights.
    if (result.insights.length > 0) {
      await supabase.from("campaign_swarm_insights").insert(
        result.insights.map((ins) => ({
          run_id: run.id,
          campaign_id: campaignId,
          owner_id: user.id,
          persona: ins.persona,
          category: ins.category,
          insight: ins.insight,
          suggestion: ins.suggestion ?? null,
          severity: Math.round(Math.min(10, Math.max(1, ins.severity))),
          sentiment: ins.sentiment,
        })),
      );
    }

    // Mark run complete and write summary + timestamp back to campaign.
    const now = new Date().toISOString();
    await Promise.all([
      supabase
        .from("campaign_swarm_runs")
        .update({ status: "complete", summary: result.summary, completed_at: now })
        .eq("id", run.id),
      supabase
        .from("campaigns")
        .update({ swarm_last_run_at: now })
        .eq("id", campaignId),
    ]);

    return json({ runId: run.id, summary: result.summary, insightCount: result.insights.length });
  } catch (err) {
    console.error("crowdfund-swarm error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
