import { useEffect, useMemo, useRef, useState } from "react";
import {
  useBackstageInsights,
  useTriggerBackstage,
  useUpdateInsightStatus,
  type BackstageInsight,
  type BackstageKind,
} from "@/lib/queries";
import { Telescope, Sparkle, Wrench, Bug, Bell, Eye, Check, X, Clock, Loader2 } from "lucide-react";

interface Props {
  projectId: string;
}

const STORAGE_OPEN_KEY = "gapfriend.backstage.open";
const STORAGE_LAST_RUN_KEY = "gapfriend.backstage.lastRun";
const IDLE_TRIGGER_MS = 30_000;
const MIN_RERUN_MS = 5 * 60_000;

const KIND_META: Record<BackstageKind, { label: string; tone: string; Icon: typeof Sparkle }> = {
  wild_niche: { label: "Wild niche", tone: "text-terracotta", Icon: Sparkle },
  redesign: { label: "Adapt UI", tone: "text-sage", Icon: Wrench },
  bug: { label: "Bug spot", tone: "text-destructive", Icon: Bug },
  reminder: { label: "Reminder", tone: "text-foreground", Icon: Bell },
  observation: { label: "Note about you", tone: "text-muted-foreground", Icon: Eye },
};

/** Floating panel that surfaces insights produced by the Backstage AI. */
export function BackstagePanel({ projectId }: Props) {
  const [open, setOpen] = useState(false);
  const { data: insights } = useBackstageInsights(projectId);
  const trigger = useTriggerBackstage();
  const updateStatus = useUpdateInsightStatus();
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist open state.
  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_OPEN_KEY) : null;
    if (stored === "1") setOpen(true);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_OPEN_KEY, open ? "1" : "0");
  }, [open]);

  // Auto-run on idle, throttled per project.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const lastRunKey = `${STORAGE_LAST_RUN_KEY}.${projectId}`;
    const lastRun = Number(window.localStorage.getItem(lastRunKey) ?? 0);
    const elapsed = Date.now() - lastRun;
    const wait = Math.max(IDLE_TRIGGER_MS, MIN_RERUN_MS - elapsed);

    idleTimer.current = setTimeout(() => {
      window.localStorage.setItem(lastRunKey, String(Date.now()));
      trigger.mutate({ projectId, trigger: "idle" });
    }, wait);

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
    // We deliberately re-run only when the project changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const open_insights = useMemo(
    () => (insights ?? []).filter((i) => i.status === "open"),
    [insights],
  );
  const unreadCount = open_insights.length;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-24 z-50 size-12 rounded-full bg-card border border-border text-foreground shadow-warm-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center group"
        aria-label="Open Backstage"
        title="Backstage — your background reasoning AI"
      >
        <Telescope className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 size-5 rounded-full bg-terracotta text-primary-foreground text-[10px] font-mono font-bold flex items-center justify-center border-2 border-background">
            {Math.min(unreadCount, 9)}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-24 z-50 w-[380px] max-w-[calc(100vw-2.5rem)] h-[560px] max-h-[calc(100vh-2.5rem)] bg-card border border-border rounded-2xl shadow-warm-lg flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 shrink-0 bg-card">
        <div className="size-9 rounded-full bg-secondary flex items-center justify-center">
          <Telescope className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif font-medium text-sm leading-tight">Backstage</h2>
          <p className="text-[11px] text-muted-foreground truncate">
            Quietly thinking in the background
          </p>
        </div>
        <button
          type="button"
          onClick={() => trigger.mutate({ projectId, trigger: "manual" })}
          disabled={trigger.isPending}
          className="text-[11px] px-2 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          {trigger.isPending ? (
            <>
              <Loader2 className="size-3 animate-spin" /> Thinking
            </>
          ) : (
            "Think now"
          )}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="size-8 rounded-full hover:bg-secondary transition-colors flex items-center justify-center text-muted-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {open_insights.length === 0 && (
          <div className="text-sm text-muted-foreground p-4 text-center leading-relaxed">
            {trigger.isPending
              ? "Backstage is reading your project…"
              : "Nothing surfacing right now. Backstage will speak up when it spots something useful."}
          </div>
        )}
        {open_insights.map((i) => (
          <InsightCard
            key={i.id}
            insight={i}
            onAct={() => updateStatus.mutate({ id: i.id, project_id: projectId, status: "acted" })}
            onDismiss={() =>
              updateStatus.mutate({ id: i.id, project_id: projectId, status: "dismissed" })
            }
            onSnooze={() =>
              updateStatus.mutate({ id: i.id, project_id: projectId, status: "snoozed" })
            }
          />
        ))}
      </div>
    </div>
  );
}

function InsightCard({
  insight,
  onAct,
  onDismiss,
  onSnooze,
}: {
  insight: BackstageInsight;
  onAct: () => void;
  onDismiss: () => void;
  onSnooze: () => void;
}) {
  const meta = KIND_META[insight.kind];
  const Icon = meta.Icon;
  const payload = (insight.payload ?? {}) as Record<string, unknown>;

  return (
    <div className="rounded-xl border border-border bg-background p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className={`mt-0.5 ${meta.tone}`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-mono text-[10px] uppercase tracking-wider ${meta.tone}`}>
              {meta.label}
            </span>
            {insight.kind === "wild_niche" && insight.weirdness > 0 && (
              <span className="text-[10px] text-muted-foreground font-mono">
                weirdness {insight.weirdness}/10
              </span>
            )}
          </div>
          <h3 className="font-serif text-sm font-medium leading-snug mt-0.5">{insight.title}</h3>
          {insight.body && (
            <p className="text-xs text-muted-foreground leading-relaxed mt-1 whitespace-pre-wrap">
              {insight.body}
            </p>
          )}
          {insight.kind === "wild_niche" && (
            <PayloadBlock
              entries={[
                ["Persona", payload.persona],
                ["Gap", payload.gap],
                ["First move", payload.first_move],
                ["Why it works", payload.why_it_works],
              ]}
            />
          )}
          {insight.kind === "redesign" && (
            <PayloadBlock
              entries={[
                ["Where", payload.target],
                ["Evidence", payload.evidence],
              ]}
            />
          )}
          {insight.kind === "bug" && (
            <PayloadBlock
              entries={[
                ["Where", payload.location],
                ["Severity", payload.severity],
                ["Fix hint", payload.fix_hint],
              ]}
            />
          )}
          {insight.kind === "reminder" && insight.due_at && (
            <p className="text-[11px] text-muted-foreground mt-1 font-mono flex items-center gap-1">
              <Clock className="size-3" /> due {new Date(insight.due_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 justify-end">
        <button
          type="button"
          onClick={onSnooze}
          className="text-[11px] px-2 py-1 rounded-full text-muted-foreground hover:bg-secondary transition-colors"
        >
          Snooze
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-[11px] px-2 py-1 rounded-full text-muted-foreground hover:bg-secondary transition-colors flex items-center gap-1"
        >
          <X className="size-3" /> Dismiss
        </button>
        <button
          type="button"
          onClick={onAct}
          className="text-[11px] px-2 py-1 rounded-full bg-terracotta text-primary-foreground hover:bg-terracotta/90 transition-colors flex items-center gap-1"
        >
          <Check className="size-3" /> Got it
        </button>
      </div>
    </div>
  );
}

function PayloadBlock({ entries }: { entries: Array<[string, unknown]> }) {
  const visible = entries.filter(([, v]) => typeof v === "string" && v.trim().length > 0);
  if (visible.length === 0) return null;
  return (
    <dl className="mt-2 space-y-1 text-xs">
      {visible.map(([k, v]) => (
        <div key={k} className="flex gap-1.5">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground shrink-0 mt-0.5 w-20">
            {k}
          </dt>
          <dd className="text-foreground/80 leading-relaxed">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
