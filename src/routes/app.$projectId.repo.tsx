import { createFileRoute } from "@tanstack/react-router";
import { RepoConnect } from "@/components/gapfriend/RepoConnect";

export const Route = createFileRoute("/app/$projectId/repo")({
  component: RepoPage,
});

function RepoPage() {
  const { projectId } = Route.useParams();
  return <RepoConnect projectId={projectId} />;
}
