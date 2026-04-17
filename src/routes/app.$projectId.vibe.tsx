import { createFileRoute } from "@tanstack/react-router";
import { VibeStudio } from "@/components/gapfriend/VibeStudio";

export const Route = createFileRoute("/app/$projectId/vibe")({
  component: VibeCoding,
});

function VibeCoding() {
  const { projectId } = Route.useParams();
  return <VibeStudio projectId={projectId} />;
}
