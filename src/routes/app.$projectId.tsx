import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useProjects } from "@/lib/queries";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/gapfriend/AppSidebar";
import { CopilotBubble } from "@/components/gapfriend/CopilotBubble";
import { StageStepper } from "@/components/gapfriend/StageStepper";
import { BackstagePanel } from "@/components/gapfriend/BackstagePanel";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/app/$projectId")({
  component: ProjectShell,
});

const SECTION_LABELS: Record<string, string> = {
  gaps: "Market gaps",
  brief: "Opportunity brief",
  identity: "Identity & naming",
  channels: "Channels",
  roadmap: "Roadmap",
  board: "Board",
  money: "Money",
  capital: "Capital",
  content: "Content",
  simulator: "Simulator",
  vibe: "Vibe coding",
  code: "Coding space",
};

function ProjectShell() {
  const { projectId } = Route.useParams();
  const { user } = useAuth();
  const { data: projects, isLoading } = useProjects(user?.id);
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  const project = projects?.find((p) => p.id === projectId);
  if (!project) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-terracotta">Not found</p>
          <h1 className="mt-3 font-serif text-3xl font-medium">Project not found</h1>
          <Link to="/app" className="mt-4 inline-block text-sm text-terracotta hover:underline">
            ← Back to portfolio
          </Link>
        </div>
      </div>
    );
  }

  // Derive section name from URL: /app/<id>/<section>...
  const segments = location.pathname.split("/").filter(Boolean); // ["app", id, section?]
  const section = segments[2];
  const sectionLabel = section ? (SECTION_LABELS[section] ?? section) : "Overview";

  return (
    <SidebarProvider>
      <div className="min-h-dvh flex w-full bg-background">
        <AppSidebar projectId={projectId} />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar: trigger + breadcrumbs + stage stepper */}
          <header className="h-14 px-4 lg:px-6 border-b border-border flex items-center justify-between gap-4 shrink-0 bg-background/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger />
              <nav className="flex items-center gap-1.5 text-sm min-w-0" aria-label="Breadcrumb">
                <Link
                  to="/app"
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  Portfolio
                </Link>
                <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                <Link
                  to="/app/$projectId"
                  params={{ projectId }}
                  className="text-muted-foreground hover:text-foreground transition-colors truncate"
                >
                  {project.working_name}
                </Link>
                {section && (
                  <>
                    <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{sectionLabel}</span>
                  </>
                )}
              </nav>
            </div>
            <div className="hidden md:block">
              <StageStepper projectId={projectId} />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <ResumeBanner projectId={projectId} />
            <Outlet />
          </main>
        </div>

        <CopilotBubble projectId={projectId} projectName={project.working_name} />
        <BackstagePanel projectId={projectId} />
      </div>
    </SidebarProvider>
  );
}
