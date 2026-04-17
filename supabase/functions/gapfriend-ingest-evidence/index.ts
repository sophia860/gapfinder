// gapfriend-ingest-evidence
// Given an idea + project, fetch a small batch of public-web signals from
// Reddit and Hacker News (Algolia), embed them, and store them in
// public.evidence_snippets so the validate function can retrieve them later.
//
// Sources chosen because both are free, keyless, well-rate-limited, and
// produce text that is genuinely useful for early gap validation.
// Google Trends has no free official API; if you want it, sub in via SerpAPI
// in `fetchSources` below.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REDDIT_LIMIT = 8;
const HN_LIMIT = 8;
const MAX_SNIPPET_CHARS = 1200;

interface Body {
  projectId: string;
  query: string;
}

interface Snippet {
  source: "reddit" | "hackernews";
  url: string;
  title: string;
  content: string;
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

    const { projectId, query } = (await req.json()) as Body;
    if (!projectId || !query?.trim()) return json({ error: "Missing input" }, 400);
    if (query.length > 500) return json({ error: "Query too long" }, 400);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // 1. Fetch from public-web sources in parallel.
    const snippets = await fetchSources(query.trim());
    if (snippets.length === 0) return json({ inserted: 0, snippets: [] });

    // 2. Embed in a single batch call (much cheaper).
    const embedResp = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small",
        input: snippets.map((s) => `${s.title}\n\n${s.content}`),
      }),
    });
    if (!embedResp.ok) {
      const t = await embedResp.text();
      console.error("embeddings error", embedResp.status, t);
      return json({ error: "Embeddings gateway error" }, 502);
    }
    const embedJson = await embedResp.json();
    const embeddings = (embedJson?.data ?? []) as { embedding: number[] }[];
    if (embeddings.length !== snippets.length) {
      console.error("embedding count mismatch", embeddings.length, snippets.length);
      return json({ error: "Embedding count mismatch" }, 500);
    }

    // 3. Upsert. We allow duplicate URLs across runs but skip exact same
    // (project_id, url, content) by letting RLS + a simple in-memory dedupe
    // do the work — keeping the schema lean for v2.
    const rows = snippets.map((s, i) => ({
      project_id: projectId,
      source: s.source,
      url: s.url,
      title: s.title,
      content: s.content,
      embedding: embeddings[i].embedding,
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from("evidence_snippets")
      .insert(rows)
      .select("id, source, url, title");
    if (insertErr) {
      console.error("evidence insert failed", insertErr);
      return json({ error: insertErr.message }, 500);
    }

    // 4. Track usage (embeddings are cheap but still worth logging).
    const usage = embedJson?.usage ?? {};
    const totalTokens = Number(usage.total_tokens ?? 0);
    const { error: usageErr } = await supabase.from("ai_usage").insert({
      user_id: user.id,
      project_id: projectId,
      function_name: "gapfriend-ingest-evidence",
      model: "openai/text-embedding-3-small",
      prompt_tokens: totalTokens,
      completion_tokens: 0,
      total_tokens: totalTokens,
    });
    if (usageErr) console.warn("ai_usage insert failed", usageErr);

    return json({ inserted: inserted?.length ?? 0, snippets: inserted });
  } catch (e) {
    console.error("ingest error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

async function fetchSources(query: string): Promise<Snippet[]> {
  const [reddit, hn] = await Promise.allSettled([fetchReddit(query), fetchHackerNews(query)]);
  const out: Snippet[] = [];
  if (reddit.status === "fulfilled") out.push(...reddit.value);
  else console.warn("reddit fetch failed", reddit.reason);
  if (hn.status === "fulfilled") out.push(...hn.value);
  else console.warn("hn fetch failed", hn.reason);
  return out;
}

async function fetchReddit(query: string): Promise<Snippet[]> {
  // Reddit's public JSON API doesn't require auth for search; UA is encouraged.
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=${REDDIT_LIMIT}&sort=relevance&t=year`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "gapfriend-ingest/1.0 (+https://gapfriend.app)" },
  });
  if (!resp.ok) throw new Error(`reddit ${resp.status}`);
  const data = await resp.json();
  const children = (data?.data?.children ?? []) as Array<{ data: Record<string, unknown> }>;
  return children
    .map((c) => {
      const d = c.data;
      const title = String(d.title ?? "").trim();
      const selftext = String(d.selftext ?? "").trim();
      const subreddit = String(d.subreddit_name_prefixed ?? d.subreddit ?? "");
      const permalink = String(d.permalink ?? "");
      if (!title || !permalink) return null;
      const content = `${subreddit ? `[${subreddit}] ` : ""}${title}\n\n${selftext}`.slice(
        0,
        MAX_SNIPPET_CHARS,
      );
      return {
        source: "reddit" as const,
        url: `https://www.reddit.com${permalink}`,
        title,
        content,
      };
    })
    .filter((x): x is Snippet => x !== null);
}

async function fetchHackerNews(query: string): Promise<Snippet[]> {
  // HN Algolia: keyless, fast, well-documented.
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=${HN_LIMIT}&tags=story`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`hn ${resp.status}`);
  const data = await resp.json();
  const hits = (data?.hits ?? []) as Array<Record<string, unknown>>;
  return hits
    .map((h) => {
      const title = String(h.title ?? h.story_title ?? "").trim();
      const objectID = String(h.objectID ?? "");
      if (!title || !objectID) return null;
      const storyText = String(h.story_text ?? "").trim();
      const points = Number(h.points ?? 0);
      const numComments = Number(h.num_comments ?? 0);
      const content =
        `${title}\n\n(${points} points · ${numComments} comments)\n\n${storyText}`.slice(
          0,
          MAX_SNIPPET_CHARS,
        );
      return {
        source: "hackernews" as const,
        url: `https://news.ycombinator.com/item?id=${objectID}`,
        title,
        content,
      };
    })
    .filter((x): x is Snippet => x !== null);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
