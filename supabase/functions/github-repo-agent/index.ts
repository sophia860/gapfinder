// GitHub Repo Agent — connect a repo via PAT, list repos, and ship a feature
// as a real multi-file PR using the GitHub REST API.
//
// Actions:
//   { action: "connect_pat", token, repo_full_name? }
//   { action: "list_repos" }
//   { action: "set_repo", repo_full_name }
//   { action: "disconnect" }
//   { action: "status" }
//   { action: "ship_feature", projectId, prompt? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GH = "https://api.github.com";

function gh(token: string) {
  return async (path: string, init: RequestInit = {}) => {
    const res = await fetch(path.startsWith("http") ? path : `${GH}${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "truara-repo-agent",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    let body: unknown = text;
    try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
    if (!res.ok) {
      const msg = (body as { message?: string })?.message ?? `GitHub ${res.status}`;
      throw new Error(`GitHub: ${msg}`);
    }
    return body as never;
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64(s: string) {
  return btoa(unescape(encodeURIComponent(s)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    // --- helpers ---
    async function loadConn() {
      const { data } = await admin
        .from("user_github_connections")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data as
        | {
            access_token: string | null;
            github_login: string | null;
            repo_full_name: string | null;
            default_branch: string | null;
            auth_kind: string;
            last_synced_at: string | null;
          }
        | null;
    }

    function publicConn(c: Awaited<ReturnType<typeof loadConn>>) {
      if (!c) return null;
      // Never leak the token
      return {
        connected: !!c.access_token,
        github_login: c.github_login,
        repo_full_name: c.repo_full_name,
        default_branch: c.default_branch,
        auth_kind: c.auth_kind,
        last_synced_at: c.last_synced_at,
      };
    }

    // --- actions ---
    if (action === "status") {
      return json({ connection: publicConn(await loadConn()) });
    }

    if (action === "disconnect") {
      await admin.from("user_github_connections").delete().eq("user_id", user.id);
      return json({ ok: true });
    }

    if (action === "connect_pat") {
      const token = (body.token as string)?.trim();
      if (!token || token.length < 20) return json({ error: "Token looks invalid" }, 400);
      const api = gh(token);
      const me = await api("/user") as { login: string };
      const upsert = {
        user_id: user.id,
        auth_kind: "pat" as const,
        access_token: token,
        github_login: me.login,
        repo_full_name: (body.repo_full_name as string) ?? null,
        last_synced_at: new Date().toISOString(),
      };
      const { error } = await admin
        .from("user_github_connections")
        .upsert(upsert, { onConflict: "user_id" });
      if (error) return json({ error: error.message }, 500);
      return json({ connection: publicConn(await loadConn()) });
    }

    const conn = await loadConn();
    if (!conn?.access_token) return json({ error: "Not connected" }, 400);
    const api = gh(conn.access_token);

    if (action === "list_repos") {
      const repos = await api(
        "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
      ) as { full_name: string; private: boolean; default_branch: string; updated_at: string }[];
      return json({
        repos: repos.map((r) => ({
          full_name: r.full_name,
          private: r.private,
          default_branch: r.default_branch,
          updated_at: r.updated_at,
        })),
      });
    }

    if (action === "set_repo") {
      const repo_full_name = body.repo_full_name as string;
      if (!repo_full_name?.includes("/")) return json({ error: "Invalid repo" }, 400);
      const r = await api(`/repos/${repo_full_name}`) as { default_branch: string };
      await admin.from("user_github_connections").update({
        repo_full_name,
        default_branch: r.default_branch,
        last_synced_at: new Date().toISOString(),
      }).eq("user_id", user.id);
      return json({ connection: publicConn(await loadConn()) });
    }

    if (action === "ship_feature") {
      if (!conn.repo_full_name) return json({ error: "Pick a repo first" }, 400);
      const projectId = body.projectId as string;
      const userPrompt = (body.prompt as string) ?? "";

      // Pull project context + mirror genome for personalization
      const [{ data: project }, { data: mirror }, { data: brief }] = await Promise.all([
        admin.from("projects").select("working_name, tagline, description").eq("id", projectId).maybeSingle(),
        admin.from("founder_mirrors").select("genome").eq("user_id", user.id).maybeSingle(),
        admin.from("opportunity_briefs").select("*").eq("project_id", projectId).maybeSingle(),
      ]);

      // Ask Lovable AI to plan a small, shippable PR (1–4 files, markdown/text only)
      const planTool = {
        type: "function",
        function: {
          name: "plan_pr",
          description: "Plan a small, safe, shippable PR. Prefer markdown/docs/copy edits over framework code.",
          parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
              branch: { type: "string", description: "kebab-case feature branch, no slashes" },
              title: { type: "string" },
              body_md: { type: "string", description: "PR description in markdown, calm + editorial, 4–10 lines" },
              files: {
                type: "array",
                minItems: 1,
                maxItems: 4,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    path: { type: "string", description: "Repo-relative path, e.g. docs/founder-mirror.md" },
                    content: { type: "string", description: "Full file contents (UTF-8 text)" },
                  },
                  required: ["path", "content"],
                },
              },
            },
            required: ["branch", "title", "body_md", "files"],
          },
        },
      };

      const sys = `You are a calm, editorial engineering co-founder. Produce SMALL, SAFE pull requests.
Prefer adding or updating markdown docs, READMEs, or simple text files over editing framework code.
Never touch lockfiles, .env, secrets, CI config, or generated files.
Match the founder's voice from their genome (no hype, terracotta-warm, serif-editorial).`;

      const ctx = {
        project: project ?? {},
        brief: brief ?? {},
        founder_genome: mirror?.genome ?? {},
        user_prompt: userPrompt || "Ship the most useful next artifact for this project right now.",
        repo: conn.repo_full_name,
        default_branch: conn.default_branch,
      };

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: "Plan a small PR. Context:\n" + JSON.stringify(ctx, null, 2) },
          ],
          tools: [planTool],
          tool_choice: { type: "function", function: { name: "plan_pr" } },
        }),
      });
      if (!aiRes.ok) {
        const t = await aiRes.text();
        return json({ error: `AI planner failed: ${aiRes.status} ${t}` }, 502);
      }
      const ai = await aiRes.json();
      const call = ai.choices?.[0]?.message?.tool_calls?.[0];
      if (!call) return json({ error: "AI returned no plan" }, 502);
      const plan = JSON.parse(call.function.arguments) as {
        branch: string; title: string; body_md: string;
        files: { path: string; content: string }[];
      };

      // Sanitize paths
      const FORBIDDEN = /(^\.env|^\.github\/|package-lock|bun\.lock|yarn\.lock|^node_modules\/)/i;
      const safeFiles = plan.files
        .filter((f) => f.path && !f.path.startsWith("/") && !f.path.includes("..") && !FORBIDDEN.test(f.path))
        .slice(0, 4);
      if (!safeFiles.length) return json({ error: "Planner produced no safe files" }, 422);

      const branch = `truara/${plan.branch}-${Date.now().toString(36)}`.replace(/[^a-zA-Z0-9/_-]/g, "-");
      const baseBranch = conn.default_branch ?? "main";

      // 1) Get base ref SHA
      const ref = await api(`/repos/${conn.repo_full_name}/git/ref/heads/${baseBranch}`) as { object: { sha: string } };
      const baseSha = ref.object.sha;

      // 2) Create new branch
      await api(`/repos/${conn.repo_full_name}/git/refs`, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
      });

      // 3) Commit each file (PUT contents API). Lookup existing sha if file already exists.
      let committed = 0;
      for (const f of safeFiles) {
        let existingSha: string | undefined;
        try {
          const cur = await api(
            `/repos/${conn.repo_full_name}/contents/${encodeURIComponent(f.path).replace(/%2F/g, "/")}?ref=${branch}`,
          ) as { sha?: string };
          existingSha = cur?.sha;
        } catch { /* file doesn't exist — fine */ }

        await api(
          `/repos/${conn.repo_full_name}/contents/${encodeURIComponent(f.path).replace(/%2F/g, "/")}`,
          {
            method: "PUT",
            body: JSON.stringify({
              message: `truara: ${f.path}`,
              content: b64(f.content),
              branch,
              ...(existingSha ? { sha: existingSha } : {}),
            }),
          },
        );
        committed++;
      }

      // 4) Open PR
      const pr = await api(`/repos/${conn.repo_full_name}/pulls`, {
        method: "POST",
        body: JSON.stringify({
          title: plan.title,
          head: branch,
          base: baseBranch,
          body: `${plan.body_md}\n\n---\n_Shipped by Truara from project **${project?.working_name ?? projectId}**._`,
          draft: false,
        }),
      }) as { number: number; html_url: string };

      // 5) Log shipment
      await admin.from("repo_shipments").insert({
        user_id: user.id,
        project_id: projectId,
        repo_full_name: conn.repo_full_name,
        branch_name: branch,
        pr_number: pr.number,
        pr_url: pr.html_url,
        title: plan.title,
        summary: plan.body_md.slice(0, 600),
        files_changed: committed,
        status: "opened",
      });

      return json({
        ok: true,
        pr_number: pr.number,
        pr_url: pr.html_url,
        branch,
        files_changed: committed,
      });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("github-repo-agent error", msg);
    return json({ error: msg }, 500);
  }
});
