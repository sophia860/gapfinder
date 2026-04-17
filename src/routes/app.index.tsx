import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useProjects } from "@/lib/queries";
import { Dashboard } from "@/components/gapfriend/Dashboard";

type IndexSearch = { p?: string };

export const Route = createFileRoute("/app/")({
  validateSearch: (search: Record<string, unknown>): IndexSearch => ({
    p: typeof search.p === "string" ? search.p : undefined,
  }),
  component: AppIndex,
});

function AppIndex() {
  const { user } = useAuth();
  const { data: projects } = useProjects(user?.id);
  const search = useSearch({ from: "/app/" });
  const activeId = (search.p && projects?.find((p) => p.id === search.p)?.id) || projects?.[0]?.id;

  if (!activeId) {
    return (
      <div className="p-12 max-w-3xl mx-auto">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Spinning up</p>
        <h1 className="mt-3 font-serif text-3xl font-medium">Preparing your workspace…</h1>
      </div>
    );
  }

  return <Dashboard projectId={activeId} />;
}
