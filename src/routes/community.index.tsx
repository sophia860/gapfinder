import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useCampaigns } from "@/lib/queries";
import { CampaignCard } from "@/components/gapfriend/community/CampaignCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Compass } from "lucide-react";

type Sort = "trending" | "newest" | "near_goal";

export const Route = createFileRoute("/community/")({
  component: CommunityFeed,
});

function CommunityFeed() {
  const [sort, setSort] = useState<Sort>("newest");
  const { data: campaigns, isLoading } = useCampaigns({ sort });

  const sorted = useMemo(() => {
    const list = campaigns ?? [];
    if (sort === "newest") return list;
    // Without aggregated pledge totals on the server, "trending" and "near_goal"
    // fall back to created_at order until pledge counts are joined in.
    return list;
  }, [campaigns, sort]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="h-16 px-6 lg:px-10 border-b border-border flex items-center justify-between bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <Link to="/" className="flex items-center gap-2">
          <span className="size-8 rounded-lg bg-terracotta-soft text-terracotta flex items-center justify-center">
            <Sparkles className="size-4" />
          </span>
          <span className="font-serif text-lg font-medium tracking-tight">GapFriend</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/app">
            <Button variant="ghost" className="rounded-full">
              My ventures
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-12">
        <div className="flex flex-col gap-6 mb-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Community
            </p>
            <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">
              Back the next gap
            </h1>
            <p className="mt-2 text-muted-foreground max-w-xl">
              Discover ventures that founders are publishing today. Pledges are non-binding — a way
              to signal demand to founders early.
            </p>
          </div>

          <Tabs value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <TabsList>
              <TabsTrigger value="newest">Newest</TabsTrigger>
              <TabsTrigger value="trending">Trending</TabsTrigger>
              <TabsTrigger value="near_goal">Near goal</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
            Loading…
          </div>
        ) : sorted.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-12 text-center">
            <div className="size-14 rounded-2xl bg-terracotta-soft text-terracotta flex items-center justify-center mx-auto mb-4">
              <Compass className="size-6" />
            </div>
            <h2 className="font-serif text-2xl font-medium">Nothing live yet</h2>
            <p className="text-muted-foreground mt-2">
              Be the first to publish a venture for the community to back.
            </p>
            <Link to="/app">
              <Button className="rounded-full mt-6">Open my workspace</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sorted.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
