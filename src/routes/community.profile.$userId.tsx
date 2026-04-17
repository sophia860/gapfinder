import { createFileRoute, Link } from "@tanstack/react-router";
import { useCampaignsByUser, useProfileByUserId } from "@/lib/queries";
import { CampaignCard } from "@/components/gapfriend/community/CampaignCard";
import { FounderHeader } from "@/components/gapfriend/community/FounderHeader";
import { Sparkles, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/community/profile/$userId")({
  component: FounderProfile,
});

function FounderProfile() {
  const { userId } = Route.useParams();
  const { data: profile, isLoading: profileLoading } = useProfileByUserId(userId);
  const { data: campaigns, isLoading: campaignsLoading } = useCampaignsByUser(userId, {
    onlyPublic: true,
  });

  return (
    <div className="min-h-dvh bg-background">
      <header className="h-16 px-6 lg:px-10 border-b border-border flex items-center justify-between bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <Link to="/" className="flex items-center gap-2">
          <span className="size-8 rounded-lg bg-terracotta-soft text-terracotta flex items-center justify-center">
            <Sparkles className="size-4" />
          </span>
          <span className="font-serif text-lg font-medium tracking-tight">GapFriend</span>
        </Link>
        <Link to="/community">
          <span className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
            <ArrowLeft className="size-4" /> Community
          </span>
        </Link>
      </header>

      <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12 space-y-10">
        {profileLoading ? (
          <div className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
            Loading…
          </div>
        ) : !profile ? (
          <div className="text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-terracotta">Not found</p>
            <h1 className="mt-3 font-serif text-3xl font-medium">Founder not found</h1>
          </div>
        ) : (
          <FounderHeader userId={userId} size="lg" />
        )}

        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Live ventures
          </p>
          {campaignsLoading ? (
            <div className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
              Loading…
            </div>
          ) : (campaigns?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground italic">No public ventures yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {campaigns!.map((c) => (
                <CampaignCard key={c.id} campaign={c} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
