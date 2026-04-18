import { createFileRoute } from "@tanstack/react-router";
import { useTasks } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Map as MapIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$projectId/roadmap")({
  component: RoadmapPage,
});

function RoadmapPage() {
  const { projectId } = Route.useParams();
  const { data: tasks } = useTasks(projectId);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const later = tasks?.filter((t) => t.column_name === "later") ?? [];
  const thisWeek = tasks?.filter((t) => t.column_name === "this_week") ?? [];
  const inProgress = tasks?.filter((t) => t.column_name === "in_progress") ?? [];
  const done = tasks?.filter((t) => t.column_name === "done") ?? [];

  async function ask() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("gapfriend-chat", {
        body: {
          projectId,
          message:
            "Plan a 6-week roadmap for this project. Add 8-12 concrete tasks across 'later' and 'this_week' columns using add_tasks. Be specific.",
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["chat", projectId] });
      toast.success("Roadmap updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reach GapFriend");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 lg:px-12 py-10 max-w-4xl mx-auto space-y-6 pb-20">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-mono text-terracotta">Execute</p>
          <h1 className="font-serif text-4xl font-medium mt-1">Roadmap</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Looking ahead. The board is where work happens — this is the bigger arc.
          </p>
        </div>
        <Button className="rounded-full" disabled={busy} onClick={ask}>
          {busy ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <MapIcon className="size-4 mr-2" />
          )}
          Plan 6 weeks
        </Button>
      </header>

      <div className="space-y-5">
        <Lane title="In progress now" items={inProgress} tone="terracotta" />
        <Lane title="This week" items={thisWeek} tone="default" />
        <Lane title="Later" items={later} tone="muted" />
        <Lane title="Done" items={done} tone="sage" />
      </div>
    </div>
  );
}

function Lane({
  title,
  items,
  tone,
}: {
  title: string;
  items: { id: string; title: string }[];
  tone: "terracotta" | "default" | "muted" | "sage";
}) {
  const dot =
    tone === "terracotta"
      ? "bg-terracotta"
      : tone === "sage"
        ? "bg-sage"
        : tone === "muted"
          ? "bg-muted-foreground/40"
          : "bg-foreground";
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className={`size-2 rounded-full ${dot}`} />
        <h2 className="text-[11px] uppercase tracking-widest font-mono">{title}</h2>
        <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Nothing here.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((t) => (
            <li key={t.id} className="text-sm flex items-start gap-2">
              <span className="size-1 rounded-full bg-muted-foreground/40 mt-2 shrink-0" />
              <span>{t.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
