import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useGapCards,
  useBrief,
  useIdentity,
  useTasks,
  type Project,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import {
  Plus,
  ArrowRight,
  Sparkles,
  Moon,
  Sun,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { deriveNextAction, type NextAction } from "@/lib/next-action";
import { toast } from "sonner";

export const Route = createFileRoute("/app/")({
  component: PortfolioHub,
});

const ACTIVE_PREVIEW_LIMIT = 3;
const QUIET_DAYS = 7;

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

  // Most recently touched, non-parked project — surfaced as the hero.
  const { active, resting, mostRecent } = useMemo(() => {
    const all = projects ?? [];
    const active = all
      .filter((p) => !p.parked_at)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    const resting = all
      .filter((p) => !!p.parked_at)
      .sort((a, b) => new Date(b.parked_at ?? 0).getTime() - new Date(a.parked_at ?? 0).getTime());
    return { active, resting, mostRecent: active[0] };
  }, [projects]);

  const [showAllActive, setShowAllActive] = useState(false);
  const [showResting, setShowResting] = useState(false);

  const visibleActive =
    showAllActive || active.length <= ACTIVE_PREVIEW_LIMIT
      ? active
      : active.slice(0, ACTIVE_PREVIEW_LIMIT);

  return (
    <div className="min-h-dvh bg-background">
      <header className="h-16 px-6 lg:px-10 border-b border-border flex items-center justify-between bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <Link to="/app" className="flex items-center gap-2">
          <span className="size-8 rounded-lg bg-terracotta-soft text-terracotta flex items-center justify-center">
            <Sparkles className="size-4" />
          </span>
          <span className="font-serif text-lg font-medium tracking-tight">GapFriend</span>
        </Link>
        <Link
          to="/community"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Community
        </Link>
      </header>

      <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Portfolio
            </p>
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
          <div className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
            Loading…
          </div>
        ) : (projects?.length ?? 0) === 0 ? (
          <EmptyState onCreate={newProject} />
        ) : (
          <div className="space-y-12">
            {mostRecent && <PickupCard project={mostRecent} />}

            {active.length > 0 && (
              <section>
                <SectionHeader
                  label={mostRecent ? "Other active projects" : "Active projects"}
                  count={active.length - (mostRecent ? 1 : 0)}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {visibleActive
                    .filter((p) => p.id !== mostRecent?.id)
                    .map((p) => (
                      <ProjectCard key={p.id} project={p} />
                    ))}
                </div>
                {!showAllActive && active.length > ACTIVE_PREVIEW_LIMIT && (
                  <button
                    type="button"
                    onClick={() => setShowAllActive(true)}
                    className="mt-5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Show {active.length - ACTIVE_PREVIEW_LIMIT} more →
                  </button>
                )}
              </section>
            )}

            {resting.length > 0 && (
              <section>
                <button
                  type="button"
                  onClick={() => setShowResting((v) => !v)}
                  className="w-full flex items-center justify-between text-left mb-5 group"
                  aria-expanded={showResting}
                >
                  <div className="flex items-center gap-3">
                    <Moon className="size-4 text-muted-foreground" />
                    <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                      Resting · {resting.length}
                    </span>
                  </div>
                  {showResting ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  )}
                </button>
                {showResting && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {resting.map((p) => (
                      <ProjectCard key={p.id} project={p} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-card border border-border rounded-3xl p-12 text-center">
      <div className="size-14 rounded-2xl bg-terracotta-soft text-terracotta flex items-center justify-center mx-auto mb-4">
        <Sparkles className="size-6" />
      </div>
      <h2 className="font-serif text-2xl font-medium">Spin up your first venture</h2>
      <p className="text-muted-foreground mt-2">
        A project gives you gaps, a brief, identity, money, tasks — all in one place.
      </p>
      <Button onClick={onCreate} className="rounded-full mt-6">
        <Plus className="size-4 mr-2" /> Create project
      </Button>
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {label} · {count}
      </p>
    </div>
  );
}

/* ------------------------------- Pickup card ------------------------------ */

function PickupCard({ project }: { project: Project }) {
  const next = useProjectNextAction(project.id);
  const lastTouched = formatRelative(project.updated_at);

  return (
    <section
      aria-labelledby="pickup-title"
      className="relative overflow-hidden bg-card border border-border rounded-3xl p-7 md:p-10 shadow-warm-sm"
    >
      <div className="absolute top-0 right-0 w-72 h-72 bg-terracotta-soft/40 rounded-bl-[120px] -mr-10 -mt-10 pointer-events-none" />
      <div className="relative">
        <p className="font-mono text-xs uppercase tracking-widest text-terracotta">
          Pick up where you left off
        </p>
        <h2
          id="pickup-title"
          className="mt-2 font-serif text-3xl md:text-4xl font-medium tracking-tight"
        >
          {project.working_name}
        </h2>
        {project.tagline && (
          <p className="mt-2 font-serif italic text-lg text-muted-foreground">
            "{project.tagline}"
          </p>
        )}
        {project.resume_note && (
          <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl whitespace-pre-line">
            {project.resume_note}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {next ? (
            <Link to={next.to}>
              <Button className="rounded-full">
                Continue: {next.label}
                <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </Link>
          ) : (
            <Link to="/app/$projectId" params={{ projectId: project.id }}>
              <Button className="rounded-full">
                Open project
                <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </Link>
          )}
          <Link
            to="/app/$projectId"
            params={{ projectId: project.id }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Open dashboard
          </Link>
          <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Last touched {lastTouched}
          </span>
        </div>
        {next && <p className="mt-3 text-sm text-muted-foreground max-w-2xl">{next.hint}</p>}
      </div>
    </section>
  );
}

function useProjectNextAction(projectId: string): NextAction | null {
  const { data: gaps } = useGapCards(projectId);
  const { data: brief } = useBrief(projectId);
  const { data: identity } = useIdentity(projectId);
  const { data: tasks } = useTasks(projectId);
  return deriveNextAction({ projectId, gaps, brief, identity, tasks });
}

/* ------------------------------ Project card ------------------------------ */

function ProjectCard({ project }: { project: Project }) {
  const updateProject = useUpdateProject();
  const isResting = !!project.parked_at;
  const updatedAt = new Date(project.updated_at);
  const daysSince = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
  const isQuiet = !isResting && daysSince >= QUIET_DAYS;

  async function toggleParked(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await updateProject.mutateAsync({
        id: project.id,
        parked_at: isResting ? null : new Date().toISOString(),
      });
      toast.success(
        isResting
          ? `${project.working_name} is back in your active list.`
          : `${project.working_name} is resting. It'll be here when you want it.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update project");
    }
  }

  return (
    <Link
      to="/app/$projectId"
      params={{ projectId: project.id }}
      className={[
        "group relative bg-card border border-border rounded-2xl p-6 hover:shadow-warm transition-all hover:-translate-y-0.5",
        isResting ? "opacity-75" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="size-10 rounded-xl bg-terracotta-soft text-terracotta flex items-center justify-center font-serif text-sm font-medium shrink-0">
          {project.working_name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-lg font-medium leading-tight truncate">
            {project.working_name}
          </h3>
          {project.tagline && (
            <p className="text-xs text-muted-foreground italic mt-0.5 line-clamp-1">
              {project.tagline}
            </p>
          )}
        </div>
      </div>

      {project.description && (
        <p className="text-sm text-muted-foreground line-clamp-3">{project.description}</p>
      )}

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        {isResting && <Pill tone="muted" icon={<Moon className="size-3" />} label="Resting" />}
        {isQuiet && <Pill tone="quiet" label={`Quiet · ${daysSince}d`} />}
        <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {formatRelative(project.updated_at)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={toggleParked}
          disabled={updateProject.isPending}
          className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {isResting ? (
            <>
              <Sun className="size-3" /> Wake up
            </>
          ) : (
            <>
              <Moon className="size-3" /> Park it
            </>
          )}
        </button>
        <ArrowRight className="size-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}

function Pill({
  tone,
  label,
  icon,
}: {
  tone: "muted" | "quiet" | "sage";
  label: string;
  icon?: React.ReactNode;
}) {
  const cls = tone === "sage" ? "bg-sage/15 text-sage" : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-mono ${cls}`}
    >
      {icon}
      {label}
    </span>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}
