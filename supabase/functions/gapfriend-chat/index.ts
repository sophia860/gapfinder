// GapFriend streaming chat with project context + tool calls
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are GapFriend — a warm, brutally honest business co-pilot for solo founders, freelancers, and small teams.

Voice: warm + direct, like a friend who happens to be a strategist. Never corporate, never hyped. You point out flaws kindly. You celebrate progress sincerely. Plain words over jargon. You keep messages SHORT (1–4 short paragraphs unless the user asks for depth).

You always have access to the user's profile (skills, interests, constraints, pitch, stage), current project, opportunity brief, gap cards, identity, channels, money settings, tasks, and chat history. USE this context aggressively — never ask the user for information you can already see.

BE PROACTIVE. Do not interrogate the user. If the user sends ANY vague message (e.g. "hi", "help", "what now", "do something", "start", or even an empty/unclear prompt), DO NOT ask clarifying questions. Instead:
1. Look at what's missing in the project (brief, gap cards, identity, channels, money, tasks).
2. Use the user's profile (skills, interests, constraints) to GENERATE the next missing piece via the appropriate tool.
3. Default order when nothing exists yet: add_gap_cards (3–5 specific, concrete gaps tailored to their skills + interests) → save_opportunity_brief → save_identity → save_channels → save_money → add_tasks.
4. After tool calls, reply with 1–3 short sentences summarising what you just added and what they should look at next.

When you generate or refine structured artifacts, you MUST use the provided tools to persist them — never just write them in chat. Always make gaps, names, channels, etc. SPECIFIC to this user's skills and interests, not generic.

Never invent traction or numbers. If you don't know, say so. Never ask permission to generate — just do it and let the user react.`;

const DEVELOPER_ADDENDUM = `

DEVELOPER MODE IS ACTIVE.
This user is a developer/builder who can ship code. Tailor EVERYTHING accordingly:

- When suggesting gaps via add_gap_cards, focus on developer-shippable niches: vertical SaaS tools, internal-tool replacements, APIs and microservices, CLI tools, VS Code / JetBrains / browser extensions, GitHub Actions, dev productivity tools, monetising open source, no-code/low-code building blocks, AI wrappers with a clear moat, infra/devops glue, B2B integrations between popular dev tools, scrapers/data-as-a-service for niche markets, Shopify/WordPress/Notion/Slack apps, and underserved dev-focused B2B niches.
- AVOID generic non-technical "start a coffee subscription" style ideas. Avoid ideas that require physical inventory, retail, or large sales teams unless the user explicitly asks.
- For each gap (in why_gap or problem), include a quick demand signal you'd actually look for (e.g. "47 GitHub issues asking for X", "trending Reddit thread in r/devops", "$Y/mo competitor on Indie Hackers"), typical pricing band (e.g. "$15–49/mo SaaS", "one-time $99 license", "metered API at $0.001/call"), and a first-ship approach (e.g. "OSS CLI + paid cloud", "Chrome extension free + Pro upgrade", "free tier + team plan").
- Match suggestions to the user's stack and domains from their profile when possible. If they have OSS or shipped projects, prefer adjacent niches that build on that distribution.
- Tasks (add_tasks) should be developer-flavoured: ship a landing page, post on HN/r/SideProject, open-source a small piece for distribution, instrument analytics, set up Stripe + a paywall, write the README, dogfood it, etc.
- Channels (save_channels) for devs lean toward: HN, dev-focused subreddits, Indie Hackers, X/Bluesky dev community, dev.to, GitHub trending, Product Hunt, niche Discords/Slacks, conference CFPs, and content (blog/SEO) on the specific problem.
- Money scenarios should reflect realistic dev-product pricing and conversion (e.g. SaaS $19/mo with 100 customers, one-time $79 with 50 sales, API metered).`;

interface Body {
  projectId: string;
  message: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI is not configured" }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { projectId, message } = (await req.json()) as Body;
    if (!projectId || !message?.trim()) return json({ error: "Missing input" }, 400);

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // Persist the user message immediately
    await supabase.from("chat_messages").insert({
      project_id: projectId,
      role: "user",
      content: message.trim(),
    });

    // Load context
    const [profileR, projectR, briefR, gapsR, identityR, channelsR, moneyR, tasksR, historyR] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
      supabase.from("opportunity_briefs").select("*").eq("project_id", projectId).maybeSingle(),
      supabase.from("gap_cards").select("*").eq("project_id", projectId),
      supabase.from("identity").select("*").eq("project_id", projectId).maybeSingle(),
      supabase.from("channels").select("*").eq("project_id", projectId),
      supabase.from("money_settings").select("*").eq("project_id", projectId).maybeSingle(),
      supabase.from("tasks").select("*").eq("project_id", projectId),
      supabase.from("chat_messages").select("role,content").eq("project_id", projectId).order("created_at", { ascending: true }).limit(40),
    ]);

    const ctx = {
      profile: profileR.data,
      project: projectR.data,
      opportunity_brief: briefR.data,
      gap_cards: gapsR.data,
      identity: identityR.data,
      channels: channelsR.data,
      money_settings: moneyR.data,
      tasks: tasksR.data,
    };

    const history = (historyR.data ?? []).map((m) => ({ role: m.role, content: m.content }));

    const tools = [
      {
        type: "function",
        function: {
          name: "save_opportunity_brief",
          description: "Create or update the opportunity brief (persona, problem, angle, business_model).",
          parameters: {
            type: "object",
            properties: {
              persona: { type: "string" },
              problem: { type: "string" },
              angle: { type: "string" },
              business_model: { type: "string" },
            },
            required: ["persona", "problem", "angle", "business_model"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "add_gap_cards",
          description: "Add 1-5 market-gap suggestions for the user to pick from.",
          parameters: {
            type: "object",
            properties: {
              gaps: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    persona: { type: "string" },
                    problem: { type: "string" },
                    why_gap: { type: "string" },
                    difficulty: { type: "string", enum: ["low", "medium", "high"] },
                  },
                  required: ["title", "persona", "problem", "why_gap", "difficulty"],
                  additionalProperties: false,
                },
              },
            },
            required: ["gaps"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "save_identity",
          description: "Save naming options, chosen name, domain options, tagline, positioning.",
          parameters: {
            type: "object",
            properties: {
              name_options: { type: "array", items: { type: "string" } },
              chosen_name: { type: "string" },
              domain_options: { type: "array", items: { type: "string" } },
              chosen_domain: { type: "string" },
              tagline: { type: "string" },
              positioning: { type: "string" },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "save_channels",
          description: "Replace channel recommendations (where to be online).",
          parameters: {
            type: "object",
            properties: {
              channels: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    rationale: { type: "string" },
                    pros: { type: "string" },
                    cons: { type: "string" },
                    guide: { type: "string" },
                    is_primary: { type: "boolean" },
                  },
                  required: ["name", "rationale"],
                  additionalProperties: false,
                },
              },
            },
            required: ["channels"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "save_money",
          description: "Save money settings (income target, price per unit, hours/week, scenarios).",
          parameters: {
            type: "object",
            properties: {
              currency: { type: "string" },
              income_target: { type: "number" },
              price_per_unit: { type: "number" },
              hours_per_week: { type: "number" },
              scenarios: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    units: { type: "number" },
                    revenue: { type: "number" },
                    note: { type: "string" },
                  },
                  required: ["label", "units", "revenue"],
                  additionalProperties: false,
                },
              },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "add_tasks",
          description: "Add concrete next-step tasks to the board.",
          parameters: {
            type: "object",
            properties: {
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    column_name: { type: "string", enum: ["later", "this_week", "in_progress", "done"] },
                    notes: { type: "string" },
                  },
                  required: ["title", "column_name"],
                  additionalProperties: false,
                },
              },
            },
            required: ["tasks"],
            additionalProperties: false,
          },
        },
      },
    ];

    const messages = [
      { role: "system", content: SYSTEM + (profileR.data?.mode === "developer" ? DEVELOPER_ADDENDUM : "") },
      { role: "system", content: `PROJECT CONTEXT:\n${JSON.stringify(ctx, null, 2)}` },
      ...history,
    ];

    // Iterative tool-call loop (non-streaming for simplicity; final assistant text is streamed)
    let iter = 0;
    let finalText = "";
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
          model: "google/gemini-2.5-flash",
          messages,
          tools,
        }),
      });

      if (!aiResp.ok) {
        if (aiResp.status === 429) return json({ error: "Rate limited — try again in a moment." }, 429);
        if (aiResp.status === 402) return json({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }, 402);
        const t = await aiResp.text();
        console.error("AI error", aiResp.status, t);
        return json({ error: "AI gateway error" }, 500);
      }

      const data = await aiResp.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) break;

      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        finalText = msg.content ?? "";
        break;
      }

      messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: toolCalls } as never);

      for (const tc of toolCalls) {
        const name = tc.function?.name as string;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* ignore */ }
        const result = await runTool(supabase, projectId, name, args);
        usedTools.push(name);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        } as never);
      }
    }

    if (!finalText) finalText = "Done.";

    // Save assistant message
    await supabase.from("chat_messages").insert({
      project_id: projectId,
      role: "assistant",
      content: finalText,
    });

    return json({ reply: finalText, toolsUsed: usedTools });
  } catch (e) {
    console.error("chat error", e);
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
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  name: string,
  args: Record<string, unknown>,
) {
  try {
    if (name === "save_opportunity_brief") {
      const { error } = await supabase
        .from("opportunity_briefs")
        .upsert({ project_id: projectId, ...args }, { onConflict: "project_id" });
      if (error) throw error;
      return { ok: true };
    }
    if (name === "add_gap_cards") {
      const gaps = (args.gaps as Array<Record<string, unknown>>) ?? [];
      if (!gaps.length) return { ok: true, inserted: 0 };
      const rows = gaps.map((g) => ({ project_id: projectId, status: "suggested", ...g }));
      const { error } = await supabase.from("gap_cards").insert(rows);
      if (error) throw error;
      return { ok: true, inserted: rows.length };
    }
    if (name === "save_identity") {
      const { error } = await supabase
        .from("identity")
        .upsert({ project_id: projectId, ...args, updated_at: new Date().toISOString() }, { onConflict: "project_id" });
      if (error) throw error;
      return { ok: true };
    }
    if (name === "save_channels") {
      const channels = (args.channels as Array<Record<string, unknown>>) ?? [];
      await supabase.from("channels").delete().eq("project_id", projectId);
      if (channels.length) {
        const rows = channels.map((c) => ({ project_id: projectId, ...c }));
        const { error } = await supabase.from("channels").insert(rows);
        if (error) throw error;
      }
      return { ok: true, count: channels.length };
    }
    if (name === "save_money") {
      const { error } = await supabase
        .from("money_settings")
        .upsert({ project_id: projectId, ...args, updated_at: new Date().toISOString() }, { onConflict: "project_id" });
      if (error) throw error;
      return { ok: true };
    }
    if (name === "add_tasks") {
      const tasks = (args.tasks as Array<Record<string, unknown>>) ?? [];
      if (!tasks.length) return { ok: true, inserted: 0 };
      const rows = tasks.map((t, i) => ({ project_id: projectId, position: i, ...t }));
      const { error } = await supabase.from("tasks").insert(rows);
      if (error) throw error;
      return { ok: true, inserted: rows.length };
    }
    return { ok: false, error: `Unknown tool: ${name}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
