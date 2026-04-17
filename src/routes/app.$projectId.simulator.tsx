import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useBrief } from "@/lib/queries";
import { Beaker, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$projectId/simulator")({
  component: SimulatorPage,
});

function SimulatorPage() {
  const { projectId } = Route.useParams();
  const { data: brief } = useBrief(projectId);
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    reactions: { name: string; reaction: string; would_pay: boolean }[];
    objections: string;
    hooks: string;
    verdict: "strong" | "needs_work" | "kill";
    recommendation: string;
  } | null>(null);

  async function runSimulation() {
    if (!idea.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("gapfriend-simulate", {
        body: { projectId, idea: idea.trim(), persona: brief?.persona ?? null },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setResult((data as { simulation: NonNullable<typeof result> }).simulation);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 lg:px-12 py-10 max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <section className="bg-card rounded-3xl border border-border p-8 md:p-10 shadow-warm-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-terracotta-soft/40 rounded-bl-[120px] -mr-10 -mt-10 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-xl bg-terracotta-soft text-terracotta flex items-center justify-center">
              <Beaker className="size-6" />
            </div>
            <div>
              <h1 className="font-serif text-4xl md:text-5xl font-medium">Simulator</h1>
              <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest mt-1">
                test ideas with AI personas
              </p>
            </div>
          </div>
          <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
            Describe your idea, hook, or pitch. GapFriend will simulate how real people from your
            target persona would react, what objections they'd raise, and whether they'd pay.
          </p>
        </div>
      </section>

      {/* Simulator form */}
      <section className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
        <label className="block text-sm font-medium mb-3">
          What's your idea, hook, or pitch?
        </label>
        <Textarea
          placeholder="E.g., 'A weekly newsletter for busy founders with 3 tactical insights from real case studies...'"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          className="min-h-[120px] mb-4"
          disabled={busy}
        />
        <Button onClick={runSimulation} disabled={busy || !idea.trim()} className="rounded-full">
          {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Beaker className="size-4 mr-2" />}
          Run simulation
        </Button>
      </section>

      {/* Results */}
      {result && (
        <section className="space-y-6">
          {/* Verdict */}
          <div
            className={`rounded-2xl border-2 p-6 ${
              result.verdict === "strong"
                ? "border-sage bg-sage/10"
                : result.verdict === "needs_work"
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-red-500 bg-red-500/10"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Verdict
              </span>
              <span
                className={`text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
                  result.verdict === "strong"
                    ? "bg-sage text-white"
                    : result.verdict === "needs_work"
                      ? "bg-amber-500 text-white"
                      : "bg-red-500 text-white"
                }`}
              >
                {result.verdict}
              </span>
            </div>
            <p className="text-base leading-relaxed">{result.recommendation}</p>
          </div>

          {/* Reactions */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
              Sample reactions from {brief?.persona || "your target audience"}
            </h2>
            <div className="space-y-4">
              {result.reactions.map((r, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-muted/50 border border-border/50">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-medium text-sm">{r.name}</span>
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        r.would_pay ? "bg-sage/20 text-sage" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.would_pay ? "would pay" : "wouldn't pay"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground italic">"{r.reaction}"</p>
                </div>
              ))}
            </div>
          </div>

          {/* Objections */}
          {result.objections && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                Common objections
              </h2>
              <p className="text-base leading-relaxed">{result.objections}</p>
            </div>
          )}

          {/* Hooks */}
          {result.hooks && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                Better hooks to try
              </h2>
              <p className="text-base leading-relaxed">{result.hooks}</p>
            </div>
          )}
        </section>
      )}

      {/* Empty state */}
      {!result && !busy && (
        <section className="bg-card rounded-2xl border border-border p-12 text-center">
          <Beaker className="size-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-serif text-xl font-medium mb-2">Ready to test your ideas</h3>
          <p className="text-sm text-muted-foreground">
            Enter your idea above and see how your target audience might react.
          </p>
        </section>
      )}
    </div>
  );
}
