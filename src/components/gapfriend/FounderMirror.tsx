import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type Genome = {
  decision_style: string | null;
  risk_appetite: number;
  core_values: string[];
  energy_pattern: string | null;
  strengths: string[];
  blind_spots: string[];
  past_outcomes: { title: string; lesson: string; at: string }[];
  narrative: string | null;
  confidence: number;
};

const EMPTY: Genome = {
  decision_style: null,
  risk_appetite: 0.5,
  core_values: [],
  energy_pattern: null,
  strengths: [],
  blind_spots: [],
  past_outcomes: [],
  narrative: null,
  confidence: 0,
};

interface Props {
  projectId: string;
}

export function FounderMirror({ projectId }: Props) {
  const { user } = useAuth();
  const [genome, setGenome] = useState<Genome>(EMPTY);
  const [signalCount, setSignalCount] = useState(0);
  const [unprocessed, setUnprocessed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [reframe, setReframe] = useState<string | null>(null);
  const [reframeLoading, setReframeLoading] = useState(false);
  const [outcomeTitle, setOutcomeTitle] = useState("");
  const [outcomeLesson, setOutcomeLesson] = useState("");

  // Initial fetch — get-or-create the mirror row
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_or_create_founder_mirror");
      if (cancelled) return;
      if (error) {
        toast.error("Couldn't open your Mirror");
        setLoading(false);
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setGenome({ ...EMPTY, ...(row.genome ?? {}) });
        setSignalCount(row.signal_count ?? 0);
      }
      // Count unprocessed signals
      const { count } = await supabase
        .from("founder_mirror_signals")
        .select("id", { count: "exact", head: true })
        .is("processed_at", null);
      if (!cancelled) setUnprocessed(count ?? 0);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Realtime — live updates whenever the genome changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`founder_mirrors:${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "founder_mirrors", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const next = payload.new as { genome: Genome; signal_count: number };
          setGenome({ ...EMPTY, ...(next.genome ?? {}) });
          setSignalCount(next.signal_count ?? 0);
          setUnprocessed(0);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function callAgent(payload: Record<string, unknown> = {}) {
    const { data, error } = await supabase.functions.invoke("founder-mirror-agent", {
      body: payload,
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as { genome: Genome; processed: number; reframe: string | null };
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await callAgent({});
      setGenome(res.genome);
      setUnprocessed(0);
      toast.success(res.processed > 0 ? `Folded in ${res.processed} signal${res.processed === 1 ? "" : "s"}` : "Mirror is up to date");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleReframe() {
    setReframeLoading(true);
    try {
      const res = await callAgent({ reframe_project_id: projectId });
      setGenome(res.genome);
      setReframe(res.reframe);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reframe failed");
    } finally {
      setReframeLoading(false);
    }
  }

  async function handleLogOutcome() {
    if (!outcomeTitle.trim() || !outcomeLesson.trim()) {
      toast.error("Add a title and a lesson");
      return;
    }
    setSyncing(true);
    try {
      const res = await callAgent({
        outcome: { title: outcomeTitle.trim(), lesson: outcomeLesson.trim() },
      });
      setGenome(res.genome);
      setOutcomeTitle("");
      setOutcomeLesson("");
      toast.success("Mirror updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="px-4 lg:px-8 py-12">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Opening your mirror…
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-10 max-w-5xl mx-auto space-y-10">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-terracotta">
          Founder Mirror · {Math.round(genome.confidence * 100)}% confidence
        </p>
        <h1 className="font-serif text-4xl lg:text-5xl font-medium tracking-tight">
          A quiet portrait of how you build.
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Your Mirror watches what you do across this workspace and slowly assembles a picture of
          your decisions, energy, and values. It is private. Nothing leaves your account.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSync}
            disabled={syncing}
            className="rounded-full"
          >
            {syncing ? "Listening…" : unprocessed > 0 ? `Fold in ${unprocessed} new signal${unprocessed === 1 ? "" : "s"}` : "Up to date"}
          </Button>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {signalCount} signal{signalCount === 1 ? "" : "s"} observed
          </span>
        </div>
      </header>

      {/* Narrative */}
      <Card className="p-6 lg:p-8 border-border/60">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
          Working portrait
        </p>
        <p className="font-serif text-xl lg:text-2xl leading-snug text-foreground/90">
          {genome.narrative ??
            "Your mirror is still listening. Keep working — it will start to see you after a few sessions."}
        </p>
      </Card>

      {/* Radar + dimensions */}
      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card className="p-6 border-border/60">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
            Signature
          </p>
          <Radar genome={genome} />
        </Card>
        <Card className="p-6 border-border/60 space-y-5">
          <Bar label="Risk appetite" value={genome.risk_appetite} hint={riskLabel(genome.risk_appetite)} />
          <Bar label="Confidence" value={genome.confidence} hint={`${Math.round(genome.confidence * 100)}% — grows with use`} />
          <Field label="Decision style" value={genome.decision_style} />
          <Field label="Energy pattern" value={genome.energy_pattern} />
        </Card>
      </section>

      {/* Tag groups */}
      <section className="grid gap-6 sm:grid-cols-3">
        <TagCard title="Core values" items={genome.core_values} />
        <TagCard title="Strengths" items={genome.strengths} />
        <TagCard title="Blind spots" items={genome.blind_spots} />
      </section>

      {/* Reframe */}
      <Card className="p-6 lg:p-8 border-border/60 bg-terracotta-soft/40">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-terracotta">
              Through your lens
            </p>
            <h2 className="font-serif text-2xl font-medium">What my Mirror says about this idea</h2>
          </div>
          <Button
            onClick={handleReframe}
            disabled={reframeLoading}
            variant="outline"
            className="rounded-full"
          >
            {reframeLoading ? "Reading…" : reframe ? "Re-read" : "Reflect on this project"}
          </Button>
        </div>
        {reframe && (
          <p className="mt-5 font-serif text-lg leading-snug text-foreground/85">{reframe}</p>
        )}
      </Card>

      {/* Outcomes */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 border-border/60">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            Update Mirror from this outcome
          </p>
          <div className="space-y-3">
            <Input
              placeholder="What happened? (e.g. 'Launched landing page')"
              value={outcomeTitle}
              onChange={(e) => setOutcomeTitle(e.target.value)}
              maxLength={200}
            />
            <Textarea
              placeholder="What did you learn from it?"
              value={outcomeLesson}
              onChange={(e) => setOutcomeLesson(e.target.value)}
              rows={4}
              maxLength={600}
            />
            <Button onClick={handleLogOutcome} disabled={syncing} className="rounded-full">
              {syncing ? "Saving…" : "Update Mirror"}
            </Button>
          </div>
        </Card>

        <Card className="p-6 border-border/60">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            Past outcomes
          </p>
          {genome.past_outcomes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing logged yet. Outcomes accumulate here as you ship and reflect.
            </p>
          ) : (
            <ul className="space-y-4">
              {genome.past_outcomes.slice(0, 6).map((o, i) => (
                <li key={i} className="border-l-2 border-terracotta/60 pl-3">
                  <div className="font-medium text-sm">{o.title}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{o.lesson}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

/* ---------- bits ---------- */

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-sm leading-relaxed">
        {value ?? <span className="text-muted-foreground italic">Not yet observed</span>}
      </p>
    </div>
  );
}

function Bar({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="font-mono text-[10px] text-muted-foreground">{pct}%</p>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className="h-full bg-terracotta transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>}
    </div>
  );
}

function TagCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="p-5 border-border/60">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Not yet observed</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <li
              key={i}
              className="text-xs px-2.5 py-1 rounded-full bg-secondary border border-border/60"
            >
              {it}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function riskLabel(v: number) {
  if (v < 0.25) return "Cautious — protects optionality";
  if (v < 0.5) return "Measured — pilots before committing";
  if (v < 0.75) return "Willing — moves on conviction";
  return "Bold — comfortable in the unknown";
}

/* SVG radar across 5 dimensions, derived from genome */
function Radar({ genome }: { genome: Genome }) {
  const dims = useMemo(() => {
    const norm = (n: number) => Math.max(0.05, Math.min(1, n));
    return [
      { label: "Risk", v: norm(genome.risk_appetite) },
      { label: "Conviction", v: norm(genome.confidence) },
      { label: "Values", v: norm(genome.core_values.length / 5) },
      { label: "Range", v: norm(genome.strengths.length / 5) },
      { label: "Memory", v: norm(genome.past_outcomes.length / 5) },
    ];
  }, [genome]);

  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 30;
  const n = dims.length;

  const point = (i: number, mag: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(angle) * r * mag, cy + Math.sin(angle) * r * mag] as const;
  };

  const ringPath = (mag: number) =>
    Array.from({ length: n }, (_, i) => {
      const [x, y] = point(i, mag);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ") + " Z";

  const dataPath = ringPath as (m: number) => string; // helper alias

  const polygon = dims
    .map((d, i) => {
      const [x, y] = point(i, d.v);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto max-w-[300px] mx-auto">
      {[0.25, 0.5, 0.75, 1].map((m) => (
        <path key={m} d={dataPath(m)} fill="none" stroke="hsl(var(--border))" strokeWidth={1} />
      ))}
      {dims.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="hsl(var(--border))" strokeWidth={1} />;
      })}
      <polygon
        points={polygon}
        fill="oklch(0.68 0.13 40 / 0.25)"
        stroke="oklch(0.62 0.16 40)"
        strokeWidth={1.5}
      />
      {dims.map((d, i) => {
        const [x, y] = point(i, 1.18);
        return (
          <text
            key={d.label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
