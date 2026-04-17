import { createFileRoute } from "@tanstack/react-router";
import { useBrief, useGapCards } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Compass, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$projectId/brief")({
  component: BriefPage,
});

function BriefPage() {
  const { projectId } = Route.useParams();
  const { data: brief } = useBrief(projectId);
  const { data: gaps } = useGapCards(projectId);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const selectedGap = gaps?.find((g) => g.status === "selected");

  async function ask() {
    setBusy(true);
    try {
      const prompt = selectedGap
        ? `Turn the selected gap "${selectedGap.title}" into a tight opportunity brief (persona, problem, angle, business_model). Use save_opportunity_brief.`
        : "Draft an opportunity brief for this project (persona, problem, angle, business_model). Use save_opportunity_brief.";
      const { data, error } = await supabase.functions.invoke("gapfriend-chat", {
        body: { projectId, message: prompt },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      qc.invalidateQueries({ queryKey: ["brief", projectId] });
      qc.invalidateQueries({ queryKey: ["chat", projectId] });
      toast.success("Brief updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reach GapFriend");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 lg:px-12 py-10 max-w-3xl mx-auto space-y-6 pb-20">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-mono text-terracotta">Decide</p>
          <h1 className="font-serif text-4xl font-medium mt-1">Opportunity brief</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            One page that explains who you serve, what hurts, your angle, and how it makes money.
          </p>
        </div>
        <Button className="rounded-full" disabled={busy} onClick={ask}>
          {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Compass className="size-4 mr-2" />}
          {brief ? "Refine brief" : "Draft brief"}
        </Button>
      </header>

      <div className="bg-card rounded-3xl border border-border p-8 shadow-warm-sm space-y-6">
        <Field label="Persona" value={brief?.persona} />
        <Field label="Problem" value={brief?.problem} />
        <Field label="Angle" value={brief?.angle} />
        <Field label="Business model" value={brief?.business_model} />
        {!brief && (
          <p className="text-sm text-muted-foreground italic">
            No brief yet. {selectedGap ? `Picked: "${selectedGap.title}".` : "Pick a gap first, or just draft one now."}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
        {label}
      </div>
      <p className="mt-1.5 leading-relaxed text-foreground">
        {value || <span className="text-muted-foreground italic">—</span>}
      </p>
    </div>
  );
}
