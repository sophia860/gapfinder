import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useGapCards } from "@/lib/queries";
import { Lightbulb, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$projectId/gaps")({
  component: GapsPage,
});

function GapsPage() {
  const { projectId } = Route.useParams();
  const { data: gaps } = useGapCards(projectId);
  const qc = useQueryClient();
  const [busyAction, setBusyAction] = useState<string | null>(null);

  async function askGapFriend() {
    setBusyAction("generate");
    try {
      const { data, error } = await supabase.functions.invoke("gapfriend-chat", {
        body: {
          projectId,
          message:
            "Suggest 5 specific market gaps for me based on my profile and project so far. Use the add_gap_cards tool.",
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      qc.invalidateQueries({ queryKey: ["gaps", projectId] });
      qc.invalidateQueries({ queryKey: ["chat", projectId] });
      toast.success("GapFriend found some gaps");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reach GapFriend");
    } finally {
      setBusyAction(null);
    }
  }

  async function setGapStatus(id: string, status: "selected" | "dismissed") {
    const { error } = await supabase.from("gap_cards").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["gaps", projectId] });
    if (status === "selected") {
      toast.success("Gap selected. Ask GapFriend to turn this into an opportunity brief.");
    }
  }

  async function createBrief(gapTitle: string) {
    setBusyAction("brief");
    try {
      const { data, error } = await supabase.functions.invoke("gapfriend-chat", {
        body: {
          projectId,
          message: `Turn the selected gap "${gapTitle}" into a tight opportunity brief (persona, problem, angle, business_model). Use save_opportunity_brief. Then add 3 concrete validation tasks for this week using add_tasks.`,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      qc.invalidateQueries({ queryKey: ["brief", projectId] });
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["chat", projectId] });
      toast.success("Brief created with tasks");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create brief");
    } finally {
      setBusyAction(null);
    }
  }

  const suggestedGaps = gaps?.filter((g) => g.status === "suggested") ?? [];
  const selectedGap = gaps?.find((g) => g.status === "selected");
  const dismissedGaps = gaps?.filter((g) => g.status === "dismissed") ?? [];

  return (
    <div className="px-6 lg:px-12 py-10 max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <section className="bg-card rounded-3xl border border-border p-8 md:p-10 shadow-warm-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-sage/20 rounded-bl-[120px] -mr-10 -mt-10 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-xl bg-sage/20 text-sage flex items-center justify-center">
              <Lightbulb className="size-6" />
            </div>
            <div>
              <h1 className="font-serif text-4xl md:text-5xl font-medium">Market gaps</h1>
              <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest mt-1">
                opportunities to explore
              </p>
            </div>
          </div>
          <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
            These are potential market gaps where your skills and interests align with unmet needs.
            Pick one to explore further and turn it into an opportunity brief.
          </p>
          <div className="mt-6">
            <Button
              className="rounded-full"
              disabled={!!busyAction}
              onClick={askGapFriend}
            >
              {busyAction === "generate" ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Lightbulb className="size-4 mr-2" />
              )}
              {gaps?.length ? "Find more gaps" : "Find market gaps"}
            </Button>
          </div>
        </div>
      </section>

      {/* Selected gap */}
      {selectedGap && (
        <section className="bg-card rounded-2xl border-2 border-sage p-6 shadow-warm-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="size-9 rounded-xl bg-sage/20 text-sage flex items-center justify-center shrink-0">
              <Check className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest font-mono text-sage mb-1">
                Currently exploring
              </div>
              <h2 className="font-serif text-2xl font-medium mb-2">{selectedGap.title}</h2>
              {selectedGap.persona && (
                <p className="text-sm text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">Who:</span> {selectedGap.persona}
                </p>
              )}
              {selectedGap.problem && (
                <p className="text-sm text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">Problem:</span> {selectedGap.problem}
                </p>
              )}
              {selectedGap.why_gap && (
                <p className="text-sm text-muted-foreground italic mt-2">{selectedGap.why_gap}</p>
              )}
              {selectedGap.difficulty && (
                <span className="inline-block mt-3 text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded bg-muted text-muted-foreground">
                  {selectedGap.difficulty}
                </span>
              )}
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  className="rounded-full"
                  disabled={!!busyAction}
                  onClick={() => createBrief(selectedGap.title)}
                >
                  {busyAction === "brief" ? (
                    <Loader2 className="size-3.5 mr-2 animate-spin" />
                  ) : null}
                  Turn into brief + tasks
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setGapStatus(selectedGap.id, "suggested")}
                >
                  Unselect
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Suggested gaps */}
      {suggestedGaps.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-medium text-muted-foreground">
            Gaps to consider ({suggestedGaps.length})
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {suggestedGaps.map((gap) => (
              <div
                key={gap.id}
                className="bg-card rounded-2xl border border-border p-5 shadow-warm-sm hover:shadow-warm transition-shadow"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-serif text-lg font-medium leading-snug flex-1">
                    {gap.title}
                  </h3>
                  {gap.difficulty && (
                    <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      {gap.difficulty}
                    </span>
                  )}
                </div>
                {gap.persona && (
                  <p className="text-sm text-muted-foreground mb-1">
                    <span className="font-medium text-foreground/80">Who:</span> {gap.persona}
                  </p>
                )}
                {gap.problem && (
                  <p className="text-sm text-muted-foreground mb-1">
                    <span className="font-medium text-foreground/80">Problem:</span> {gap.problem}
                  </p>
                )}
                {gap.why_gap && (
                  <p className="text-sm text-muted-foreground italic mt-2">{gap.why_gap}</p>
                )}
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    className="rounded-full h-8 text-xs"
                    onClick={() => setGapStatus(gap.id, "selected")}
                  >
                    <Check className="size-3 mr-1" /> Pick this
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full h-8 text-xs"
                    onClick={() => setGapStatus(gap.id, "dismissed")}
                  >
                    <X className="size-3 mr-1" /> Pass
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Dismissed gaps */}
      {dismissedGaps.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-medium text-muted-foreground">
            Passed ({dismissedGaps.length})
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {dismissedGaps.map((gap) => (
              <div
                key={gap.id}
                className="bg-muted/30 rounded-xl border border-border/50 p-4 opacity-60"
              >
                <h3 className="font-serif text-base font-medium mb-1">{gap.title}</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full h-7 text-xs mt-2"
                  onClick={() => setGapStatus(gap.id, "suggested")}
                >
                  Reconsider
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!gaps || gaps.length === 0 ? (
        <section className="bg-card rounded-2xl border border-border p-12 text-center">
          <Lightbulb className="size-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-serif text-xl font-medium mb-2">No gaps yet</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Ask GapFriend to analyze your skills and interests to find market opportunities.
          </p>
        </section>
      ) : null}
    </div>
  );
}
