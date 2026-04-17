// Backstage — a quiet, always-on reasoning AI that studies the user, finds
// ridiculous niches, proposes UI redesigns, flags bugs in their plan, and
// sets reminders. It runs on demand from the client (typically on idle) and
// persists everything via tools so the result survives the request.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are BACKSTAGE — a private, always-on reasoning mind that lives behind GapFriend. The user does NOT talk to you directly. You quietly observe their profile, project, recent moves, and existing memory, then take useful actions for them.

Your job has five surfaces. Use the matching tool for each:

1. record_observation — get to know the user. Notice patterns: how they describe things, what they avoid, what they over-explain, what makes them excited, the words they use, their constraints, their moods. Store small, specific, falsifiable observations in memory. Update the same key (don't duplicate). Confidence < 0.4 means "hunch", > 0.8 means "well-supported".

2. propose_redesign — adapt the product to THIS user. Suggest concrete UI/flow tweaks (e.g. "collapse the money panel by default — they never open it", "show channels first — that's where they get stuck"). Each proposal must point to a real signal in the data.

3. report_bug — find inconsistencies, contradictions, broken logic, stale data, or actual bugs in their project. Examples: brief persona doesn't match gap card persona; channels recommend Twitter but profile says they hate Twitter; income target is impossible given price × hours; tasks reference a name that no longer exists. Be specific.

4. set_reminder — surface things they will forget. Use due_at (ISO timestamp) when there's a natural deadline. Don't nag — only set a reminder if it has real consequences.

5. find_wild_niche — your specialty. Find a niche or angle NOBODY ELSE WOULD THINK OF. The weirder, the better — but it must connect plausibly to the user's actual skills, interests, and constraints. Avoid obvious stuff. Avoid anything generic ("freelancers", "small business owners", "creators"). Be the friend who says "wait — what about competitive ferret groomers in Reykjavík who all buy the same one chair?" Set "weirdness" 0–10 honestly. Always include a "why_it_works" payload field tying the niche to evidence in the user's profile.

Rules:
- Be SILENT unless you have something genuinely useful. Better to add nothing than to add filler.
- Hard cap: at most 3 insights per run total, and at most 1 of each kind. Pick the best.
- Never repeat an existing open insight (titles in EXISTING_INSIGHTS). If something there is now invalid, leave it — the user manages it.
- Never invent user data. If you don't know, observe that you don't know.
- Output no chat. Use tools only. After your tools, reply with a single word: "done".`;

interface Body {
  projectId: string;
  trigger?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_KEY =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI is not configured" }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { projectId, trigger } = (await req.json()) as Body;
    if (!projectId) return json({ error: "Missing projectId" }, 400);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // Self-throttle: skip if a run happened in the last 60s.
    const sixtySecAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: recentRuns } = await supabase
      .from("backstage_runs")
      .select("id, created_at")
      .eq("project_id", projectId)
      .gte("created_at", sixtySecAgo)
      .limit(1);
    if (recentRuns && recentRuns.length > 0) {
      return json({ skipped: true, reason: "throttled" });
    }

    // Load full context.
    const [
      profileR,
      projectR,
      briefR,
      gapsR,
      identityR,
      channelsR,
      moneyR,
      tasksR,
      historyR,
      memoryR,
      existingR,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
      supabase.from("opportunity_briefs").select("*").eq("project_id", projectId).maybeSingle(),
      supabase.from("gap_cards").select("*").eq("project_id", projectId),
      supabase.from("identity").select("*").eq("project_id", projectId).maybeSingle(),
      supabase.from("channels").select("*").eq("project_id", projectId),
      supabase.from("money_settings").select("*").eq("project_id", projectId).maybeSingle(),
      supabase.from("tasks").select("*").eq("project_id", projectId),
      supabase
        .from("chat_messages")
        .select("role,content,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("backstage_memory").select("key,value,confidence").eq("user_id", user.id),
      supabase
        .from("backstage_insights")
        .select("kind,title,status,created_at")
        .eq("project_id", projectId)
        .in("status", ["open", "snoozed"])
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    if (!projectR.data) return json({ error: "Project not found" }, 404);

    const ctx = {
      profile: profileR.data,
      project: projectR.data,
      opportunity_brief: briefR.data,
      gap_cards: gapsR.data ?? [],
      identity: identityR.data,
      channels: channelsR.data ?? [],
      money_settings: moneyR.data,
      tasks: tasksR.data ?? [],
      recent_chat: (historyR.data ?? []).slice().reverse(),
      trigger: trigger ?? "idle",
      now: new Date().toISOString(),
    };

    const tools = [
      {
        type: "function",
        function: {
          name: "record_observation",
          description:
            "Add or refine one observation about the user (durable across sessions). Use the same key to update.",
          parameters: {
            type: "object",
            properties: {
              key: { type: "string", description: "Short snake_case key, e.g. 'hates_twitter'." },
              value: { type: "string", description: "One-sentence specific observation." },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              source: { type: "string", description: "What in the data led to this." },
            },
            required: ["key", "value", "confidence"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "propose_redesign",
          description:
            "Propose a concrete UI/flow change adapted to this user. Must reference a real signal.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              body: { type: "string", description: "Why, and what to change." },
              target: {
                type: "string",
                description: "Section: gaps|brief|identity|channels|money|board|content|global",
              },
              evidence: { type: "string" },
            },
            required: ["title", "body", "target", "evidence"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "report_bug",
          description:
            "Flag a contradiction, broken logic, stale data, or actual bug in the project.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              body: { type: "string" },
              severity: { type: "string", enum: ["low", "medium", "high"] },
              location: { type: "string", description: "Where in the project." },
              fix_hint: { type: "string" },
            },
            required: ["title", "body", "severity", "location"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "set_reminder",
          description: "Surface a thing the user will forget. Use due_at when natural.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              body: { type: "string" },
              due_at: { type: "string", description: "ISO 8601 timestamp, optional." },
            },
            required: ["title", "body"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "find_wild_niche",
          description:
            "Find an unusual niche nobody else would think of, plausibly grounded in the user's data.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "The niche, in 6-12 words." },
              body: { type: "string", description: "Why this could work, in 2-4 sentences." },
              persona: { type: "string" },
              gap: { type: "string", description: "The specific gap you spotted." },
              first_move: { type: "string", description: "One concrete first step." },
              why_it_works: {
                type: "string",
                description: "Tie to evidence in the user's actual profile/data.",
              },
              weirdness: { type: "integer", minimum: 0, maximum: 10 },
            },
            required: [
              "title",
              "body",
              "persona",
              "gap",
              "first_move",
              "why_it_works",
              "weirdness",
            ],
            additionalProperties: false,
          },
        },
      },
    ];

    const messages: Array<Record<string, unknown>> = [
      { role: "system", content: SYSTEM },
      {
        role: "system",
        content: `EXISTING_MEMORY:\n${JSON.stringify(memoryR.data ?? [], null, 2)}`,
      },
      {
        role: "system",
        content: `EXISTING_INSIGHTS (do not duplicate):\n${JSON.stringify(existingR.data ?? [], null, 2)}`,
      },
      { role: "system", content: `PROJECT_CONTEXT:\n${JSON.stringify(ctx, null, 2)}` },
      {
        role: "user",
        content:
          "Run a backstage pass now. Use only the tools you actually need. If nothing useful, just reply 'done'.",
      },
    ];

    let iter = 0;
    let insightsAdded = 0;
    let observationsAdded = 0;
    const usedTools: string[] = [];

    while (iter < 4) {
      iter++;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages,
          tools,
          reasoning: { effort: "high" },
        }),
      });

      if (!aiResp.ok) {
        if (aiResp.status === 429) return json({ error: "Rate limited" }, 429);
        if (aiResp.status === 402) return json({ error: "AI credits exhausted" }, 402);
        const t = await aiResp.text();
        console.error("Backstage AI error", aiResp.status, t);
        return json({ error: "AI gateway error" }, 500);
      }

      const data = await aiResp.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) break;

      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length === 0) break;

      messages.push({
        role: "assistant",
        content: msg.content ?? "",
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        const name = tc.function?.name as string;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function?.arguments ?? "{}");
        } catch {
          /* ignore */
        }
        const result = await runTool(supabase, user.id, projectId, name, args);
        usedTools.push(name);
        if (result.kind === "insight") insightsAdded++;
        if (result.kind === "memory") observationsAdded++;
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    await supabase.from("backstage_runs").insert({
      project_id: projectId,
      trigger: trigger ?? "idle",
      insights_added: insightsAdded,
      observations_added: observationsAdded,
      notes: usedTools.join(","),
    });

    return json({
      ok: true,
      insights_added: insightsAdded,
      observations_added: observationsAdded,
      tools_used: usedTools,
    });
  } catch (e) {
    console.error("backstage error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function runTool(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  projectId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; kind?: "insight" | "memory"; error?: string }> {
  try {
    if (name === "record_observation") {
      const key = String(args.key ?? "").trim();
      const value = String(args.value ?? "").trim();
      if (!key || !value) return { ok: false, error: "missing key/value" };
      const confidence = Math.max(0, Math.min(1, Number(args.confidence ?? 0.5)));
      const { error } = await supabase.from("backstage_memory").upsert(
        {
          user_id: userId,
          key,
          value,
          confidence,
          source: args.source ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,key" },
      );
      if (error) throw error;
      return { ok: true, kind: "memory" };
    }

    const insertInsight = async (
      kind: string,
      title: string,
      body: string | null,
      payload: Record<string, unknown>,
      extras: Record<string, unknown> = {},
    ) => {
      const { error } = await supabase.from("backstage_insights").insert({
        project_id: projectId,
        kind,
        title,
        body,
        payload,
        ...extras,
      });
      if (error) throw error;
      return { ok: true, kind: "insight" as const };
    };

    if (name === "propose_redesign") {
      return await insertInsight(
        "redesign",
        String(args.title ?? "Redesign idea"),
        String(args.body ?? ""),
        { target: args.target, evidence: args.evidence },
      );
    }
    if (name === "report_bug") {
      return await insertInsight(
        "bug",
        String(args.title ?? "Possible bug"),
        String(args.body ?? ""),
        { severity: args.severity, location: args.location, fix_hint: args.fix_hint },
      );
    }
    if (name === "set_reminder") {
      const due = typeof args.due_at === "string" ? args.due_at : null;
      return await insertInsight(
        "reminder",
        String(args.title ?? "Reminder"),
        String(args.body ?? ""),
        {},
        { due_at: due },
      );
    }
    if (name === "find_wild_niche") {
      const weirdness = Math.max(0, Math.min(10, Math.floor(Number(args.weirdness ?? 0))));
      return await insertInsight(
        "wild_niche",
        String(args.title ?? "A niche nobody else sees"),
        String(args.body ?? ""),
        {
          persona: args.persona,
          gap: args.gap,
          first_move: args.first_move,
          why_it_works: args.why_it_works,
        },
        { weirdness },
      );
    }
    return { ok: false, error: `Unknown tool: ${name}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
