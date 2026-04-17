// Content helper: turn a draft into SEO long-form + a numbered thread
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { global: { headers: { Authorization: authHeader } } });

    const { projectId, draft, title } = await req.json();
    if (!projectId || !draft) return json({ error: "Missing input" }, 400);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an editor. Turn rough drafts into clean SEO long-form prose AND a punchy 6-frame thread. Honest, specific, never hyped." },
          { role: "user", content: `Title hint: ${title ?? "(none)"}\n\nDraft:\n${draft}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_content",
            description: "Return SEO version and thread frames.",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                seo_version: { type: "string", description: "Clean SEO long-form markdown, 200-500 words." },
                thread_frames: {
                  type: "array",
                  items: { type: "string" },
                  description: "6 short, sequential thread posts (max ~250 chars each).",
                },
              },
              required: ["title", "seo_version", "thread_frames"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_content" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return json({ error: "Rate limited" }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: "AI error" }, 500);
    }

    const data = await aiResp.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) return json({ error: "No content returned" }, 500);
    const out = JSON.parse(tc.function.arguments);

    const { data: row, error } = await supabase
      .from("content_pieces")
      .insert({
        project_id: projectId,
        title: out.title,
        source_text: draft,
        seo_version: out.seo_version,
        thread_frames: out.thread_frames,
      })
      .select()
      .single();
    if (error) throw error;

    return json({ piece: row });
  } catch (e) {
    console.error("content error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
