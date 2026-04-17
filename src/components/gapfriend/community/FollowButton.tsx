import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useFollows, useFollowersCount, useToggleFollow } from "@/lib/queries";
import { Heart, HeartOff, UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  targetType: "user" | "campaign";
  targetId: string;
  /** If targetType is "user", the followee's user_id (used for self-check). */
  ownerUserId?: string;
}

export function FollowButton({ targetType, targetId, ownerUserId }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: follows } = useFollows(user?.id);
  const { data: count } = useFollowersCount({ type: targetType, id: targetId });
  const toggle = useToggleFollow();

  const isSelf = targetType === "user" && !!ownerUserId && user?.id === ownerUserId;
  const isFollowing = !!follows?.some((f) =>
    targetType === "user" ? f.followee_user_id === targetId : f.followee_campaign_id === targetId,
  );

  async function onClick() {
    if (!user) {
      toast.error("Sign in to follow");
      navigate({ to: "/auth" });
      return;
    }
    if (isSelf) return;
    try {
      await toggle.mutateAsync({
        follower_id: user.id,
        target_type: targetType,
        target_id: targetId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update follow";
      toast.error(msg);
    }
  }

  if (isSelf) {
    return (
      <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        {count ?? 0} {count === 1 ? "follower" : "followers"}
      </span>
    );
  }

  const Icon =
    targetType === "user" ? (isFollowing ? UserMinus : UserPlus) : isFollowing ? HeartOff : Heart;

  return (
    <Button
      onClick={onClick}
      disabled={toggle.isPending}
      variant={isFollowing ? "outline" : "default"}
      className="rounded-full"
    >
      <Icon className="size-4 mr-2" />
      {isFollowing ? "Following" : "Follow"}
      {typeof count === "number" && <span className="ml-2 text-xs opacity-70">{count}</span>}
    </Button>
  );
}
