import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useProjects, useCreateProject } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/")({
  component: PortfolioHub,
});

function PortfolioHub() {
  const { user } = useAuth();
  const { data: projects, isLoading } = useProjects(user?.id);
  const createProject = useCreateProject();
  const navigate = useNavigate();

  async function newProject() {
    if (!user) return;
    const proj = await createProject.mutateAsync({ user_id: user.id, working_name: "New venture" });
    navigate({ to: "/app/$projectId", params: { projectId: proj.id } });
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="h-16 px-6 lg:px-10 border-b border-border flex items-center justify-between bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <Link to="/app" className="flex items-center gap-2">
          <span className="size-8 rounded-lg bg-terracotta-soft text-terracotta flex items-center justify-center">
            <Sparkles className="size-4" />
          </span>
          <span className="font-serif text-lg font-medium tracking-tight">GapFriend</span>
        </Link>
      </header>

      <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Portfolio</p>
            <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">Your ventures</h1>
            <p className="mt-2 text-muted-foreground max-w-xl">
              Each project is its own workspace. GapFriend remembers what's happening in each one.
            </p>
          </div>
          <Button onClick={newProject} className="rounded-full" disabled={createProject.isPending}>
            <Plus className="size-4 mr-2" /> New project
          </Button>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground font-mono text-xs uppercase tracking-widest">Loading…</div>
        ) : (projects?.length ?? 0) === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-12 text-center">
            <div className="size-14 rounded-2xl bg-terracotta-soft text-terracotta flex items-center justify-center mx-auto mb-4">
              <Sparkles className="size-6" />
            </div>
            <h2 className="font-serif text-2xl font-medium">Spin up your first venture</h2>
            <p className="text-muted-foreground mt-2">A project gives you gaps, a brief, identity, money, tasks — all in one place.</p>
            <Button onClick={newProject} className="rounded-full mt-6">
              <Plus className="size-4 mr-2" /> Create project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects?.map((p) => (
              <Link
                key={p.id}
                to="/app/$projectId"
                params={{ projectId: p.id }}
                className="group bg-card border border-border rounded-2xl p-6 hover:shadow-warm transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="size-10 rounded-xl bg-terracotta-soft text-terracotta flex items-center justify-center font-serif text-sm font-medium shrink-0">
                    {p.working_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-serif text-lg font-medium leading-tight truncate">{p.working_name}</h3>
                    {p.tagline && <p className="text-xs text-muted-foreground italic mt-0.5 line-clamp-1">{p.tagline}</p>}
                  </div>
                </div>
                {p.description && <p className="text-sm text-muted-foreground line-clamp-3">{p.description}</p>}
                <div className="mt-4 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  <span>Updated {new Date(p.updated_at).toLocaleDateString()}</span>
                  <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
