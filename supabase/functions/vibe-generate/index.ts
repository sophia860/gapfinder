// Vibe Coding: AI-powered website/app generation
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a skilled web developer creating websites and web apps from natural language descriptions.

Generate clean, modern, production-ready HTML/CSS/JavaScript code.

Key principles:
- Use semantic HTML5
- Modern CSS (flexbox, grid, custom properties)
- Vanilla JavaScript for interactivity (no frameworks unless specifically requested)
- Responsive design (mobile-first)
- Accessibility (proper ARIA labels, semantic markup)
- Clean, readable code with comments

When given a project brief and identity, incorporate:
- Brand name and tagline
- Target persona and their needs
- Visual style matching the project's tone
- Appropriate CTAs and messaging

Output format: JSON array of files
[
  { "path": "index.html", "content": "...", "mime": "text/html" },
  { "path": "styles.css", "content": "...", "mime": "text/css" },
  { "path": "script.js", "content": "...", "mime": "application/javascript" }
]

Always include at least index.html. Add separate CSS and JS files as needed.
Use inline styles only for quick prototypes. Prefer external stylesheets for production.`;

interface Body {
  vibe_project_id?: string;
  project_id: string;
  prompt: string;
  kind: "website" | "webapp" | "landing";
  seed_from_project?: boolean;
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI is not configured" }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { vibe_project_id, project_id, prompt, kind, seed_from_project } = (await req.json()) as Body;
    if (!project_id || !prompt?.trim()) return json({ error: "Missing input" }, 400);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // Load project context if seeding
    let contextPrompt = prompt;
    if (seed_from_project) {
      const [briefR, identityR, projectR] = await Promise.all([
        supabase.from("opportunity_briefs").select("*").eq("project_id", project_id).maybeSingle(),
        supabase.from("identity").select("*").eq("project_id", project_id).maybeSingle(),
        supabase.from("projects").select("*").eq("id", project_id).maybeSingle(),
      ]);

      const brief = briefR.data;
      const identity = identityR.data;
      const project = projectR.data;

      if (brief && identity) {
        contextPrompt = `Create a ${kind} for "${identity.chosen_name || project?.working_name}".
Tagline: ${identity.tagline || ""}
Positioning: ${identity.positioning || ""}
Target persona: ${brief.persona || ""}
Problem: ${brief.problem || ""}
Angle: ${brief.angle || ""}
Business model: ${brief.business_model || ""}

User request: ${prompt}`;
      }
    }

    // Call AI to generate files
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contextPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI error:", errorText);
      return json({ error: "AI generation failed" }, 500);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) return json({ error: "No response from AI" }, 500);

    let filesData: { files?: Array<{ path: string; content: string; mime?: string }> };
    try {
      filesData = JSON.parse(content);
    } catch {
      // If AI didn't return JSON, assume it's just HTML
      filesData = { files: [{ path: "index.html", content, mime: "text/html" }] };
    }

    const files = filesData.files || [];
    if (files.length === 0) {
      return json({ error: "No files generated" }, 500);
    }

    // Create or get vibe_project
    let vibeProjectId = vibe_project_id;
    if (!vibeProjectId) {
      const { data: existingVP } = await supabase
        .from("vibe_projects")
        .select("id")
        .eq("project_id", project_id)
        .maybeSingle();

      if (existingVP) {
        vibeProjectId = existingVP.id;
      } else {
        const { data: newVP, error: vpErr } = await supabase
          .from("vibe_projects")
          .insert({ project_id, kind })
          .select()
          .single();
        if (vpErr) throw vpErr;
        vibeProjectId = newVP.id;
      }
    }

    // Create new version
    const { data: version, error: versionErr } = await supabase
      .from("vibe_versions")
      .insert({
        vibe_project_id: vibeProjectId,
        prompt: contextPrompt,
        summary: `Generated ${kind} from prompt`,
        created_by: user.id,
      })
      .select()
      .single();

    if (versionErr) throw versionErr;

    // Insert files
    const fileInserts = files.map((f) => ({
      version_id: version.id,
      path: f.path,
      content: f.content,
      mime: f.mime || "text/plain",
    }));

    const { error: filesErr } = await supabase.from("vibe_files").insert(fileInserts);
    if (filesErr) throw filesErr;

    // Update vibe_project to point to this version
    await supabase
      .from("vibe_projects")
      .update({ current_version_id: version.id })
      .eq("id", vibeProjectId);

    // Save message to vibe_messages
    await supabase.from("vibe_messages").insert([
      { vibe_project_id: vibeProjectId, role: "user", content: prompt },
      {
        vibe_project_id: vibeProjectId,
        role: "assistant",
        content: `Generated ${files.length} file(s) for your ${kind}.`,
      },
    ]);

    return json({ success: true, version_id: version.id, files: files.length });
  } catch (err) {
    console.error("Error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
