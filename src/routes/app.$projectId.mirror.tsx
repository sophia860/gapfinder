import { createFileRoute } from "@tanstack/react-router";
import { FounderMirror } from "@/components/gapfriend/FounderMirror";

export const Route = createFileRoute("/app/$projectId/mirror")({
  component: MirrorPage,
});

function MirrorPage() {
  const { projectId } = Route.useParams();
  return <FounderMirror projectId={projectId} />;
}
