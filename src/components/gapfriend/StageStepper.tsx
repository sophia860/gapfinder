import { useNavigate } from "@tanstack/react-router";
import { useBrief, useGapCards, useTasks } from "@/lib/queries";
import { Compass, Target, Rocket, Check } from "lucide-react";

interface Props {
  projectId: string;
}

export type Stage = "discover" | "decide" | "execute";

/** Auto-derive current stage from project data. */
export function useDerivedStage(projectId: string): Stage {
  const { data: gaps } = useGapCards(projectId);
  const { data: brief } = useBrief(projectId);
  const { data: tasks } = useTasks(projectId);

  const briefLocked = !!(brief?.persona && brief?.problem && brief?.angle);
  const hasActiveTasks =
    (tasks?.filter((t) => t.column_name === "this_week" || t.column_name === "in_progress")
      .length ?? 0) > 0;

  if (briefLocked && hasActiveTasks) return "execute";
  if (briefLocked) return "decide";
  if (gaps?.some((g) => g.status === "selected")) return "decide";
  return "discover";
}

export function StageStepper({ projectId }: Props) {
  const navigate = useNavigate();
  const stage = useDerivedStage(projectId);

  const stages: {
    id: Stage;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    to: string;
  }[] = [
    { id: "discover", label: "Discover", icon: Compass, to: `/app/${projectId}/gaps` },
    { id: "decide", label: "Decide", icon: Target, to: `/app/${projectId}/brief` },
    { id: "execute", label: "Execute", icon: Rocket, to: `/app/${projectId}/board` },
  ];

  const currentIdx = stages.findIndex((s) => s.id === stage);

  return (
    <div className="flex items-center gap-1.5">
      {stages.map((s, i) => {
        const reached = i <= currentIdx;
        const current = i === currentIdx;
        const Icon = reached ? Check : s.icon;
        return (
          <div key={s.id} className="flex items-center gap-1.5">
            <button
              onClick={() => navigate({ to: s.to })}
              className={[
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                current
                  ? "bg-terracotta text-primary-foreground"
                  : reached
                    ? "bg-sage/20 text-sage hover:bg-sage/30"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
              ].join(" ")}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < stages.length - 1 && (
              <div className={`h-px w-4 ${i < currentIdx ? "bg-sage/40" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
