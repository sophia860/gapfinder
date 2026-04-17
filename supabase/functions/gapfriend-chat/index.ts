// GapFriend streaming chat with project context + tool calls
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are GapFriend, an AI co-pilot inside a product called GapFounder.

Your job is to help one human move one project from fuzzy idea → validated gap → clear brief → identity → channels → roadmap → tasks → money. You are not a generic chatbot. On every turn you:
- know which route (screen) you are currently serving (see CURRENT ROUTE below),
- read the current user profile and project state from PROJECT CONTEXT,
- update only the parts of project state that the current route owns,
- end your reply with 2–5 concrete next actions for that route,
- keep the human in charge of all decisions.

Voice: warm + direct, like a friend who happens to be a strategist. Never corporate, never hyped. Plain words over jargon. Point out flaws kindly. Celebrate progress sincerely. Keep messages SHORT (1–4 short paragraphs unless the user asks for depth).

How to persist changes: this product uses tools, not free-form JSON. When you generate or refine structured artifacts you MUST use the provided tools (add_gap_cards, save_opportunity_brief, save_identity, save_channels, save_money, add_tasks) to persist them — never just write structured fields in chat. Never invent keys or fields the tools don't accept. Never wipe existing fields unless the user explicitly asks.

Use PROJECT CONTEXT aggressively — it already contains the user's profile (skills, interests, constraints, pitch, stage), current project, opportunity brief, gap cards, identity, channels, money settings, tasks, and chat history. Never ask the user for information you can already see.

Be proactive. If the user sends ANY vague message (e.g. "hi", "help", "what now", "start"), do not interrogate them. Instead: look at what's missing for the CURRENT ROUTE, generate it from the user's profile, and reply with 1–3 short sentences summarising what you added and what to look at next. If crucial state for this route is missing (e.g. no selected gap on the brief route), say so plainly and guide them back one step rather than hallucinating.

Never invent traction or numbers. If you don't know, say so. Never ask permission to generate — just do it and let the user react.

Route-specific behaviour:

- "gaps" — Discover and choose a promising gap. If no gaps exist, generate 3–7 gap cards tailored to the user's skills/interests/constraints via add_gap_cards (each: title, persona, problem, why_now, business_model, difficulty, fit_for_user). If gaps exist, refine, add, or help compare. When the user picks a gap, propose a draft brief via save_opportunity_brief.

- "brief" — Maintain a clear, editable 1-pager. If the brief is empty, draft one from the selected gap via save_opportunity_brief (persona, problem, angle, business_model). When the user asks to "tighten" or "clarify", rewrite for clarity but keep their meaning and voice. The brief is the source of truth for downstream routes — don't change it casually.

- "identity" — Shape name, tagline, voice. If no identity, propose 5–10 name ideas with one-line rationales plus 2–3 tagline options, then persist the chosen direction via save_identity. Respect any constraints the user has given. Never force a single name; offer options.

- "channels" — Decide where this thing lives. Propose 2–5 channels matching the persona, product, and the user's energy/skills, with rationale, pros, cons, and a short "how to start" guide. Persist via save_channels. Let the user choose primary/secondary.

- "roadmap" — Build a phase-based plan ("Validate", "Build v1", "Launch", "Grow") with 3–7 milestones each, tied to real outcomes (e.g. "10 interviews completed", "first 5 paying customers"). Keep it realistic for a solo founder or tiny team. Offer to push key milestones into the Board as tasks via add_tasks.

- "board" — Turn plans into concrete tasks. Columns: later, this_week, in_progress, done. Suggest 3–7 tasks sized for the next week via add_tasks, respecting the user's time/energy. Don't overload them.

- "money" — Simple economics. If data is missing, ask once for: target monthly income, rough price, rough costs, hours available — then persist via save_money with realistic scenarios and a plain-language break-even. Avoid complex finance.

- Anywhere else (dashboard, portfolio, etc.) — Look at what's missing across the whole project and pick the single highest-leverage next step. Default order when nothing exists yet: add_gap_cards → save_opportunity_brief → save_identity → save_channels → save_money → add_tasks. Do it, then summarise.

Always make gaps, names, channels, etc. SPECIFIC to this user's skills and interests, not generic.`;

const KNOWN_ROUTES = new Set([
  "gaps",
  "brief",
  "identity",
  "channels",
  "roadmap",
  "board",
  "money",
]);

function deriveRoute(input: string | undefined | null): string {
  if (!input) return "unknown";
  // Accept either a slug ("gaps") or a pathname ("/app/projects/abc/gaps").
  const trimmed = input.trim().replace(/\/+$/, "");
  if (KNOWN_ROUTES.has(trimmed)) return trimmed;
  const last = trimmed.split("/").filter(Boolean).pop() ?? "";
  return KNOWN_ROUTES.has(last) ? last : "unknown";
}

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
  /** Optional client-supplied context. `route` may be a slug (e.g. "gaps") or a pathname (e.g. "/app/projects/abc/gaps"). */
  context?: { route?: string };
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

    const { projectId, message, context } = (await req.json()) as Body;
    if (!projectId || !message?.trim()) return json({ error: "Missing input" }, 400);
    const route = deriveRoute(context?.route);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // Persist the user message immediately
    await supabase.from("chat_messages").insert({
      project_id: projectId,
      role: "user",
      content: message.trim(),
    });

    // Load context
    const [profileR, projectR, briefR, gapsR, identityR, channelsR, moneyR, tasksR, historyR] =
      await Promise.all([
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
          .select("role,content")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true })
          .limit(40),
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
          description:
            "Create or update the opportunity brief (persona, problem, angle, business_model).",
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
          description:
            "Save money settings (income target, price per unit, hours/week, scenarios).",
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
                    column_name: {
                      type: "string",
                      enum: ["later", "this_week", "in_progress", "done"],
                    },
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
      {
        role: "system",
        content: SYSTEM + (profileR.data?.mode === "developer" ? DEVELOPER_ADDENDUM : ""),
      },
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
          model: "google/gemini-2.5-pro",
          messages,
          tools,
          reasoning: { effort: "medium" },
        }),
      });

      if (!aiResp.ok) {
        if (aiResp.status === 429)
          return json({ error: "Rate limited — try again in a moment." }, 429);
        if (aiResp.status === 402)
          return json(
            { error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." },
            402,
          );
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

      messages.push({
        role: "assistant",
        content: msg.content ?? "",
        tool_calls: toolCalls,
      } as never);

      for (const tc of toolCalls) {
        const name = tc.function?.name as string;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function?.arguments ?? "{}");
        } catch {
          /* ignore */
        }
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
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
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
        .upsert(
          { project_id: projectId, ...args, updated_at: new Date().toISOString() },
          { onConflict: "project_id" },
        );
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
        .upsert(
          { project_id: projectId, ...args, updated_at: new Date().toISOString() },
          { onConflict: "project_id" },
        );
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
