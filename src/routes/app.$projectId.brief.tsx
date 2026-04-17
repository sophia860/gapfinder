import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useBrief, useGapCards } from "@/lib/queries";
import { Compass, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$projectId/brief")({
  component: BriefPage,
});

function BriefPage() {
  const { projectId } = Route.useParams();
  const { data: brief } = useBrief(projectId);
  const { data: gaps } = useGapCards(projectId);
  const qc = useQueryClient();
  const [busyAction, setBusyAction] = useState(false);

  const selectedGap = gaps?.find((g) => g.status === "selected");

  async function askGapFriend() {
    setBusyAction(true);
    try {
      const message = selectedGap
        ? `Turn the selected gap "${selectedGap.title}" into a tight opportunity brief (persona, problem, angle, business_model). Use save_opportunity_brief.`
        : "Create an opportunity brief based on my project. Include persona, problem, angle, and business_model. Use save_opportunity_brief.";

      const { data, error } = await supabase.functions.invoke("gapfriend-chat", {
        body: { projectId, message },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      qc.invalidateQueries({ queryKey: ["brief", projectId] });
      qc.invalidateQueries({ queryKey: ["chat", projectId] });
      toast.success("Brief updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update brief");
    } finally {
      setBusyAction(false);
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
              <Compass className="size-6" />
            </div>
            <div>
              <h1 className="font-serif text-4xl md:text-5xl font-medium">Opportunity brief</h1>
              <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest mt-1">
                what & for whom
              </p>
            </div>
          </div>
          <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
            A tight brief that captures who you're serving, what problem you're solving, your unique
            angle, and how the business works.
          </p>
          <div className="mt-6">
            <Button className="rounded-full" disabled={busyAction} onClick={askGapFriend}>
              {busyAction ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Compass className="size-4 mr-2" />
              )}
              {brief ? "Refine brief" : selectedGap ? "Create brief from gap" : "Create brief"}
            </Button>
          </div>
        </div>
      </section>

      {/* Brief content */}
      {brief ? (
        <section className="space-y-6">
          {/* Persona */}
          {brief.persona && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                Who (Persona)
              </h2>
              <p className="text-base leading-relaxed">{brief.persona}</p>
            </div>
          )}

          {/* Problem */}
          {brief.problem && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                Problem
              </h2>
              <p className="text-base leading-relaxed">{brief.problem}</p>
            </div>
          )}

          {/* Angle */}
          {brief.angle && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                Angle
              </h2>
              <p className="text-base leading-relaxed">{brief.angle}</p>
            </div>
          )}

          {/* Business Model */}
          {brief.business_model && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                Business Model
              </h2>
              <p className="text-base leading-relaxed">{brief.business_model}</p>
            </div>
          )}

          {/* Success metrics */}
          {brief.success_metrics && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                Success Metrics
              </h2>
              <p className="text-base leading-relaxed">{brief.success_metrics}</p>
            </div>
          )}

          {/* Risks */}
          {brief.risks && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                Risks
              </h2>
              <p className="text-base leading-relaxed">{brief.risks}</p>
            </div>
          )}
        </section>
      ) : selectedGap ? (
        <section className="bg-card rounded-2xl border border-border p-8 text-center">
          <Compass className="size-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-serif text-xl font-medium mb-2">Ready to create your brief</h3>
          <p className="text-sm text-muted-foreground mb-6">
            You've selected the gap "{selectedGap.title}". Click the button above to turn it into a
            detailed opportunity brief.
          </p>
        </section>
      ) : (
        <section className="bg-card rounded-2xl border border-border p-8 text-center">
          <Compass className="size-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-serif text-xl font-medium mb-2">No brief yet</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Start by selecting a market gap, or ask GapFriend to help you create a brief from
            scratch.
          </p>
        </section>
      )}
    </div>
  );
}
