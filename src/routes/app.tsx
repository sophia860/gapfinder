import { createFileRoute, redirect, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useProfile, useProjects, useCreateProject } from "@/lib/queries";

export const Route = createFileRoute("/app")({
  component: AppGate,
});

/** Auth + onboarding gate. Renders Outlet for child routes. */
function AppGate() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id);
  const { data: projects, isLoading: projectsLoading } = useProjects(user?.id);
  const createProject = useCreateProject();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!profileLoading && profile && !profile.onboarding_completed && location.pathname !== "/app/onboarding") {
      navigate({ to: "/app/onboarding" });
    }
  }, [profile, profileLoading, location.pathname, navigate]);

  // Auto-create first project after onboarding if none
  useEffect(() => {
    if (!user || !profile?.onboarding_completed) return;
    if (projectsLoading) return;
    if ((projects?.length ?? 0) === 0 && !createProject.isPending) {
      createProject.mutate({ user_id: user.id, working_name: "My first venture" });
    }
  }, [user, profile, projects, projectsLoading, createProject]);

  if (loading || profileLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) return null;

  return <Outlet />;
}
