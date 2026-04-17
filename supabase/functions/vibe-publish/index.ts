// Vibe Publish: Mark a version as published
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  vibe_project_id: string;
  version_id: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_KEY =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { vibe_project_id, version_id } = (await req.json()) as Body;
    if (!vibe_project_id || !version_id) return json({ error: "Missing input" }, 400);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // Update the vibe project to mark this version as published
    const { data, error } = await supabase
      .from("vibe_projects")
      .update({ published_version_id: version_id })
      .eq("id", vibe_project_id)
      .select()
      .single();

    if (error) throw error;

    // In a real implementation, this would:
    // 1. Package the files into a static bundle
    // 2. Upload to a CDN or hosting service
    // 3. Generate a shareable URL (e.g., https://vibe.gapfriend.app/<slug>)
    // For v1, we just mark it as published

    return json({
      success: true,
      message: "Version published successfully",
      // Placeholder URL - replace with actual deployment URL in production
      url: `https://vibe.gapfriend.app/${vibe_project_id}/${version_id}`,
    });
  } catch (err) {
    console.error("Error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
