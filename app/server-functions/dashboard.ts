// app/server-functions/dashboard.ts
//
// Truara Founder Command Center — edge-first server functions.
//
// Runtime: Cloudflare Workers (TanStack Start + @cloudflare/vite-plugin).
// No Node built-ins. All Postgres access goes through @supabase/supabase-js
// (fetch-based) so RLS enforces ownership end-to-end.
//
// Auth model:
//   * For per-user reads/writes we forward the caller's Supabase JWT via the
//     `Authorization` header on the supabase client. RLS then guarantees only
//     the authed user's rows are visible / mutable.
//   * The LangGraph runtime (src/lib/graphs/dashboard-graph.ts) uses the
//     SERVICE_ROLE key and is the only path that bypasses RLS. We never
//     return service-role data raw — the graph writes its results into the
//     same RLS-protected tables and the client re-fetches under the user JWT.
//
// Long-running ops (NL graph runs, swarm reviews, layout optimization) are
// fire-and-forget: we persist a row immediately, kick the graph in the
// background (`ctx.waitUntil` when available), and let the UI subscribe to
// realtime channels for results. The dashboard stays buttery.

import { createServerFn } from "@tanstack/react-start";
import { getWebRequest } from "@tanstack/react-start/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  runDashboardGraph,
  runSwarmReview,
  runLayoutOptimization,
  type WidgetSpec,
} from "../../src/lib/graphs/dashboard-graph";

// -------------------------------------------------------------------------
// Env access — works on Cloudflare Workers (process.env is shimmed by the
// vite plugin in dev; in prod we read from import.meta.env / globalThis).
// -------------------------------------------------------------------------
function envVar(key: string): string {
  const fromProcess = typeof process !== "undefined" && process.env ? process.env[key] : undefined;
  const fromImportMeta =
    typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env
      ? (import.meta as { env?: Record<string, string> }).env![key]
      : undefined;
  const fromGlobal = (globalThis as Record<string, unknown>)[key];
  const v =
    fromProcess ?? fromImportMeta ?? (typeof fromGlobal === "string" ? fromGlobal : undefined);
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

const SUPABASE_URL = () => envVar("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = () => envVar("VITE_SUPABASE_ANON_KEY");

// Per-request authed client. We extract the user's JWT from cookies/headers
// and pass it as the Authorization bearer so RLS sees the right auth.uid().
function authedClient(): SupabaseClient {
  const req = getWebRequest();
  const authHeader =
    req?.headers.get("authorization") ?? extractSupabaseCookie(req?.headers.get("cookie") ?? "");

  return createClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });
}

function extractSupabaseCookie(cookieHeader: string): string | null {
  // Supabase v2 sets `sb-<ref>-auth-token` as the canonical cookie. We don't
  // know the project ref at compile time, so we scan for any sb-*-auth-token.
  const m = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/);
  if (!m) return null;
  try {
    const decoded = decodeURIComponent(m[1]);
    // Cookie may be a JSON-encoded array [access_token, refresh_token, ...].
    const parsed = JSON.parse(decoded);
    const token = Array.isArray(parsed) ? parsed[0] : parsed?.access_token;
    return token ? `Bearer ${token}` : null;
  } catch {
    return `Bearer ${m[1]}`;
  }
}

async function requireUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}

// `ctx.waitUntil` is available on Cloudflare Workers via the request execution
// context. We grab it from the request if present; otherwise we fall back to
// a fire-and-forget Promise (best-effort in non-edge runtimes).
function waitUntil(promise: Promise<unknown>) {
  const req = getWebRequest() as unknown as
    | {
        cf?: { waitUntil?: (p: Promise<unknown>) => void };
        waitUntil?: (p: Promise<unknown>) => void;
      }
    | undefined;
  const fn = req?.waitUntil ?? req?.cf?.waitUntil;
  if (typeof fn === "function") {
    fn(promise.catch(() => undefined));
  } else {
    // Best-effort: detached promise. Errors are swallowed to avoid crashing
    // the worker; the persisted row carries the failure state.
    void promise.catch(() => undefined);
  }
}

// -------------------------------------------------------------------------
// Default layout — used when a founder has no saved layout yet. Calm by
// default: a small number of high-signal widgets, generous whitespace.
// -------------------------------------------------------------------------
const DEFAULT_LAYOUT = {
  version: 1,
  widgets: [
    { id: "proactive_strip", x: 0, y: 0, w: 12, h: 1 },
    { id: "revenue_trend", x: 0, y: 1, w: 6, h: 3 },
    { id: "churn", x: 6, y: 1, w: 3, h: 3 },
    { id: "velocity", x: 9, y: 1, w: 3, h: 3 },
    { id: "focus_digest", x: 0, y: 4, w: 4, h: 3 },
    { id: "burndown", x: 4, y: 4, w: 4, h: 3 },
    { id: "agent_activity", x: 8, y: 4, w: 4, h: 3 },
  ],
};

// =========================================================================
// 1. getDashboardLayout
// =========================================================================
export const getDashboardLayout = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = authedClient();
  const userId = await requireUserId(supabase);

  const { data, error } = await supabase
    .from("dashboard_layouts")
    .select("version, widgets, ai_suggested, source, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      ...DEFAULT_LAYOUT,
      source: "default" as const,
      ai_suggested: false,
    };
  }
  return data;
});

// =========================================================================
// 2. saveDashboardLayout
// =========================================================================
const layoutWidgetSchema = z.object({
  id: z.string().min(1).max(64),
  x: z.number().int().min(0).max(48),
  y: z.number().int().min(0).max(200),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(12),
  config: z.record(z.unknown()).optional(),
});

const saveLayoutSchema = z.object({
  widgets: z.array(layoutWidgetSchema).max(64),
  source: z.enum(["user", "graph", "default"]).default("user"),
  reason: z.string().max(280).optional(),
});

export const saveDashboardLayout = createServerFn({ method: "POST" })
  .validator((d: unknown) => saveLayoutSchema.parse(d))
  .handler(async ({ data }) => {
    const supabase = authedClient();
    const userId = await requireUserId(supabase);

    // Bump version monotonically.
    const { data: current } = await supabase
      .from("dashboard_layouts")
      .select("version")
      .eq("user_id", userId)
      .maybeSingle();
    const nextVersion = (current?.version ?? 0) + 1;

    const { error: upsertErr } = await supabase.from("dashboard_layouts").upsert(
      {
        user_id: userId,
        version: nextVersion,
        widgets: data.widgets,
        ai_suggested: data.source === "graph",
        source: data.source,
      },
      { onConflict: "user_id" },
    );
    if (upsertErr) throw upsertErr;

    // Append to history (audit trail for the layout optimizer).
    await supabase.from("dashboard_layout_history").insert({
      user_id: userId,
      version: nextVersion,
      widgets: data.widgets,
      source: data.source,
      accepted: true,
      reason: data.reason ?? null,
    });

    // Flywheel: every save is an interaction.
    await supabase.from("dashboard_interactions").insert({
      user_id: userId,
      kind: data.source === "graph" ? "accept" : "drag",
      target: "layout",
      payload: { version: nextVersion, source: data.source },
    });

    return { version: nextVersion };
  });

// =========================================================================
// 3. getMetricSeries
// =========================================================================
const rangeSchema = z.enum(["7d", "30d", "90d", "180d", "365d", "all"]);
const metricSeriesSchema = z.object({
  metricKey: z.string().min(1).max(120),
  range: rangeSchema.default("90d"),
  dims: z.record(z.string()).optional(),
});

function rangeToSinceIso(range: z.infer<typeof rangeSchema>): string | null {
  if (range === "all") return null;
  const days = parseInt(range, 10);
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export const getMetricSeries = createServerFn({ method: "GET" })
  .validator((d: unknown) => metricSeriesSchema.parse(d))
  .handler(async ({ data }) => {
    const supabase = authedClient();
    await requireUserId(supabase);

    let q = supabase
      .from("dashboard_metric_snapshots")
      .select("captured_at, value, unit, dims")
      .eq("metric_key", data.metricKey)
      .order("captured_at", { ascending: true })
      .limit(2000);

    const since = rangeToSinceIso(data.range);
    if (since) q = q.gte("captured_at", since);

    if (data.dims) {
      // jsonb contains filter — RLS still scopes to the user.
      q = q.contains("dims", data.dims);
    }

    const { data: rows, error } = await q;
    if (error) throw error;
    return { metricKey: data.metricKey, range: data.range, points: rows ?? [] };
  });

// =========================================================================
// 4. recordInteraction — flywheel ingestion
// =========================================================================
const interactionSchema = z.object({
  kind: z.enum([
    "view",
    "hover",
    "dwell",
    "drag",
    "resize",
    "open",
    "dismiss",
    "accept",
    "nl_query",
    "focus_enter",
    "focus_exit",
    "digest_open",
  ]),
  target: z.string().max(120).optional(),
  payload: z.record(z.unknown()).optional(),
});

export const recordInteraction = createServerFn({ method: "POST" })
  .validator((d: unknown) => interactionSchema.parse(d))
  .handler(async ({ data }) => {
    const supabase = authedClient();
    const userId = await requireUserId(supabase);

    const { error } = await supabase.from("dashboard_interactions").insert({
      user_id: userId,
      kind: data.kind,
      target: data.target ?? null,
      payload: data.payload ?? {},
    });
    if (error) throw error;
    return { ok: true };
  });

// =========================================================================
// 5. runNlDashboardQuery — the natural-language dashboard builder
// =========================================================================
const nlQuerySchema = z.object({
  prompt: z.string().min(2).max(2000),
  mode: z.enum(["build", "explain", "compare", "forecast"]).default("build"),
});

export const runNlDashboardQuery = createServerFn({ method: "POST" })
  .validator((d: unknown) => nlQuerySchema.parse(d))
  .handler(async ({ data }) => {
    const supabase = authedClient();
    const userId = await requireUserId(supabase);

    // Persist the query immediately so the UI can render an optimistic card
    // and the flywheel captures the prompt even if the graph errors.
    const { data: row, error } = await supabase
      .from("dashboard_nl_queries")
      .insert({ user_id: userId, prompt: data.prompt })
      .select("id")
      .single();
    if (error) throw error;

    await supabase.from("dashboard_interactions").insert({
      user_id: userId,
      kind: "nl_query",
      target: row.id,
      payload: { mode: data.mode },
    });

    // Run the graph. For short prompts this stays well under edge limits;
    // for longer/expensive runs we still await so the caller gets the spec
    // synchronously — the swarm fan-out is what gets fire-and-forgotten
    // (see triggerSwarmReview).
    const result: {
      widgetSpec: WidgetSpec | null;
      narrative: string;
      forecast?: unknown;
      comparisons?: unknown;
    } = await runDashboardGraph({
      userId,
      prompt: data.prompt,
      mode: data.mode,
    });

    await supabase
      .from("dashboard_nl_queries")
      .update({
        intent: { mode: data.mode },
        widget_spec: result.widgetSpec ?? null,
        narrative: result.narrative,
        outcome: "pending",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    return { id: row.id, ...result };
  });

// =========================================================================
// 6. getProactiveInsights — calm-ranked, max N un-dismissed
// =========================================================================
const insightsQuerySchema = z.object({
  limit: z.number().int().min(1).max(20).default(5),
});

export const getProactiveInsights = createServerFn({ method: "GET" })
  .validator((d: unknown) => insightsQuerySchema.parse(d ?? {}))
  .handler(async ({ data }) => {
    const supabase = authedClient();
    await requireUserId(supabase);

    const { data: rows, error } = await supabase
      .from("dashboard_insights")
      .select(
        "id, kind, severity, title, body, related_metrics, related_widget, usefulness_score, surfaced_at, source",
      )
      .is("dismissed_at", null)
      .order("usefulness_score", { ascending: false })
      .order("surfaced_at", { ascending: false })
      .limit(data.limit);
    if (error) throw error;
    return rows ?? [];
  });

// =========================================================================
// 7. dismissInsight / markInsightUseful — feedback loop
// =========================================================================
const insightIdSchema = z.object({ id: z.string().uuid() });

export const dismissInsight = createServerFn({ method: "POST" })
  .validator((d: unknown) => insightIdSchema.parse(d))
  .handler(async ({ data }) => {
    const supabase = authedClient();
    const userId = await requireUserId(supabase);

    const { error } = await supabase
      .from("dashboard_insights")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;

    await supabase.from("dashboard_interactions").insert({
      user_id: userId,
      kind: "dismiss",
      target: data.id,
      payload: { kind: "insight" },
    });
    return { ok: true };
  });

export const markInsightUseful = createServerFn({ method: "POST" })
  .validator((d: unknown) => insightIdSchema.parse(d))
  .handler(async ({ data }) => {
    const supabase = authedClient();
    const userId = await requireUserId(supabase);

    const { error } = await supabase
      .from("dashboard_insights")
      .update({ marked_useful_at: new Date().toISOString(), usefulness_score: 1 })
      .eq("id", data.id);
    if (error) throw error;

    await supabase.from("dashboard_interactions").insert({
      user_id: userId,
      kind: "accept",
      target: data.id,
      payload: { kind: "insight" },
    });
    return { ok: true };
  });

// =========================================================================
// 8. triggerSwarmReview — async synthetic stakeholder feedback
// =========================================================================
const swarmScopeSchema = z.object({
  scope: z.string().min(1).max(120), // 'dashboard' | 'widget:<id>' | 'insight:<id>'
});

export const triggerSwarmReview = createServerFn({ method: "POST" })
  .validator((d: unknown) => swarmScopeSchema.parse(d))
  .handler(async ({ data }) => {
    const supabase = authedClient();
    const userId = await requireUserId(supabase);

    const { data: run, error } = await supabase
      .from("dashboard_swarm_runs")
      .insert({ user_id: userId, scope: data.scope, status: "queued" })
      .select("id")
      .single();
    if (error) throw error;

    // Fire-and-forget. Results land in dashboard_swarm_critiques and the
    // route is subscribed to that table via Supabase realtime.
    waitUntil(runSwarmReview({ userId, scope: data.scope, runId: run.id }));

    return { runId: run.id, status: "queued" as const };
  });

// =========================================================================
// 9. enterFocusMode + getDailyDigest
// =========================================================================
const focusModeSchema = z.object({
  mode: z.enum(["focus", "daily_digest", "weekly_digest"]).default("focus"),
  notes: z.string().max(280).optional(),
});

export const enterFocusMode = createServerFn({ method: "POST" })
  .validator((d: unknown) => focusModeSchema.parse(d))
  .handler(async ({ data }) => {
    const supabase = authedClient();
    const userId = await requireUserId(supabase);

    const { data: row, error } = await supabase
      .from("dashboard_focus_sessions")
      .insert({ user_id: userId, mode: data.mode, notes: data.notes ?? null })
      .select("id, started_at")
      .single();
    if (error) throw error;

    await supabase.from("dashboard_interactions").insert({
      user_id: userId,
      kind: "focus_enter",
      target: data.mode,
      payload: {},
    });
    return row;
  });

export const getDailyDigest = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = authedClient();
  const userId = await requireUserId(supabase);

  // Most-recent generated digest, if any.
  const { data: digest } = await supabase
    .from("dashboard_focus_sessions")
    .select("id, mode, started_at, digest_payload")
    .eq("user_id", userId)
    .in("mode", ["daily_digest", "weekly_digest"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return digest ?? null;
});

// =========================================================================
// 10. requestLayoutOptimization — graph-derived calmer layout
// =========================================================================
export const requestLayoutOptimization = createServerFn({
  method: "POST",
}).handler(async () => {
  const supabase = authedClient();
  const userId = await requireUserId(supabase);

  // Fire-and-forget; the graph writes a proposed layout into
  // dashboard_layout_history with source='graph', accepted=false. The UI
  // shows the proposal and lets the founder accept/dismiss.
  waitUntil(runLayoutOptimization({ userId }));

  await supabase.from("dashboard_interactions").insert({
    user_id: userId,
    kind: "open",
    target: "layout_optimizer",
    payload: {},
  });
  return { queued: true as const };
});
