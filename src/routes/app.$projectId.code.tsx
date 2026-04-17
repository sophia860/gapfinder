import { createFileRoute } from "@tanstack/react-router";
import { CodingSpace } from "@/components/gapfriend/CodingSpace";

export const Route = createFileRoute("/app/$projectId/code")({
  component: Code,
});

function Code() {
  const { projectId } = Route.useParams();
  return <CodingSpace projectId={projectId} />;
}
