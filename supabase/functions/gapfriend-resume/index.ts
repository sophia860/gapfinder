// gapfriend-resume — generates a short, plain-language "where you left off" note
// for a project, so context-switching brains can re-enter without re-reading
// everything. Stored on projects.resume_note + projects.resume_note_updated_at.
//
// Mirrors the AI gateway pattern used by other functions (Lovable AI Gateway) —
// see supabase/functions/gapfriend-chat/index.ts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are GapFriend writing a short "where you left off" note for the user when they re-open a project.

Voice: warm, plain words, second person ("you"), no jargon, no hype, no emojis. Calm and non-judgmental — the user may have been away for hours, days, or weeks.

OUTPUT RULES:
- 2 to 4 short sentences. Total 60 words or fewer.
- Sentence 1: where the project actually is right now (e.g. "You picked the gap about X and started a brief.").
- Sentence 2: the single most useful next thing they could do (concrete, small).
- Optional sentence 3: one tiny encouraging note, only if it's true.
- Never invent facts. If something is missing, just say so plainly.
- Plain text only. No markdown, no bullets, no headings.`;

interface Body {
  projectId: string;
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

    const { projectId } = (await req.json()) as Body;
    if (!projectId) return json({ error: "Missing projectId" }, 400);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // RLS will scope these queries to the authenticated user.
    const [projectR, briefR, gapsR, identityR, tasksR, historyR] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
      supabase.from("opportunity_briefs").select("*").eq("project_id", projectId).maybeSingle(),
      supabase.from("gap_cards").select("title,status,problem").eq("project_id", projectId),
      supabase.from("identity").select("*").eq("project_id", projectId).maybeSingle(),
      supabase
        .from("tasks")
        .select("title,column_name")
        .eq("project_id", projectId)
        .order("position", { ascending: true }),
      supabase
        .from("chat_messages")
        .select("role,content,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    if (!projectR.data) return json({ error: "Project not found" }, 404);

    const ctx = {
      project: {
        working_name: projectR.data.working_name,
        tagline: projectR.data.tagline,
        description: projectR.data.description,
        updated_at: projectR.data.updated_at,
      },
      opportunity_brief: briefR.data,
      gap_cards: gapsR.data,
      identity: identityR.data,
      tasks: tasksR.data,
      recent_chat: (historyR.data ?? []).reverse(),
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Project state (JSON):\n${JSON.stringify(ctx, null, 2)}\n\nWrite the short "where you left off" note now.`,
          },
        ],
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
    const note = (data.choices?.[0]?.message?.content ?? "").toString().trim();
    if (!note) return json({ error: "Empty AI response" }, 500);

    const now = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("projects")
      .update({ resume_note: note, resume_note_updated_at: now })
      .eq("id", projectId);
    if (updErr) {
      console.error("update error", updErr);
      return json({ error: updErr.message }, 500);
    }

    return json({ note, resume_note_updated_at: now });
  } catch (e) {
    console.error("resume error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
