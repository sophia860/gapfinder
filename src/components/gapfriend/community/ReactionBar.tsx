import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  useReactions,
  useToggleReaction,
  type ReactionTarget,
  type ReactionKind,
} from "@/lib/queries";
import { toast } from "sonner";

const KINDS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "like", emoji: "👍", label: "Like" },
  { kind: "clap", emoji: "👏", label: "Clap" },
  { kind: "fire", emoji: "🔥", label: "Fire" },
  { kind: "heart", emoji: "❤️", label: "Heart" },
];

interface Props {
  targetType: ReactionTarget;
  targetId: string;
}

export function ReactionBar({ targetType, targetId }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: reactions } = useReactions({ type: targetType, id: targetId });
  const toggle = useToggleReaction();

  const counts = new Map<ReactionKind, number>();
  const mine = new Set<ReactionKind>();
  for (const r of reactions ?? []) {
    counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
    if (user && r.user_id === user.id) mine.add(r.kind);
  }

  async function onToggle(kind: ReactionKind) {
    if (!user) {
      toast.error("Sign in to react");
      navigate({ to: "/auth" });
      return;
    }
    try {
      await toggle.mutateAsync({
        user_id: user.id,
        target_type: targetType,
        target_id: targetId,
        kind,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not react";
      toast.error(msg);
    }
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {KINDS.map(({ kind, emoji, label }) => {
        const c = counts.get(kind) ?? 0;
        const active = mine.has(kind);
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onToggle(kind)}
            aria-label={label}
            disabled={toggle.isPending}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
              active
                ? "bg-terracotta-soft border-terracotta text-terracotta"
                : "border-border hover:bg-accent"
            }`}
          >
            <span>{emoji}</span>
            {c > 0 && <span className="font-mono">{c}</span>}
          </button>
        );
      })}
    </div>
  );
}
