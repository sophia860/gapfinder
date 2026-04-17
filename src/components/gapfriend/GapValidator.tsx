import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useGapReports, type GapReport } from "@/lib/queries";
import { GapReportSchema, type GapReport as GapReportShape } from "@/lib/ai/gap-report";
import { Loader2, ShieldCheck, Sprout, Sparkles, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
}

/**
 * Gap-validator: runs the `gapfriend-validate` edge function with an idea,
 * persists the structured GapReport, and renders the latest report below.
 *
 * Works in two phases:
 *  1. Optionally call `gapfriend-ingest-evidence` to seed the project with
 *     Reddit + Hacker News snippets the validator can ground on.
 *  2. Call `gapfriend-validate` to produce the structured report.
 */
export function GapValidator({ projectId }: Props) {
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState<"validate" | "ingest" | null>(null);
  const { data: reports } = useGapReports(projectId);
  const qc = useQueryClient();
  const latest = reports?.[0];

  async function ingest() {
    const trimmed = idea.trim();
    if (!trimmed) return;
    setBusy("ingest");
    try {
      const { data, error } = await supabase.functions.invoke("gapfriend-ingest-evidence", {
        body: { projectId, query: trimmed.slice(0, 500) },
      });
      if (error) throw error;
      const errMsg = (data as { error?: string })?.error;
      if (errMsg) throw new Error(errMsg);
      const inserted = (data as { inserted?: number })?.inserted ?? 0;
      toast.success(`Pulled ${inserted} signal${inserted === 1 ? "" : "s"} from Reddit + HN`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ingest failed");
    } finally {
      setBusy(null);
    }
  }

  async function validate() {
    const trimmed = idea.trim();
    if (!trimmed) return;
    setBusy("validate");
    try {
      const { data, error } = await supabase.functions.invoke("gapfriend-validate", {
        body: { projectId, idea: trimmed },
      });
      if (error) throw error;
      const errMsg = (data as { error?: string })?.error;
      if (errMsg) throw new Error(errMsg);
      // Sanity-check the shape we got back; this mirrors the JSON schema the
      // model was forced into so a mismatch means the contract drifted.
      const row = (data as { report?: unknown })?.report as GapReport | undefined;
      if (row) {
        const parse = GapReportSchema.safeParse({
          problem_clarity: row.problem_clarity,
          evidence_of_demand: row.evidence_of_demand,
          competitor_density: row.competitor_density,
          differentiation_angle: row.differentiation_angle,
          verdict: row.verdict,
          verdict_reasoning: row.verdict_reasoning,
          next_steps: row.next_steps,
          citations: row.citations ?? [],
        });
        if (!parse.success) {
          // Don't block the UI — just warn so we can iterate on the prompt.
          console.warn("GapReport schema drift", parse.error.flatten());
        }
      }
      qc.invalidateQueries({ queryKey: ["gap_reports", projectId] });
      toast.success("Gap report ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="size-9 rounded-xl bg-terracotta/15 text-terracotta flex items-center justify-center shrink-0">
          <ShieldCheck className="size-4" />
        </div>
        <div>
          <h3 className="font-serif text-lg font-medium leading-tight">Validate this idea</h3>
          <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mt-1">
            structured gap report · build · iterate · kill
          </p>
        </div>
      </div>

      <Textarea
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        placeholder="Describe the idea in 1–3 sentences. Who is it for, what's the moment of pain, what would they pay for?"
        className="min-h-24"
        maxLength={4000}
      />
      <div className="flex flex-wrap gap-2 mt-3">
        <Button onClick={validate} disabled={!!busy || !idea.trim()} className="rounded-full">
          {busy === "validate" ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="size-4 mr-2" />
          )}
          Run gap report
        </Button>
        <Button
          variant="outline"
          onClick={ingest}
          disabled={!!busy || !idea.trim()}
          className="rounded-full"
          title="Pull related Reddit + Hacker News signals first so the report can cite them"
        >
          {busy === "ingest" ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <Sprout className="size-4 mr-2" />
          )}
          Pull web signals first
        </Button>
      </div>

      {latest && <ReportView report={latest} />}
    </div>
  );
}

function ReportView({ report }: { report: GapReport }) {
  // Stored values are JSON columns typed as `Json`; cast through the shared
  // schema's TS type for clean field access in the UI.
  const pc = report.problem_clarity as unknown as GapReportShape["problem_clarity"];
  const ed = report.evidence_of_demand as unknown as GapReportShape["evidence_of_demand"];
  const cd = report.competitor_density as unknown as GapReportShape["competitor_density"];
  const da = report.differentiation_angle as unknown as GapReportShape["differentiation_angle"];
  const steps = (report.next_steps as unknown as string[]) ?? [];
  const citations = (report.citations as unknown as GapReportShape["citations"]) ?? [];

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-[10px] uppercase tracking-widest font-mono px-2 py-1 rounded ${
            report.verdict === "build"
              ? "bg-sage/20 text-sage"
              : report.verdict === "kill"
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {report.verdict}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          {new Date(report.created_at).toLocaleString()}
        </span>
      </div>

      <p className="text-sm leading-relaxed">{report.verdict_reasoning}</p>

      <div className="grid sm:grid-cols-2 gap-3">
        <ScoreCard title="Problem clarity" score={pc.score} reasoning={pc.reasoning} />
        <ScoreCard
          title="Evidence of demand"
          score={ed.score}
          reasoning={ed.reasoning}
          extra={ed.signals?.length ? <List items={ed.signals} label="Signals" /> : null}
        />
        <ScoreCard
          title="Competitor density"
          score={cd.score}
          reasoning={cd.reasoning}
          extra={cd.examples?.length ? <List items={cd.examples} label="Examples" /> : null}
        />
        <ScoreCard title="Differentiation angle" score={da.score} reasoning={da.reasoning} />
      </div>

      <div>
        <h4 className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-2">
          Next 3 steps (this week)
        </h4>
        <ol className="list-decimal pl-5 space-y-1 text-sm">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>

      {citations.length > 0 && (
        <div>
          <h4 className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-2">
            Citations
          </h4>
          <ul className="space-y-1.5 text-xs">
            {citations.map((c, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-muted-foreground font-mono">[{c.source}]</span>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-terracotta hover:underline inline-flex items-center gap-1 min-w-0"
                >
                  <span className="truncate">{c.snippet.slice(0, 120)}</span>
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ScoreCard({
  title,
  score,
  reasoning,
  extra,
}: {
  title: string;
  score: number;
  reasoning: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium">{title}</span>
        <span className="text-[10px] font-mono text-muted-foreground">{score}/5</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{reasoning}</p>
      {extra}
    </div>
  );
}

function List({ items, label }: { items: string[]; label: string }) {
  return (
    <div className="mt-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </div>
      <ul className="text-xs space-y-0.5 list-disc pl-4">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
