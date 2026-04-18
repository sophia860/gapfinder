// Founder Mirror agent — drains the user's signal queue and updates their genome
// via Lovable AI tool-calling. Auth required (verify_jwt = true by default).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Genome = {
  decision_style: string | null;
  risk_appetite: number;
  core_values: string[];
  energy_pattern: string | null;
  strengths: string[];
  blind_spots: string[];
  past_outcomes: { title: string; lesson: string; at: string }[];
  narrative: string | null;
  confidence: number;
};

const TOOL = {
  type: "function",
  function: {
    name: "update_founder_genome",
    description:
      "Refine the founder's living genome based on the latest signals. Make small, additive updates. Be calm, editorial, no hype.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        decision_style: { type: ["string", "null"], description: "1 sentence — how they decide (e.g. 'evidence-first, slow-to-commit')" },
        risk_appetite: { type: "number", minimum: 0, maximum: 1 },
        core_values: { type: "array", items: { type: "string" }, maxItems: 6 },
        energy_pattern: { type: ["string", "null"], description: "1 short phrase — when/how they do their best work" },
        strengths: { type: "array", items: { type: "string" }, maxItems: 6 },
        blind_spots: { type: "array", items: { type: "string" }, maxItems: 6 },
        new_outcome: {
          type: ["object", "null"],
          properties: {
            title: { type: "string" },
            lesson: { type: "string" },
          },
          required: ["title", "lesson"],
          additionalProperties: false,
        },
        narrative: {
          type: ["string", "null"],
          description: "2-3 sentences, third person, calm and observational. The founder's working portrait.",
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
      required: [
        "decision_style", "risk_appetite", "core_values", "energy_pattern",
        "strengths", "blind_spots", "new_outcome", "narrative", "confidence",
      ],
    },
  },
};

function defaultGenome(): Genome {
  return {
    decision_style: null,
    risk_appetite: 0.5,
    core_values: [],
    energy_pattern: null,
    strengths: [],
    blind_spots: [],
    past_outcomes: [],
    narrative: null,
    confidence: 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    // Verify the user via their JWT
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    // Service-role client for queue + genome writes (RLS bypass)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json().catch(() => ({}));
    const reframeProjectId = typeof body.reframe_project_id === "string" ? body.reframe_project_id : null;
    const manualOutcome =
      body.outcome && typeof body.outcome.title === "string" && typeof body.outcome.lesson === "string"
        ? { title: String(body.outcome.title).slice(0, 200), lesson: String(body.outcome.lesson).slice(0, 600) }
        : null;

    // Ensure mirror row
    let { data: mirror } = await admin
      .from("founder_mirrors")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!mirror) {
      const ins = await admin
        .from("founder_mirrors")
        .insert({ user_id: userId })
        .select("*")
        .single();
      if (ins.error) throw ins.error;
      mirror = ins.data;
    }

    const currentGenome: Genome = { ...defaultGenome(), ...(mirror.genome ?? {}) };

    // Pull unprocessed signals (cap to keep prompt small)
    const { data: signals } = await admin
      .from("founder_mirror_signals")
      .select("id, kind, payload, project_id, created_at")
      .eq("user_id", userId)
      .is("processed_at", null)
      .order("created_at", { ascending: true })
      .limit(40);

    // Manual outcome → also persist as a signal
    if (manualOutcome) {
      await admin.from("founder_mirror_signals").insert({
        user_id: userId,
        kind: "outcome",
        payload: manualOutcome,
      });
    }

    // Optional reframe context
    let reframeContext = "";
    if (reframeProjectId) {
      const { data: proj } = await admin
        .from("projects")
        .select("working_name, tagline, description")
        .eq("id", reframeProjectId)
        .eq("user_id", userId)
        .maybeSingle();
      if (proj) {
        reframeContext = `\n\nCurrent project under consideration: ${proj.working_name}${proj.tagline ? " — " + proj.tagline : ""}.${proj.description ? "\n" + proj.description : ""}`;
      }
    }

    const haveSignals = (signals && signals.length > 0) || manualOutcome;
    let updatedGenome = currentGenome;
    let mirrorReply: string | null = null;

    if (haveSignals) {
      const systemPrompt = `You are the Founder Mirror — a calm, editorial inner reflection of one builder.
You maintain a small JSON "genome" describing how they work. Update it gently from new signals.
Rules:
- Make small additive changes. Do not overwrite values you have no evidence for; pass through existing values.
- Confidence rises slowly with more signals (cap at 0.9).
- Tone: observational, third-person, no hype, no exclamation marks.
- If a signal reveals a clear lesson or outcome, add it via new_outcome.
- Keep arrays trimmed to the most representative entries.`;

      const userPrompt = `Existing genome:\n${JSON.stringify(currentGenome, null, 2)}\n\nNew signals (oldest first):\n${JSON.stringify(
        [
          ...(signals ?? []).map((s) => ({ kind: s.kind, at: s.created_at, ...s.payload })),
          ...(manualOutcome ? [{ kind: "outcome", ...manualOutcome }] : []),
        ],
        null,
        2,
      )}\n\nReturn an updated genome via the tool.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [TOOL],
          tool_choice: { type: "function", function: { name: "update_founder_genome" } },
        }),
      });

      if (aiRes.status === 429) return json({ error: "Rate limited, try again shortly." }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted." }, 402);
      if (!aiRes.ok) {
        const t = await aiRes.text();
        console.error("AI error", aiRes.status, t);
        return json({ error: "AI gateway error" }, 500);
      }

      const aiJson = await aiRes.json();
      const call = aiJson.choices?.[0]?.message?.tool_calls?.[0];
      if (call?.function?.arguments) {
        try {
          const args = JSON.parse(call.function.arguments);
          const next: Genome = {
            decision_style: args.decision_style ?? currentGenome.decision_style,
            risk_appetite:
              typeof args.risk_appetite === "number"
                ? Math.max(0, Math.min(1, args.risk_appetite))
                : currentGenome.risk_appetite,
            core_values: Array.isArray(args.core_values) ? args.core_values.slice(0, 6) : currentGenome.core_values,
            energy_pattern: args.energy_pattern ?? currentGenome.energy_pattern,
            strengths: Array.isArray(args.strengths) ? args.strengths.slice(0, 6) : currentGenome.strengths,
            blind_spots: Array.isArray(args.blind_spots) ? args.blind_spots.slice(0, 6) : currentGenome.blind_spots,
            past_outcomes: currentGenome.past_outcomes,
            narrative: args.narrative ?? currentGenome.narrative,
            confidence:
              typeof args.confidence === "number"
                ? Math.max(currentGenome.confidence, Math.min(0.9, args.confidence))
                : currentGenome.confidence,
          };
          if (args.new_outcome?.title && args.new_outcome?.lesson) {
            next.past_outcomes = [
              { title: args.new_outcome.title, lesson: args.new_outcome.lesson, at: new Date().toISOString() },
              ...currentGenome.past_outcomes,
            ].slice(0, 12);
          }
          updatedGenome = next;
        } catch (e) {
          console.error("tool args parse failed", e);
        }
      }

      // Persist updated genome + bump signal_count + mark signals processed
      const newCount = (mirror.signal_count ?? 0) + (signals?.length ?? 0) + (manualOutcome ? 1 : 0);
      await admin
        .from("founder_mirrors")
        .update({
          genome: updatedGenome,
          signal_count: newCount,
          last_synthesized_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (signals && signals.length > 0) {
        await admin
          .from("founder_mirror_signals")
          .update({ processed_at: new Date().toISOString() })
          .in(
            "id",
            signals.map((s) => s.id),
          );
      }
    }

    // Reframe pass — short, separate completion
    if (reframeProjectId) {
      const reRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                "You are the Founder Mirror. In 3-4 calm, editorial sentences (third person, no hype), say what this founder's genome implies about the current project — what suits them, what to watch.",
            },
            {
              role: "user",
              content: `Genome:\n${JSON.stringify(updatedGenome, null, 2)}${reframeContext}`,
            },
          ],
        }),
      });
      if (reRes.ok) {
        const j = await reRes.json();
        mirrorReply = j.choices?.[0]?.message?.content ?? null;
      }
    }

    return json({
      ok: true,
      genome: updatedGenome,
      processed: signals?.length ?? 0,
      reframe: mirrorReply,
    });
  } catch (e) {
    console.error("founder-mirror-agent error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
