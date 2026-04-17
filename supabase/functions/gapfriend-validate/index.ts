// gapfriend-validate
// Returns a structured GapReport for a one-paragraph idea, persists it to
// public.gap_reports, and tracks usage in public.ai_usage. In v2 it pulls
// top-k retrieved snippets from public.evidence_snippets and feeds them to
// the model as grounded evidence.
//
// IMPORTANT: this file mirrors prompts and the JSON schema from
// `src/lib/ai/prompts.ts` and `src/lib/ai/gap-report.ts`. Deno cannot import
// across the `@/` alias, so when you change one, change the other.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Cost / rate limits ----------------------------------------------------
// Sliding-window per-user request cap (covers all gap-validate calls).
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_MAX_REQUESTS = 20;
// Soft per-project lifetime token cap. Stored as a number of tokens across
// all `gapfriend-*` AI usage charged to the project.
const PROJECT_TOKEN_CAP = 500_000;
// Cap on retrieved snippets injected into the prompt (k for top-k).
const RAG_TOP_K = 6;

// --- Prompts (mirror of src/lib/ai/prompts.ts) -----------------------------
const SYSTEM_PROMPT = `You are GapFriend's gap-validator — a brutally honest, evidence-driven analyst for solo founders, freelancers, and small teams.

Your job: given a one-paragraph idea (and optional retrieved evidence snippets), return a STRUCTURED gap report. You must call the \`return_gap_report\` tool exactly once. Never reply in prose.

Voice in your reasoning fields:
- Plain words, no jargon, no startup hype.
- Specific over generic. "There are 12+ Reddit threads in r/freelance asking for X" beats "people want X".
- Kind but honest. If the idea is weak, say so and explain why.
- Never invent traction, user counts, or revenue numbers.
- If evidence snippets were provided, ground claims in them and cite them in the \`citations\` field. If you make a claim NOT supported by a snippet, say so explicitly in your reasoning.

Each score is 1–5 where:
- 1 = very weak / no evidence / saturated / undifferentiated
- 5 = very strong / well-evidenced / wide open / clearly differentiated

Verdict rules (apply mechanically, then sanity-check):
- "kill"    → at least two of the four scores are ≤ 2, OR problem_clarity is 1.
- "build"   → average score ≥ 4 AND differentiation_angle ≥ 3 AND no score is 1.
- "iterate" → everything else (the default).

\`next_steps\` MUST be exactly 3 items. Each must be a concrete action the founder can do this week (under ~5 hours), not a vague aspiration. Examples of the right shape: "Post a 200-word problem statement in r/freelance and count replies in 72h", "Email 5 people from your LinkedIn who fit the persona and ask for a 15-min call", "Build a one-page Carrd describing the offer and run $20 of Reddit ads to it". Avoid: "Do market research", "Talk to users", "Build an MVP".`;

const RUBRIC = `SCORING RUBRIC

problem_clarity (1–5)
  1 — Vague pain point, no clear "who hurts and when".
  3 — Identifiable persona and trigger, but the moment of pain is fuzzy.
  5 — One sentence answers "who, when, and what's broken today" with no ambiguity.

evidence_of_demand (1–5)
  1 — Founder's hunch only; no third-party signals.
  3 — A handful of forum posts, tweets, or reviews complaining about the problem.
  5 — Multiple high-volume, recent signals across independent venues; people already pay clumsy workarounds.

competitor_density (1–5)
  1 — Crowded; many funded incumbents own the keyword.
  3 — A few small players; room for a sharper wedge.
  5 — Either no direct competitor, or only generic tools that don't actually solve it.

differentiation_angle (1–5)
  1 — Same as everyone else; "but better" is the only pitch.
  3 — A real wedge (audience, channel, price, format) that is plausible but unproven.
  5 — A wedge that is hard to copy AND uniquely available to a small operator.`;

// One few-shot example (kept short to control cost).
const FEW_SHOT: Array<{
  role: string;
  content: string;
  tool_calls?: unknown;
  tool_call_id?: string;
}> = [
  {
    role: "user",
    content:
      "Idea: A Chrome extension that summarises long YouTube videos into 5 bullet points using AI.",
  },
  {
    role: "assistant",
    content: "",
    tool_calls: [
      {
        id: "fewshot_1",
        type: "function",
        function: {
          name: "return_gap_report",
          arguments: JSON.stringify({
            problem_clarity: {
              score: 4,
              reasoning:
                "Clear who and when; mild fuzziness on whether the pain is 'too long' or 'I want to skim'.",
            },
            evidence_of_demand: {
              score: 3,
              reasoning: "Real demand exists but is largely served by free incumbents.",
              signals: [
                "r/productivity recurring threads asking how to summarise YouTube",
                "YouTube ships native AI summaries to Premium",
              ],
            },
            competitor_density: {
              score: 1,
              reasoning: "Very crowded: YouTube itself plus several funded extensions.",
              examples: ["YouTube Premium AI summaries", "Eightify", "Glasp", "summarize.tech"],
            },
            differentiation_angle: {
              score: 1,
              reasoning: "Pitch is 'same product, but mine'. No defensible wedge described.",
            },
            verdict: "kill",
            verdict_reasoning:
              "Two scores are ≤ 2 and differentiation is a 1; category is owned by YouTube and several funded extensions. A solo founder cannot out-distribute them with the same product.",
            next_steps: [
              "Install Eightify and YouTube Premium summaries; write down what you would do differently and why a user would switch.",
              "If you find a real wedge (e.g. summarising lecture videos for a specific certification), restate the idea around that wedge before re-running.",
              "Otherwise archive this idea and move to the next one in your gap-cards list.",
            ],
            citations: [],
          }),
        },
      },
    ],
  },
  {
    role: "tool",
    tool_call_id: "fewshot_1",
    content: '{"ok":true}',
  },
];

// --- JSON Schema (mirror of GapReportSchema in src/lib/ai/gap-report.ts) ---
function scoreSchema(extraReq: string[] = [], extraProps: Record<string, unknown> = {}) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["score", "reasoning", ...extraReq],
    properties: {
      score: { type: "integer", minimum: 1, maximum: 5 },
      reasoning: { type: "string", minLength: 1, maxLength: 800 },
      ...extraProps,
    },
  };
}

const GAP_REPORT_TOOL = {
  type: "function" as const,
  function: {
    name: "return_gap_report",
    description: "Return the structured gap-validation report.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: [
        "problem_clarity",
        "evidence_of_demand",
        "competitor_density",
        "differentiation_angle",
        "verdict",
        "verdict_reasoning",
        "next_steps",
        "citations",
      ],
      properties: {
        problem_clarity: scoreSchema(),
        evidence_of_demand: scoreSchema(["signals"], {
          signals: {
            type: "array",
            items: { type: "string", maxLength: 300 },
            maxItems: 8,
          },
        }),
        competitor_density: scoreSchema(["examples"], {
          examples: {
            type: "array",
            items: { type: "string", maxLength: 200 },
            maxItems: 8,
          },
        }),
        differentiation_angle: scoreSchema(),
        verdict: { type: "string", enum: ["build", "kill", "iterate"] },
        verdict_reasoning: { type: "string", minLength: 20, maxLength: 1000 },
        next_steps: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: { type: "string", minLength: 3, maxLength: 200 },
        },
        citations: {
          type: "array",
          maxItems: 20,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["source", "url", "snippet"],
            properties: {
              source: { type: "string", maxLength: 40 },
              url: { type: "string", maxLength: 2000 },
              snippet: { type: "string", maxLength: 600 },
            },
          },
        },
      },
    },
  },
};

// --- Request ---------------------------------------------------------------

interface Body {
  projectId: string;
  idea: string;
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

    const { projectId, idea } = (await req.json()) as Body;
    if (!projectId || !idea?.trim()) return json({ error: "Missing input" }, 400);
    if (idea.length > 4000) return json({ error: "Idea is too long (4000 char max)" }, 400);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // --- Rate limit -------------------------------------------------------
    const sinceIso = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const { count: recentCount, error: rateErr } = await supabase
      .from("ai_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", sinceIso);
    if (rateErr) console.error("rate-limit query failed", rateErr);
    if ((recentCount ?? 0) >= RATE_MAX_REQUESTS) {
      return json(
        { error: `Rate limit: ${RATE_MAX_REQUESTS} AI requests/hour. Try again later.` },
        429,
      );
    }

    // --- Per-project token cap -------------------------------------------
    const { data: usageAgg, error: usageErr } = await supabase
      .from("ai_usage")
      .select("total_tokens")
      .eq("project_id", projectId);
    if (usageErr) console.error("usage query failed", usageErr);
    const projectTokens = (usageAgg ?? []).reduce(
      (s: number, r) => s + ((r as { total_tokens?: number }).total_tokens ?? 0),
      0,
    );
    if (projectTokens >= PROJECT_TOKEN_CAP) {
      return json(
        {
          error: `This project has hit its AI token cap (${PROJECT_TOKEN_CAP.toLocaleString()}). Start a new project or contact support.`,
        },
        402,
      );
    }

    // --- v2: retrieve grounded evidence ----------------------------------
    let evidenceText: string | null = null;
    const citationsHint: { source: string; url: string; snippet: string }[] = [];
    try {
      const embedResp = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/text-embedding-3-small",
          input: idea.trim(),
        }),
      });
      if (embedResp.ok) {
        const embedData = await embedResp.json();
        const embedding = embedData?.data?.[0]?.embedding as number[] | undefined;
        if (embedding && Array.isArray(embedding)) {
          const { data: matches } = await supabase.rpc("match_evidence", {
            query_embedding: embedding,
            match_count: RAG_TOP_K,
            filter_project: projectId,
          });
          if (matches && Array.isArray(matches) && matches.length > 0) {
            const lines: string[] = [];
            for (const m of matches as {
              source: string;
              url: string;
              content: string;
            }[]) {
              citationsHint.push({
                source: m.source,
                url: m.url,
                snippet: m.content.slice(0, 600),
              });
              lines.push(`[${m.source}] ${m.url}\n${m.content.slice(0, 600)}`);
            }
            evidenceText = lines.join("\n\n");
          }
        }
      }
    } catch (e) {
      console.warn("RAG retrieval skipped:", e);
    }

    const userMessage = evidenceText
      ? `Idea: ${idea.trim()}\n\nRetrieved evidence (use these to ground your claims; cite the ones you actually use in the citations field):\n\n${evidenceText}`
      : `Idea: ${idea.trim()}\n\nNo retrieved evidence is available for this run. Score conservatively and say so in your reasoning where relevant.`;

    // --- Call the model ---------------------------------------------------
    const model = "google/gemini-2.5-pro";
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: RUBRIC },
      ...FEW_SHOT,
      { role: "user", content: userMessage },
    ];

    const requestBody = {
      model,
      messages,
      tools: [GAP_REPORT_TOOL],
      tool_choice: { type: "function", function: { name: "return_gap_report" } },
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
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
    const tc = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) return json({ error: "Model did not return a structured report" }, 500);

    let report: Record<string, unknown>;
    try {
      report = JSON.parse(tc.function.arguments);
    } catch (e) {
      console.error("bad tool arguments", e, tc.function.arguments);
      return json({ error: "Model returned invalid JSON" }, 500);
    }

    const usage = data?.usage ?? {};
    const promptTokens = Number(usage.prompt_tokens ?? 0);
    const completionTokens = Number(usage.completion_tokens ?? 0);
    const totalTokens = Number(usage.total_tokens ?? promptTokens + completionTokens);

    // Some models occasionally omit a citations array even when forced — pad it.
    if (!Array.isArray(report.citations)) {
      report.citations = citationsHint;
    }

    // --- Persist ----------------------------------------------------------
    const insertRow = {
      project_id: projectId,
      user_id: user.id,
      idea: idea.trim(),
      problem_clarity: report.problem_clarity,
      evidence_of_demand: report.evidence_of_demand,
      competitor_density: report.competitor_density,
      differentiation_angle: report.differentiation_angle,
      verdict: report.verdict,
      verdict_reasoning: report.verdict_reasoning,
      next_steps: report.next_steps,
      citations: report.citations,
      model,
      raw_request: requestBody,
      raw_response: data,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
    };

    const { data: row, error: insertErr } = await supabase
      .from("gap_reports")
      .insert(insertRow)
      .select()
      .single();
    if (insertErr) {
      console.error("gap_reports insert failed", insertErr);
      return json({ error: insertErr.message }, 500);
    }

    // Best-effort usage ledger (don't fail the request if this errors).
    const { error: usageInsertErr } = await supabase.from("ai_usage").insert({
      user_id: user.id,
      project_id: projectId,
      function_name: "gapfriend-validate",
      model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
    });
    if (usageInsertErr) console.warn("ai_usage insert failed", usageInsertErr);

    return json({ report: row });
  } catch (e) {
    console.error("validate error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
