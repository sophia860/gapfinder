import { createFileRoute, Link } from "@tanstack/react-router";
import { useCampaign, usePledges } from "@/lib/queries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignProgress } from "@/components/gapfriend/community/CampaignProgress";
import { BackButton } from "@/components/gapfriend/community/BackButton";
import { PledgeList } from "@/components/gapfriend/community/PledgeList";
import { UpdateFeed } from "@/components/gapfriend/community/UpdateFeed";
import { CommentThread } from "@/components/gapfriend/community/CommentThread";
import { ReactionBar } from "@/components/gapfriend/community/ReactionBar";
import { FollowButton } from "@/components/gapfriend/community/FollowButton";
import { FounderHeader } from "@/components/gapfriend/community/FounderHeader";
import { Sparkles, ArrowLeft, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/community/$campaignId")({
  component: CampaignDetail,
});

function CampaignDetail() {
  const { campaignId } = Route.useParams();
  const { data: campaign, isLoading } = useCampaign(campaignId);
  const { data: pledges } = usePledges(campaignId);

  const raised = (pledges ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const backers = pledges?.length ?? 0;

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-terracotta">Not found</p>
          <h1 className="mt-3 font-serif text-3xl font-medium">Campaign not found</h1>
          <Link
            to="/community"
            className="mt-4 inline-block text-sm text-terracotta hover:underline"
          >
            ← Back to community
          </Link>
        </div>
      </div>
    );
  }

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

      <div className="max-w-5xl mx-auto px-6 lg:px-10 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div>
              {campaign.category && (
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {campaign.category}
                </p>
              )}
              <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">
                {campaign.title}
              </h1>
              {campaign.pitch && (
                <p className="mt-3 text-lg text-muted-foreground">{campaign.pitch}</p>
              )}
            </div>

            <FounderHeader userId={campaign.created_by} size="sm" />

            {campaign.cover_url && (
              <img
                src={campaign.cover_url}
                alt=""
                className="w-full rounded-2xl border border-border object-cover aspect-video"
              />
            )}

            <Tabs defaultValue="story">
              <TabsList>
                <TabsTrigger value="story">Story</TabsTrigger>
                <TabsTrigger value="updates">Updates</TabsTrigger>
                <TabsTrigger value="comments">Comments</TabsTrigger>
                <TabsTrigger value="backers">Backers ({backers})</TabsTrigger>
              </TabsList>
              <TabsContent value="story" className="mt-6">
                {campaign.story ? (
                  <div className="prose max-w-none whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {campaign.story}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    The founder hasn't added a story yet.
                  </p>
                )}
              </TabsContent>
              <TabsContent value="updates" className="mt-6">
                <UpdateFeed campaign={campaign} />
              </TabsContent>
              <TabsContent value="comments" className="mt-6">
                <CommentThread targetType="campaign" targetId={campaign.id} />
              </TabsContent>
              <TabsContent value="backers" className="mt-6">
                <PledgeList pledges={pledges ?? []} currency={campaign.currency} />
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 self-start">
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <CampaignProgress
                raised={raised}
                goal={Number(campaign.goal_amount ?? 0)}
                currency={campaign.currency}
                backers={backers}
              />
              {campaign.deadline_at && (
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  Ends {new Date(campaign.deadline_at).toLocaleDateString()}
                </p>
              )}
              <BackButton campaign={campaign} />
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                <FollowButton targetType="campaign" targetId={campaign.id} />
                <ReactionBar targetType="campaign" targetId={campaign.id} />
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground border border-dashed border-border rounded-xl p-3">
                <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
                <span>
                  Demo / non-binding: pledges are recorded as intents to gauge interest. No money is
                  moved.
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
