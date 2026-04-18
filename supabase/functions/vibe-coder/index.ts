// Vibe Coder Edge Function — Deno + LangGraph stateful code generation
// Invoked from TanStack server function for cost-controlled, SSR-safe LLM calls
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VibeProfile {
  energy: "calm" | "creative" | "execution";
  colors: string[];
  fonts: string[];
  tone_keywords: string[];
  past_patterns: string[];
}

interface VibeCoderRequest {
  projectId: string;
  prompt: string;
  checkpointId?: string | null;
  vibeProfile: VibeProfile;
}

// Simple stateful message history stored per checkpoint in coding_sessions
const buildSystemPrompt = (vibeProfile: VibeProfile): string => `
You are Truara's calm AI pair programmer — a vibe coder.
You write clean, sustainable, production-ready code that embodies the founder's energy.

Founder vibe profile (never deviate from this):
- Energy mode: ${vibeProfile.energy}
- Color palette: ${vibeProfile.colors.join(", ")}
- Typography: ${vibeProfile.fonts.join(", ")} (serif display fonts preferred for headings)
- Tone keywords: ${vibeProfile.tone_keywords.join(", ")}
- Successful past patterns: ${vibeProfile.past_patterns.join(", ")}

Code principles:
- Use Tailwind v4 utility classes with terracotta accents (#c2410f, #e8d5c0)
- Serif fonts for display headings (font-serif), monospace for code
- Warm editorial aesthetic — calm, never cluttered
- Output ONLY clean TypeScript/TSX code with brief inline comments
- No markdown fences, no explanations outside the code
`.trim();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { projectId, prompt, checkpointId, vibeProfile } =
      (await req.json()) as VibeCoderRequest;

    // Load message history from prior session if resuming
    let messageHistory: Array<{ role: string; content: string }> = [];
    if (checkpointId) {
      const { data: session } = await supabase
        .from("coding_sessions")
        .select("session_vibe_snapshot")
        .eq("checkpoint_id", checkpointId)
        .eq("project_id", projectId)
        .maybeSingle();

      if (session?.session_vibe_snapshot?.messages) {
        messageHistory = session.session_vibe_snapshot.messages;
      }
    }

    // Build messages array with full conversation history
    const messages = [
      { role: "system", content: buildSystemPrompt(vibeProfile) },
      ...messageHistory,
      { role: "user", content: prompt },
    ];

    // Call OpenAI gpt-4o-mini (cost-efficient, fast)
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    const openaiData = await openaiRes.json();
    const generatedCode =
      openaiData.choices?.[0]?.message?.content ?? "// No output generated";

    // Persist checkpoint: append assistant reply to message history
    const newMessages = [
      ...messageHistory,
      { role: "user", content: prompt },
      { role: "assistant", content: generatedCode },
    ];

    const newCheckpointId =
      checkpointId || `vibe-${projectId}-${Date.now()}`;

    // Upsert coding session (idempotent on checkpoint_id)
    await supabase.from("coding_sessions").upsert(
      {
        project_id: projectId,
        checkpoint_id: newCheckpointId,
        session_vibe_snapshot: {
          vibeProfile,
          messages: newMessages,
        },
      },
      { onConflict: "checkpoint_id" }
    );

    // Also upsert vibe profile for longitudinal memory
    const { data: existingVibe } = await supabase
      .from("project_vibes")
      .select("id")
      .eq("project_id", projectId)
      .maybeSingle();

    if (existingVibe) {
      await supabase
        .from("project_vibes")
        .update({ vibe_profile: vibeProfile, updated_at: new Date().toISOString() })
        .eq("project_id", projectId);
    } else {
      await supabase.from("project_vibes").insert({
        project_id: projectId,
        vibe_profile: vibeProfile,
      });
    }

    return new Response(
      JSON.stringify({ code: generatedCode, newCheckpointId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("vibe-coder error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
