import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Beaker, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$projectId/simulator")({
  component: SimulatorPage,
});

function SimulatorPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const [idea, setIdea] = useState("");
  const [persona, setPersona] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: sims } = useQuery({
    queryKey: ["simulations", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulations")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function run() {
    if (!idea.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("gapfriend-simulate", {
        body: { projectId, idea, persona: persona || undefined },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      qc.invalidateQueries({ queryKey: ["simulations", projectId] });
      setIdea("");
      setPersona("");
      toast.success("Simulation run");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 lg:px-12 py-10 max-w-4xl mx-auto space-y-6 pb-20">
      <header>
        <p className="text-[10px] uppercase tracking-widest font-mono text-terracotta">Discover</p>
        <h1 className="font-serif text-4xl font-medium mt-1">Simulator</h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          Pitch an idea to a synthetic persona. See where they push back.
        </p>
      </header>

      <div className="bg-card rounded-3xl border border-border p-6 shadow-warm-sm space-y-3">
        <input
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          placeholder="Persona (optional) — e.g. 'busy parent in their 40s'"
          className="w-full bg-background border border-border rounded-2xl px-4 py-2.5 text-sm"
        />
        <Textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="Pitch the idea in a few sentences…"
          className="min-h-[120px] resize-none rounded-2xl"
        />
        <div className="flex justify-end">
          <Button className="rounded-full" disabled={busy || !idea.trim()} onClick={run}>
            {busy ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Beaker className="size-4 mr-2" />
            )}
            Run simulation
          </Button>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
          Past runs
        </h2>
        {!sims?.length ? (
          <p className="text-sm text-muted-foreground italic">No simulations yet.</p>
        ) : (
          <div className="space-y-3">
            {sims.map((s) => {
              const reactions =
                (s.reactions as Array<{
                  name?: string;
                  reaction?: string;
                  would_pay?: boolean;
                }> | null) ?? [];
              const verdictColor =
                s.verdict === "strong"
                  ? "bg-sage/15 text-sage border-sage/30"
                  : s.verdict === "kill"
                    ? "bg-destructive/15 text-destructive border-destructive/30"
                    : "bg-muted text-muted-foreground border-border";
              return (
                <details key={s.id} className="bg-card rounded-2xl border border-border p-5">
                  <summary className="cursor-pointer flex items-start justify-between gap-3">
                    <span className="font-serif text-base font-medium flex-1">
                      {s.idea?.slice(0, 100)}
                      {(s.idea?.length ?? 0) > 100 ? "…" : ""}
                    </span>
                    {s.verdict && (
                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${verdictColor}`}
                      >
                        {s.verdict.replace("_", " ")}
                      </span>
                    )}
                  </summary>
                  <div className="mt-4 space-y-3 text-sm">
                    {s.persona && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">Persona:</span> {s.persona}
                      </p>
                    )}
                    {reactions.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-2">
                          Reactions
                        </div>
                        <div className="space-y-2">
                          {reactions.map((r, i) => (
                            <div key={i} className="p-3 rounded-xl bg-muted/40">
                              {(r.name || typeof r.would_pay === "boolean") && (
                                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2">
                                  {r.name && <span>{r.name}</span>}
                                  {typeof r.would_pay === "boolean" && (
                                    <span
                                      className={
                                        r.would_pay ? "text-sage" : "text-muted-foreground"
                                      }
                                    >
                                      · {r.would_pay ? "would pay" : "wouldn't pay"}
                                    </span>
                                  )}
                                </div>
                              )}
                              <p>{r.reaction}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {s.objections && <Block label="Objections">{s.objections}</Block>}
                    {s.hooks && <Block label="Hooks">{s.hooks}</Block>}
                    {s.recommendation && <Block label="Recommendation">{s.recommendation}</Block>}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-1">
        {label}
      </div>
      <p className="text-foreground whitespace-pre-wrap">{children}</p>
    </div>
  );
}
