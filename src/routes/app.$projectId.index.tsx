import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/gapfriend/Dashboard";

export const Route = createFileRoute("/app/$projectId/")({
  component: ProjectOverview,
});

function ProjectOverview() {
  const { projectId } = Route.useParams();
  return <Dashboard projectId={projectId} />;
}
