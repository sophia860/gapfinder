import { createFileRoute } from "@tanstack/react-router";
import { Map as MapIcon } from "lucide-react";

export const Route = createFileRoute("/app/$projectId/roadmap")({
  component: RoadmapPage,
});

function RoadmapPage() {
  const { projectId } = Route.useParams();

  return (
    <div className="px-6 lg:px-12 py-10 max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <section className="bg-card rounded-3xl border border-border p-8 md:p-10 shadow-warm-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-terracotta-soft/40 rounded-bl-[120px] -mr-10 -mt-10 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-xl bg-terracotta-soft text-terracotta flex items-center justify-center">
              <MapIcon className="size-6" />
            </div>
            <div>
              <h1 className="font-serif text-4xl md:text-5xl font-medium">Roadmap</h1>
              <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest mt-1">
                timeline & milestones
              </p>
            </div>
          </div>
          <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
            Your project roadmap will help you plan milestones and track progress over time.
          </p>
        </div>
      </section>

      {/* Coming soon */}
      <section className="bg-card rounded-2xl border border-border p-12 text-center">
        <MapIcon className="size-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="font-serif text-xl font-medium mb-2">Roadmap coming soon</h3>
        <p className="text-sm text-muted-foreground">
          This feature is under development. For now, use the Board to manage your tasks.
        </p>
      </section>
    </div>
  );
}
