import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  useCampaigns,
  useTrendingFounders,
  useRecentCommunityPosts,
  useProfileByUserId,
  useFollowersCount,
  type Campaign,
} from "@/lib/queries";
import { CampaignCard } from "@/components/gapfriend/community/CampaignCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sparkles, Compass, Flame, MessageSquare, ArrowRight } from "lucide-react";

type Sort = "trending" | "newest" | "near_goal";

export const Route = createFileRoute("/community/")({
  head: () => ({
    meta: [
      { title: "Community — back the next gap | GapFriend" },
      {
        name: "description",
        content:
          "Discover live ventures from solo founders, follow trending builders, and see the latest updates across the GapFriend community.",
      },
      { property: "og:title", content: "GapFriend Community" },
      {
        property: "og:description",
        content:
          "Live campaigns, trending founders, and recent updates from independent makers.",
      },
    ],
  }),
  component: CommunityDashboard,
});

function CommunityDashboard() {
  const [sort, setSort] = useState<Sort>("newest");
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns({ sort });
  const { data: founders, isLoading: foundersLoading } = useTrendingFounders(6);
  const { data: updates, isLoading: updatesLoading } = useRecentCommunityPosts(8);

  const list = campaigns ?? [];

  return (
    <div className="min-h-dvh bg-background">
      <header className="h-16 px-6 lg:px-10 border-b border-border flex items-center justify-between bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <Link to="/" className="flex items-center gap-2">
          <span className="size-8 rounded-lg bg-terracotta-soft text-terracotta flex items-center justify-center">
            <Sparkles className="size-4" />
          </span>
          <span className="font-serif text-lg font-medium tracking-tight">GapFriend</span>
        </Link>
        <Link to="/app">
          <Button variant="ghost" className="rounded-full">
            My ventures
          </Button>
        </Link>
      </header>

      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-12 space-y-14">
        {/* Hero */}
        <section>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Community
          </p>
          <h1 className="mt-2 font-serif text-4xl md:text-5xl font-medium tracking-tight">
            Back the next gap
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            Live ventures, the founders shipping them, and what's happening across GapFriend right
            now. Pledges are non-binding — a way to signal demand to founders early.
          </p>
        </section>

        {/* Live campaigns */}
        <section>
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Live campaigns
              </p>
              <h2 className="mt-1 font-serif text-2xl font-medium">Ventures looking for backers</h2>
            </div>
            <Tabs value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <TabsList>
                <TabsTrigger value="newest">Newest</TabsTrigger>
                <TabsTrigger value="trending">Trending</TabsTrigger>
                <TabsTrigger value="near_goal">Near goal</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {campaignsLoading ? (
            <div className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
              Loading…
            </div>
          ) : list.length === 0 ? (
            <EmptyCampaigns />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {list.slice(0, 9).map((c) => (
                <CampaignCard key={c.id} campaign={c} />
              ))}
            </div>
          )}
        </section>

        {/* Trending founders */}
        <section>
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
                <Flame className="size-3" /> Trending
              </p>
              <h2 className="mt-1 font-serif text-2xl font-medium">Founders to follow</h2>
            </div>
          </div>
          {foundersLoading ? (
            <div className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
              Loading…
            </div>
          ) : (founders?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No founders to surface yet — be the first.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {founders!.map((f) => (
                <FounderCard key={f.userId} userId={f.userId} />
              ))}
            </div>
          )}
        </section>

        {/* Recent updates */}
        <section>
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
                <MessageSquare className="size-3" /> Recent updates
              </p>
              <h2 className="mt-1 font-serif text-2xl font-medium">What founders are sharing</h2>
            </div>
          </div>

          {updatesLoading ? (
            <div className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
              Loading…
            </div>
          ) : (updates?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No updates yet. Founders post here when they ship.
            </p>
          ) : (
            <ul className="bg-card border border-border rounded-3xl divide-y divide-border overflow-hidden">
              {updates!.map(({ post, campaign }) => (
                <UpdateRow key={post.id} authorId={post.author_id} body={post.body} createdAt={post.created_at} campaign={campaign} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyCampaigns() {
  return (
    <div className="bg-card border border-border rounded-3xl p-12 text-center">
      <div className="size-14 rounded-2xl bg-terracotta-soft text-terracotta flex items-center justify-center mx-auto mb-4">
        <Compass className="size-6" />
      </div>
      <h3 className="font-serif text-2xl font-medium">Nothing live yet</h3>
      <p className="text-muted-foreground mt-2">
        Be the first to publish a venture for the community to back.
      </p>
      <Link to="/app">
        <Button className="rounded-full mt-6">Open my workspace</Button>
      </Link>
    </div>
  );
}

function FounderCard({ userId }: { userId: string }) {
  const { data: profile } = useProfileByUserId(userId);
  const { data: followers } = useFollowersCount({ type: "user", id: userId });
  const name = profile?.display_name ?? `Founder ${userId.slice(0, 4)}`;
  const initial = name.slice(0, 1).toUpperCase();
  return (
    <Link
      to="/community/profile/$userId"
      params={{ userId }}
      className="group bg-card border border-border rounded-2xl p-5 flex items-center gap-4 hover:shadow-warm transition-all hover:-translate-y-0.5"
    >
      <Avatar className="size-12 shrink-0">
        {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={name} />}
        <AvatarFallback>{initial}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="font-serif text-base font-medium truncate">{name}</p>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
          {followers ?? 0} {followers === 1 ? "follower" : "followers"}
        </p>
      </div>
      <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
    </Link>
  );
}

function UpdateRow({
  authorId,
  body,
  createdAt,
  campaign,
}: {
  authorId: string;
  body: string;
  createdAt: string;
  campaign: Campaign | null;
}) {
  const { data: profile } = useProfileByUserId(authorId);
  const name = profile?.display_name ?? `Founder ${authorId.slice(0, 4)}`;
  const initial = name.slice(0, 1).toUpperCase();
  const when = new Date(createdAt).toLocaleDateString();
  return (
    <li className="p-5 flex items-start gap-4">
      <Avatar className="size-10 shrink-0">
        {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={name} />}
        <AvatarFallback>{initial}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <Link
            to="/community/profile/$userId"
            params={{ userId: authorId }}
            className="font-medium hover:underline"
          >
            {name}
          </Link>
          {campaign && (
            <>
              <span className="text-muted-foreground text-xs">on</span>
              <Link
                to="/community/$campaignId"
                params={{ campaignId: campaign.id }}
                className="text-sm text-terracotta hover:underline truncate"
              >
                {campaign.title}
              </Link>
            </>
          )}
          <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {when}
          </span>
        </div>
        <p className="text-sm text-foreground/90 mt-2 whitespace-pre-wrap break-words line-clamp-4">
          {body}
        </p>
      </div>
    </li>
  );
}
