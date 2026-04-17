import { createFileRoute, redirect, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfile, useProjects, useCreateProject } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, Plus, LogOut, Sparkles } from "lucide-react";
import { ChatPanel } from "@/components/gapfriend/ChatPanel";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id);
  const { data: projects, isLoading: projectsLoading } = useProjects(user?.id);
  const createProject = useCreateProject();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Redirect to /auth if not signed in
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Force onboarding if not complete
  useEffect(() => {
    if (!profileLoading && profile && !profile.onboarding_completed && !profile.mode && location.pathname !== "/app/onboarding") {
      navigate({ to: "/app/onboarding" });
    }
  }, [profile, profileLoading, location.pathname, navigate]);

  // Auto-create first project after onboarding if none exist
  useEffect(() => {
    if (!user || !profile?.onboarding_completed) return;
    if (projectsLoading) return;
    if ((projects?.length ?? 0) === 0 && !createProject.isPending) {
      createProject.mutate({ user_id: user.id, working_name: "My first venture" });
    }
  }, [user, profile, projects, projectsLoading]); // createProject omitted intentionally — stable mutation object

  // Pick active project from URL or first
  useEffect(() => {
    if (!projects?.length) return;
    const urlProj = new URLSearchParams(location.searchStr).get("p");
    const next = urlProj && projects.find((p) => p.id === urlProj) ? urlProj : projects[0].id;
    if (next !== activeProjectId) setActiveProjectId(next);
  }, [projects, location.searchStr, activeProjectId]);

  if (loading || profileLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) return null;

  // Onboarding: render outlet only (no shell)
  if (!profile?.onboarding_completed || location.pathname === "/app/onboarding") {
    return <Outlet />;
  }

  const activeProject = projects?.find((p) => p.id === activeProjectId);

  return (
    <div className="min-h-dvh bg-background flex">
      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 h-dvh">
        {/* Top bar */}
        <header className="h-16 px-6 lg:px-10 border-b border-border flex items-center justify-between shrink-0 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Link to="/app" className="font-serif text-lg font-medium tracking-tight">
              GapFriend
            </Link>
            <span className="h-5 w-px bg-border" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-secondary transition-colors text-sm">
                  <span className="size-6 rounded-full bg-terracotta-soft text-terracotta flex items-center justify-center font-serif text-xs font-medium">
                    {(activeProject?.working_name ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="font-medium">{activeProject?.working_name ?? "Loading…"}</span>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
                  Your projects
                </div>
                {projects?.map((p) => (
                  <DropdownMenuItem key={p.id} onSelect={() => navigate({ to: "/app", search: { p: p.id } })} className="cursor-pointer">
                    <span className="size-5 rounded-full bg-terracotta-soft text-terracotta flex items-center justify-center font-serif text-[10px] font-medium mr-2">
                      {p.working_name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="truncate">{p.working_name}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={async () => {
                    const proj = await createProject.mutateAsync({ user_id: user.id, working_name: "New venture" });
                    navigate({ to: "/app", search: { p: proj.id } });
                  }}
                  className="cursor-pointer"
                >
                  <Plus className="size-4 mr-2" />
                  New project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-xs text-muted-foreground font-mono uppercase tracking-widest">
              {profile?.mode === "solo_founder" && "Solo founder"}
              {profile?.mode === "freelancer" && "Freelancer"}
              {profile?.mode === "existing_business" && "Business"}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="size-9 rounded-full bg-secondary hover:bg-accent transition-colors flex items-center justify-center text-sm font-medium uppercase">
                  {(profile?.display_name ?? user.email ?? "?").slice(0, 1)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <div className="text-sm font-medium truncate">{profile?.display_name ?? user.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate({ to: "/app/onboarding" })} className="cursor-pointer">
                  <Sparkles className="size-4 mr-2" /> Re-do onboarding
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async () => {
                    await signOut();
                    navigate({ to: "/" });
                  }}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="size-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Outlet for dashboard pages */}
        <div className="flex-1 overflow-y-auto">
          {activeProjectId ? <Outlet /> : (
            <div className="p-12 text-center text-muted-foreground">Setting up your first project…</div>
          )}
        </div>
      </div>

      {/* Persistent chat panel */}
      {activeProjectId && (
        <aside className="hidden lg:flex w-[400px] shrink-0 h-dvh border-l border-border bg-card flex-col">
          <ChatPanel projectId={activeProjectId} projectName={activeProject?.working_name ?? "Project"} />
        </aside>
      )}
    </div>
  );
}
