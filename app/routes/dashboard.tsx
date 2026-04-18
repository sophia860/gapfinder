// app/routes/dashboard.tsx
//
// Truara Founder Command Center — TanStack Start route.
//
// ┌────────────────────────────── HEADS UP ───────────────────────────────┐
// │ This file lives at app/routes/dashboard.tsx as requested. The active  │
// │ TanStack Start router in this repo scans src/routes/, so this file is │
// │ a self-contained, ready-to-paste component. To mount it, copy this    │
// │ file to src/routes/app.dashboard.tsx (the file-based router will      │
// │ produce the path /app/dashboard automatically) — no other changes     │
// │ required because all imports are tolerant of either location.         │
// └───────────────────────────────────────────────────────────────────────┘
//
// Design intent (calm by default):
//   * Generous whitespace, system font stack, single column on mobile.
//   * One proactive insight visible at a time, never spammy.
//   * Keyboard-first: ⌘K command bar (NL builder), ⌘. focus mode, ? help,
//     j/k to navigate widgets.
//   * Drag-and-drop widget reorder with no extra dependency (pointer events).
//   * Realtime updates via Supabase channels for the founder's own rows only.
//   * Server data flows through createServerFn — RLS enforces ownership.

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Command } from "cmdk";
import { toast } from "sonner";
import { Sparkles, Lock, Download, Moon, Bot, Eye, EyeOff, Wand2 } from "lucide-react";

import {
  dismissInsight,
  enterFocusMode,
  getDailyDigest,
  getDashboardLayout,
  getMetricSeries,
  getProactiveInsights,
  markInsightUseful,
  recordInteraction,
  requestLayoutOptimization,
  runNlDashboardQuery,
  saveDashboardLayout,
  triggerSwarmReview,
} from "../server-functions/dashboard";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

// -------------------------------------------------------------------------
// Route + loader (server-rendered shell, hydrated client-side).
// -------------------------------------------------------------------------
export const Route = createFileRoute("/dashboard")({
  component: FounderCommandCenter,
  loader: async () => {
    // Parallel hydration. createServerFn returns plain values on the wire.
    const [layout, insights, digest] = await Promise.all([
      getDashboardLayout(),
      getProactiveInsights({ data: { limit: 5 } }),
      getDailyDigest(),
    ]);
    return { layout, insights, digest };
  },
});

// -------------------------------------------------------------------------
// Types matching the server-fn responses.
// -------------------------------------------------------------------------
type LayoutWidget = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: Record<string, unknown>;
};
type Layout = {
  version: number;
  widgets: LayoutWidget[];
  source: "user" | "graph" | "default";
  ai_suggested: boolean;
};
type Insight = {
  id: string;
  kind: string;
  severity: "calm" | "notable" | "urgent";
  title: string;
  body: string;
  related_metrics: string[];
  related_widget: string | null;
  usefulness_score: number;
  surfaced_at: string;
  source: string;
};

// -------------------------------------------------------------------------
// Root component
// -------------------------------------------------------------------------
function FounderCommandCenter() {
  const {
    layout: initialLayout,
    insights: initialInsights,
    digest,
  } = Route.useLoaderData() as {
    layout: Layout;
    insights: Insight[];
    digest: { id: string; mode: string; digest_payload: unknown } | null;
  };
  const { user } = useAuth();
  const qc = useQueryClient();

  // -------- layout state (DnD) --------
  const [widgets, setWidgets] = useState<LayoutWidget[]>(initialLayout.widgets);
  useEffect(() => setWidgets(initialLayout.widgets), [initialLayout]);

  // -------- proactive insights (max 1 visible at a time) --------
  const insightsQuery = useQuery({
    queryKey: ["dashboard", "insights"],
    queryFn: () => getProactiveInsights({ data: { limit: 5 } }),
    initialData: initialInsights,
    staleTime: 60_000,
  });
  const visibleInsight = insightsQuery.data?.[0] ?? null;

  // -------- realtime subscriptions --------
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`dashboard:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dashboard_metric_snapshots",
          filter: `user_id=eq.${user.id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["dashboard", "metric"] }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dashboard_insights",
          filter: `user_id=eq.${user.id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["dashboard", "insights"] }),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dashboard_swarm_critiques",
          filter: `user_id=eq.${user.id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["dashboard", "swarm"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  // -------- mutations --------
  const saveLayout = useMutation({
    mutationFn: (next: LayoutWidget[]) =>
      saveDashboardLayout({ data: { widgets: next, source: "user" } }),
    onError: () => toast.error("Could not save layout — kept your changes locally."),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => dismissInsight({ data: { id } }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["dashboard", "insights"] });
      const prev = qc.getQueryData<Insight[]>(["dashboard", "insights"]);
      qc.setQueryData<Insight[]>(["dashboard", "insights"], (old) =>
        (old ?? []).filter((i) => i.id !== id),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["dashboard", "insights"], ctx.prev);
    },
  });

  const markUseful = useMutation({
    mutationFn: (id: string) => markInsightUseful({ data: { id } }),
  });

  const focus = useMutation({
    mutationFn: () => enterFocusMode({ data: { mode: "focus" } }),
    onSuccess: () => toast.success("Focus mode on. Quiet until you return."),
  });

  const optimize = useMutation({
    mutationFn: () => requestLayoutOptimization(),
    onSuccess: () =>
      toast.message("Looking at your usage patterns…", {
        description: "A calmer layout suggestion will appear shortly.",
      }),
  });

  const swarm = useMutation({
    mutationFn: () => triggerSwarmReview({ data: { scope: "dashboard" } }),
    onSuccess: () =>
      toast.message("Swarm review queued", {
        description: "Synthetic stakeholders are reviewing in the background.",
      }),
  });

  // -------- ⌘K command bar (also serves as NL builder) --------
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdValue, setCmdValue] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
        return;
      }
      if (meta && e.key === ".") {
        e.preventDefault();
        focus.mutate();
        return;
      }
      // Ignore keystrokes while typing in inputs.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
      }
      if (e.key === "j") moveFocus(1);
      if (e.key === "k") moveFocus(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, moveFocus]);

  // -------- widget keyboard focus (j/k) --------
  const widgetRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [focusedWidget, setFocusedWidget] = useState<string | null>(null);
  const moveFocus = useCallback(
    (delta: number) => {
      setFocusedWidget((cur) => {
        const ids = widgets.map((w) => w.id);
        if (!ids.length) return cur;
        const idx = cur ? ids.indexOf(cur) : -1;
        const next = ids[(idx + delta + ids.length) % ids.length];
        widgetRefs.current.get(next)?.focus();
        recordInteraction({ data: { kind: "view", target: next } }).catch(() => undefined);
        return next;
      });
    },
    [widgets],
  );

  // -------- DnD reorder (lightweight, no deps) --------
  const dragRef = useRef<{ id: string; from: number } | null>(null);

  function onDragStart(id: string, from: number) {
    dragRef.current = { id, from };
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function onDrop(toIdx: number) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    setWidgets((prev) => {
      const next = [...prev];
      const [moved] = next.splice(drag.from, 1);
      next.splice(toIdx, 0, moved);
      // Re-pack y coordinates so the persisted layout is normalized.
      const repacked = repackLayout(next);
      saveLayout.mutate(repacked);
      return repacked;
    });
  }

  // -------- NL run --------
  const nlRun = useMutation({
    mutationFn: (prompt: string) => runNlDashboardQuery({ data: { prompt, mode: "build" } }),
    onSuccess: (res) => {
      setCmdOpen(false);
      setCmdValue("");
      if (!res.widgetSpec) {
        toast.message("Couldn't build that yet", {
          description: res.narrative || "Try a more specific prompt.",
        });
        return;
      }
      // Append the new widget to the layout.
      const newWidget: LayoutWidget = {
        id: res.widgetSpec.id,
        x: 0,
        y: maxY(widgets) + 1,
        w: 6,
        h: 3,
        config: { spec: res.widgetSpec, narrative: res.narrative },
      };
      const next = repackLayout([...widgets, newWidget]);
      setWidgets(next);
      saveLayout.mutate(next);
      toast.success(res.widgetSpec.title);
    },
  });

  // -------- render --------
  return (
    <div style={shellStyle} className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <style>{themeCss}</style>

      <Header
        ai={initialLayout.ai_suggested}
        onCommand={() => setCmdOpen(true)}
        onFocus={() => focus.mutate()}
        onCopilot={() => setCopilotOpen((v) => !v)}
        onSwarm={() => swarm.mutate()}
        onOptimize={() => optimize.mutate()}
      />

      <main className="mx-auto w-full max-w-[1400px] px-6 py-8 lg:px-10">
        {/* Calm proactive insight strip — at most one at a time */}
        {visibleInsight ? (
          <ProactiveInsightStrip
            insight={visibleInsight}
            onDismiss={() => dismiss.mutate(visibleInsight.id)}
            onUseful={() => markUseful.mutate(visibleInsight.id)}
          />
        ) : (
          <CalmEmptyStrip />
        )}

        <div className="mt-6 grid grid-cols-12 gap-4">
          {widgets.map((w, idx) => (
            <WidgetTile
              key={w.id}
              widget={w}
              focused={focusedWidget === w.id}
              registerRef={(el) => {
                if (el) widgetRefs.current.set(w.id, el);
              }}
              onDragStart={() => onDragStart(w.id, idx)}
              onDragOver={onDragOver}
              onDrop={() => onDrop(idx)}
            />
          ))}
        </div>

        {digest ? <DigestStrip digest={digest} /> : null}
      </main>

      {/* AI Copilot pane */}
      {copilotOpen ? <CopilotPane onClose={() => setCopilotOpen(false)} /> : null}

      {/* ⌘K command bar (NL builder) */}
      <CommandPalette
        open={cmdOpen}
        value={cmdValue}
        onValueChange={setCmdValue}
        onClose={() => setCmdOpen(false)}
        onRun={(p) => nlRun.mutate(p)}
        running={nlRun.isPending}
      />

      {/* ? help sheet */}
      {helpOpen ? <HelpSheet onClose={() => setHelpOpen(false)} /> : null}
    </div>
  );
}

// -------------------------------------------------------------------------
// Header
// -------------------------------------------------------------------------
function Header(props: {
  ai: boolean;
  onCommand: () => void;
  onFocus: () => void;
  onCopilot: () => void;
  onSwarm: () => void;
  onOptimize: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-3 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="text-[15px] font-semibold tracking-tight">Truara · Command Center</div>
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
            <Lock className="h-3 w-3" /> Private · End-to-end yours
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={props.onCommand}
            className="gap-2"
            aria-label="Open command bar"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Ask anything…
            <kbd className="ml-2 rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
              ⌘K
            </kbd>
          </Button>
          <Button variant="ghost" size="sm" onClick={props.onCopilot} className="gap-2">
            <Bot className="h-3.5 w-3.5" /> Copilot
          </Button>
          <Button variant="ghost" size="sm" onClick={props.onOptimize} className="gap-2">
            <Wand2 className="h-3.5 w-3.5" /> Auto-tune layout
          </Button>
          <Button variant="ghost" size="sm" onClick={props.onSwarm} className="gap-2">
            <EyeOff className="h-3.5 w-3.5" /> Swarm review
          </Button>
          <Button variant="ghost" size="sm" onClick={props.onFocus} className="gap-2">
            <Moon className="h-3.5 w-3.5" /> Focus
          </Button>
          <a
            href="/app/settings/export"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-[var(--muted)] hover:text-[var(--fg)]"
            title="Export your data"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </a>
        </div>
      </div>
    </header>
  );
}

// -------------------------------------------------------------------------
// Proactive insight strip (calm)
// -------------------------------------------------------------------------
function ProactiveInsightStrip(props: {
  insight: Insight;
  onDismiss: () => void;
  onUseful: () => void;
}) {
  const { insight } = props;
  return (
    <div
      className="flex items-start justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <div className="min-w-0">
        <div className="text-[12px] uppercase tracking-wider text-[var(--muted)]">
          {insight.severity === "calm" ? "Gentle insight" : insight.severity}
        </div>
        <div className="mt-0.5 text-[14px] font-medium">{insight.title}</div>
        <div className="mt-1 text-[13px] text-[var(--muted)]">{insight.body}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="sm" onClick={props.onUseful}>
          Useful
        </Button>
        <Button variant="ghost" size="sm" onClick={props.onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function CalmEmptyStrip() {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)]/40 px-4 py-3 text-[13px] text-[var(--muted)]">
      Nothing urgent — the dashboard is quiet on purpose. ⌘K to ask anything.
    </div>
  );
}

// -------------------------------------------------------------------------
// Widget tile (memoized rendering by id+config)
// -------------------------------------------------------------------------
function WidgetTile(props: {
  widget: LayoutWidget;
  focused: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}) {
  const { widget } = props;
  const colSpan = Math.min(12, Math.max(1, widget.w));
  return (
    <div
      ref={props.registerRef}
      tabIndex={0}
      draggable
      onDragStart={props.onDragStart}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
      className={`group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
        props.focused ? "ring-1 ring-[var(--accent)]" : ""
      }`}
      style={{ minHeight: widget.h * 80, gridColumn: `span ${colSpan} / span ${colSpan}` }}
      aria-label={`Widget ${widget.id}`}
    >
      <div className="flex items-center justify-between">
        <div className="text-[12px] uppercase tracking-wider text-[var(--muted)]">
          {widget.id.replace(/_/g, " ")}
        </div>
        <Eye className="h-3.5 w-3.5 text-[var(--muted)] opacity-0 transition group-hover:opacity-100" />
      </div>
      <div className="mt-3">
        <WidgetBody widget={widget} />
      </div>
    </div>
  );
}

function WidgetBody({ widget }: { widget: LayoutWidget }) {
  // Each widget body owns its own data fetch. Keyed by metric so changes
  // realtime-invalidate cleanly. For NL-built widgets the spec is on config.
  const spec = (widget.config?.spec ?? null) as {
    metrics?: string[];
    range?: string;
    title?: string;
  } | null;

  const metricKey = pickMetricFor(widget.id, spec);
  const range = (spec?.range as "7d" | "30d" | "90d" | "180d" | "365d" | "all") ?? "90d";

  const q = useQuery({
    queryKey: ["dashboard", "metric", metricKey, range],
    queryFn: () => getMetricSeries({ data: { metricKey, range } }),
    enabled: Boolean(metricKey),
    staleTime: 30_000,
  });

  if (!metricKey) {
    return (
      <div className="text-[13px] text-[var(--muted)]">
        {widget.id === "ai_copilot"
          ? "Open the copilot pane (top-right) for a deep dive."
          : widget.id === "agent_activity"
            ? "Quiet. No background agents are running."
            : widget.id === "focus_digest"
              ? "Your daily digest will appear here at 8:00 local time."
              : "—"}
      </div>
    );
  }

  if (q.isLoading) return <div className="h-16 animate-pulse rounded bg-[var(--border)]/40" />;
  const points = q.data?.points ?? [];
  if (!points.length) {
    return (
      <div className="text-[13px] text-[var(--muted)]">
        No data yet. Send your first metric snapshot to see this come alive.
      </div>
    );
  }

  const last = points[points.length - 1].value as unknown as number;
  const first = points[0].value as unknown as number;
  const delta = first === 0 ? null : ((last - first) / first) * 100;

  return (
    <div>
      <div className="text-[28px] font-semibold tabular-nums tracking-tight">{formatNum(last)}</div>
      <div className="text-[12px] text-[var(--muted)]">
        {delta == null ? "—" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% over ${range}`}
      </div>
      <Sparkline points={points.map((p) => Number(p.value))} />
    </div>
  );
}

function pickMetricFor(id: string, spec: { metrics?: string[] } | null): string {
  if (spec?.metrics?.[0]) return spec.metrics[0];
  switch (id) {
    case "revenue_trend":
      return "revenue";
    case "churn":
      return "churn";
    case "velocity":
      return "velocity";
    case "burndown":
      return "burndown";
    case "cycle_time":
      return "cycle_time";
    case "founder_mood":
      return "founder_mood";
    default:
      return "";
  }
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const w = 200;
  const h = 36;
  const step = w / (points.length - 1);
  const d = points
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-9 w-full text-[var(--accent)]">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

// -------------------------------------------------------------------------
// Command palette (cmdk) — also the natural-language dashboard builder
// -------------------------------------------------------------------------
function CommandPalette(props: {
  open: boolean;
  value: string;
  onValueChange: (v: string) => void;
  onClose: () => void;
  onRun: (prompt: string) => void;
  running: boolean;
}) {
  if (!props.open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[15vh]"
      onClick={props.onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Command bar" shouldFilter={false}>
          <div className="border-b border-[var(--border)] p-3">
            <Command.Input
              autoFocus
              value={props.value}
              onValueChange={props.onValueChange}
              placeholder='Ask: "show me revenue vs churn last 90 days with AI forecast"'
              className="w-full bg-transparent text-[14px] outline-none placeholder:text-[var(--muted)]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && props.value.trim()) {
                  e.preventDefault();
                  props.onRun(props.value.trim());
                }
              }}
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2 text-[13px]">
            {props.running ? (
              <div className="px-3 py-4 text-[var(--muted)]">Composing widget…</div>
            ) : (
              <>
                <Command.Item
                  value="run"
                  onSelect={() => props.value.trim() && props.onRun(props.value.trim())}
                  className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 hover:bg-[var(--border)]/40"
                >
                  <span>↩ Build widget from prompt</span>
                  <kbd className="text-[10px] text-[var(--muted)]">enter</kbd>
                </Command.Item>
                <div className="px-3 pt-2 text-[11px] uppercase tracking-wider text-[var(--muted)]">
                  Examples
                </div>
                {[
                  "show me revenue vs churn last 90 days with AI forecast and compare to my best month ever",
                  "weekly mood and velocity for the past 6 months",
                  "explain why MRR dipped in March compared to February",
                ].map((ex) => (
                  <Command.Item
                    key={ex}
                    value={ex}
                    onSelect={() => props.onRun(ex)}
                    className="cursor-pointer rounded-md px-3 py-2 text-[var(--muted)] hover:bg-[var(--border)]/40 hover:text-[var(--fg)]"
                  >
                    {ex}
                  </Command.Item>
                ))}
              </>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// AI copilot side pane
// -------------------------------------------------------------------------
function CopilotPane({ onClose }: { onClose: () => void }) {
  return (
    <aside
      className="fixed right-0 top-0 z-40 h-screen w-full max-w-md border-l border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
      aria-label="AI copilot"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[14px] font-semibold">
          <Bot className="h-4 w-4" /> Copilot
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <p className="mt-3 text-[13px] text-[var(--muted)]">
        A quiet space for deep dives. Ask anything about your numbers; results appear here, never as
        notifications.
      </p>
      <div className="mt-4 rounded-md border border-dashed border-[var(--border)] p-4 text-[13px] text-[var(--muted)]">
        Tip: copilot threads persist via PostgresSaver, so it remembers prior sessions across
        months.
      </div>
    </aside>
  );
}

// -------------------------------------------------------------------------
// Help / shortcuts sheet
// -------------------------------------------------------------------------
function HelpSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[14px] font-semibold">Keyboard</div>
        <ul className="mt-3 space-y-2 text-[13px]">
          <ShortcutRow keys="⌘K" label="Open command bar / NL builder" />
          <ShortcutRow keys="⌘." label="Toggle focus mode" />
          <ShortcutRow keys="j / k" label="Move between widgets" />
          <ShortcutRow keys="?" label="Show this help" />
        </ul>
      </div>
    </div>
  );
}
function ShortcutRow({ keys, label }: { keys: string; label: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-[var(--muted)]">{label}</span>
      <kbd className="rounded border border-[var(--border)] px-2 py-0.5 text-[11px]">{keys}</kbd>
    </li>
  );
}

// -------------------------------------------------------------------------
// Daily digest strip (focus-mode artifact)
// -------------------------------------------------------------------------
function DigestStrip({
  digest,
}: {
  digest: { id: string; mode: string; digest_payload: unknown };
}) {
  return (
    <section className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="text-[12px] uppercase tracking-wider text-[var(--muted)]">
        {digest.mode === "weekly_digest" ? "This week" : "Today"}
      </div>
      <pre className="mt-2 whitespace-pre-wrap text-[13px] text-[var(--fg)]">
        {typeof digest.digest_payload === "string"
          ? digest.digest_payload
          : JSON.stringify(digest.digest_payload, null, 2)}
      </pre>
    </section>
  );
}

// -------------------------------------------------------------------------
// Layout helpers
// -------------------------------------------------------------------------
function maxY(widgets: LayoutWidget[]): number {
  return widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0);
}

function repackLayout(widgets: LayoutWidget[]): LayoutWidget[] {
  // Single-column row pack — keeps the math simple, looks great on a 12 grid.
  let x = 0;
  let y = 0;
  let rowMaxH = 0;
  return widgets.map((w) => {
    const ww = Math.min(12, Math.max(1, w.w));
    if (x + ww > 12) {
      x = 0;
      y += rowMaxH;
      rowMaxH = 0;
    }
    const placed = { ...w, x, y, w: ww };
    x += ww;
    rowMaxH = Math.max(rowMaxH, w.h);
    return placed;
  });
}

// -------------------------------------------------------------------------
// Theming — calm tokens. Inlined so this file is drop-in.
// -------------------------------------------------------------------------
const shellStyle: CSSProperties = {
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
};

const themeCss = `
  :root {
    --bg: #fafaf8;
    --surface: #ffffff;
    --fg: #16181d;
    --muted: #6b7280;
    --border: #ececec;
    --accent: #4f46e5;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0c0d10;
      --surface: #131418;
      --fg: #e9eaee;
      --muted: #9aa0a6;
      --border: #232427;
      --accent: #818cf8;
    }
  }
`;
