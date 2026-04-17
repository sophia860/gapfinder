// Synthetic customer simulator: given idea + persona, return reactions, objections, hooks, verdict
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, 500);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { projectId, idea, persona } = await req.json();
    if (!projectId || !idea) return json({ error: "Missing input" }, 400);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You roleplay 3 distinct synthetic customers from the given persona. Be honest, specific, and plausible. Include genuine objections. End with a verdict.",
          },
          {
            role: "user",
            content: `Idea: ${idea}\nPersona: ${persona ?? "the project's stated target persona"}\n\nReact as 3 different individuals. Then give the founder honest objections, suggested hooks, and a verdict.`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_simulation",
            description: "Return the customer simulation result.",
            parameters: {
              type: "object",
              properties: {
                reactions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      reaction: { type: "string" },
                      would_pay: { type: "boolean" },
                    },
                    required: ["name", "reaction", "would_pay"],
                    additionalProperties: false,
                  },
                },
                objections: { type: "string" },
                hooks: { type: "string" },
                verdict: { type: "string", enum: ["strong", "needs_work", "kill"] },
                recommendation: { type: "string" },
              },
              required: ["reactions", "objections", "hooks", "verdict", "recommendation"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_simulation" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return json({ error: "Rate limited" }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: "AI error" }, 500);
    }

    const data = await aiResp.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) return json({ error: "No simulation returned" }, 500);
    const result = JSON.parse(tc.function.arguments);

    const { data: row, error } = await supabase
      .from("simulations")
      .insert({
        project_id: projectId,
        idea,
        persona: persona ?? null,
        reactions: result.reactions,
        objections: result.objections,
        hooks: result.hooks,
        verdict: result.verdict,
        recommendation: result.recommendation,
      })
      .select()
      .single();
    if (error) throw error;

    return json({ simulation: row });
  } catch (e) {
    console.error("simulate error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
