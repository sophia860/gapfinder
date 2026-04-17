import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Rocket, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$projectId/capital")({
  component: CapitalPage,
});

function CapitalPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function ask(message: string) {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("gapfriend-chat", {
        body: { projectId, message },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      qc.invalidateQueries({ queryKey: ["chat", projectId] });
      toast.success("Asked GapFriend — open the bubble for the answer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reach GapFriend");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 lg:px-12 py-10 max-w-3xl mx-auto space-y-6 pb-20">
      <header>
        <p className="text-[10px] uppercase tracking-widest font-mono text-terracotta">Execute</p>
        <h1 className="font-serif text-4xl font-medium mt-1">Capital</h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          Bootstrapping, grants, loans, equity — what fits your stage.
        </p>
      </header>

      <div className="bg-card rounded-3xl border border-border p-8 shadow-warm-sm">
        <Rocket className="size-6 text-terracotta mb-3" />
        <p className="text-foreground leading-relaxed">
          Ask GapFriend about funding paths that fit your jurisdiction, stage, and mission.
        </p>
        <div className="flex flex-wrap gap-2 mt-5">
          <Button
            variant="outline"
            className="rounded-full"
            disabled={busy}
            onClick={() =>
              ask(
                "Given my profile and project, what funding paths fit best (bootstrap, grants, loans, equity, revenue-based)? Be specific to my jurisdiction and stage.",
              )
            }
          >
            {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
            Suggest funding paths
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            disabled={busy}
            onClick={() =>
              ask(
                "What grants or non-dilutive funding programs could fit this project? List 3-5 with eligibility, amount, and where to apply.",
              )
            }
          >
            Find grants
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            disabled={busy}
            onClick={() =>
              ask("Build a simple bootstrapping plan — first 3 months of cashflow assumptions.")
            }
          >
            Bootstrap plan
          </Button>
        </div>
      </div>
    </div>
  );
}
