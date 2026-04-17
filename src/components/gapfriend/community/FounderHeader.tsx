import { Link } from "@tanstack/react-router";
import { useProfileByUserId } from "@/lib/queries";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FollowButton } from "./FollowButton";

interface Props {
  userId: string;
  /** When true, hides the follow button (e.g. on profile page itself you may use a smaller variant). */
  hideFollow?: boolean;
  /** Visual size variant. */
  size?: "sm" | "lg";
}

export function FounderHeader({ userId, hideFollow = false, size = "sm" }: Props) {
  const { data: profile } = useProfileByUserId(userId);
  const name = profile?.display_name ?? `Founder ${userId.slice(0, 4)}`;
  const initial = name.slice(0, 1).toUpperCase();

  if (size === "lg") {
    return (
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={name} />}
          <AvatarFallback className="text-lg">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Founder
          </p>
          <h2 className="font-serif text-2xl font-medium truncate">{name}</h2>
        </div>
        {!hideFollow && <FollowButton targetType="user" targetId={userId} ownerUserId={userId} />}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <Link
        to="/community/profile/$userId"
        params={{ userId }}
        className="flex items-center gap-2 min-w-0 group"
      >
        <Avatar className="size-7 shrink-0">
          {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={name} />}
          <AvatarFallback className="text-xs">{initial}</AvatarFallback>
        </Avatar>
        <span className="text-sm truncate group-hover:underline">{name}</span>
      </Link>
    </div>
  );
}
