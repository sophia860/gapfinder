// app/routes/crowdfunding.tsx
// TruaraCrowdfund — calm, zero-burnout crowdfunding OS for solo founders.
// Private-by-default workspaces · hybrid funding models · AI swarm intel
// · longitudinal agent memory · fulfillment estimation · proactive next-actions.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  useProject,
  useCampaignByProject,
  useCreateCampaign,
  useUpdateCampaign,
  usePledges,
  type Campaign,
  type CampaignStatus,
} from "@/lib/queries";
import { createCrowdfundGraph, type NextAction } from "@/lib/graphs/crowdfunding-graph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CampaignProgress } from "@/components/gapfriend/community/CampaignProgress";
import { PledgeList } from "@/components/gapfriend/community/PledgeList";
import { UpdateFeed } from "@/components/gapfriend/community/UpdateFeed";
import {
  Rocket,
  ExternalLink,
  AlertCircle,
  Brain,
  Sparkles,
  Lock,
  Eye,
  Package,
  TrendingUp,
  Users,
  RefreshCw,
  ChevronRight,
  Zap,
  Shield,
  Gift,
  Plus,
  Trash2,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$projectId/crowdfund")({
  component: ProjectCrowdfund,
});

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: CampaignStatus; label: string }[] = [
  { value: "draft", label: "Draft (private)" },
  { value: "live", label: "Live (public)" },
  { value: "funded", label: "Funded" },
  { value: "closed", label: "Closed" },
];

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"];

const FUNDING_MODEL_OPTIONS = [
  {
    value: "all_or_nothing",
    label: "All-or-Nothing",
    desc: "Only collect funds if goal is met. Lower risk for backers.",
  },
  {
    value: "flexible",
    label: "Flexible (Keep-it-All)",
    desc: "Keep whatever is raised. Higher pressure to deliver.",
  },
  {
    value: "recurring",
    label: "Recurring Subscription",
    desc: "Monthly pledges. Best for ongoing products or memberships.",
  },
  {
    value: "installment",
    label: "Installment Plan",
    desc: "Backers pay in multiple tranches tied to milestones.",
  },
];

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private (owner only)", icon: Lock },
  { value: "invite_only", label: "Invite-only (link sharing)", icon: Users },
  { value: "public", label: "Public", icon: Eye },
];

// ── Swarm insight types (mirrors DB enum) ─────────────────────────────────────

interface SwarmInsight {
  id: string;
  persona: string;
  category: string;
  insight: string;
  suggestion: string | null;
  severity: number;
  sentiment: string | null;
  dismissed: boolean;
}

interface RewardTier {
  id: string;
  title: string;
  description: string | null;
  min_pledge: number;
  backer_limit: number | null;
  backer_count: number;
  estimated_delivery_at: string | null;
  digital_only: boolean;
  position: number;
}

interface FulfillmentEstimate {
  id: string;
  reward_tier_id: string | null;
  unit_cogs_estimate: number | null;
  unit_shipping_estimate: number | null;
  unit_platform_fee_estimate: number | null;
  total_cost_per_unit: number | null;
  risk_score: number | null;
  risk_notes: string | null;
  ai_narrative: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function severityColor(s: number) {
  if (s >= 8) return "text-red-500";
  if (s >= 5) return "text-amber-500";
  return "text-emerald-500";
}

function personaLabel(p: string) {
  return p
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function categoryLabel(c: string) {
  const map: Record<string, string> = {
    page_copy: "Page Copy",
    reward_tier: "Reward Tier",
    pricing: "Pricing",
    fulfillment_risk: "Fulfillment Risk",
    audience_fit: "Audience Fit",
    trust_signal: "Trust Signal",
    virality: "Virality",
    timing: "Timing",
  };
  return map[c] ?? c;
}

// ── Main component ────────────────────────────────────────────────────────────

function ProjectCrowdfund() {
  const { projectId } = Route.useParams();
  const { user } = useAuth();
  const { data: project } = useProject(projectId);
  const { data: campaign, isLoading } = useCampaignByProject(projectId);
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const { data: pledges } = usePledges(campaign?.id);

  // AI agent state
  const [nextActions, setNextActions] = useState<NextAction[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);

  // Swarm state
  const [swarmInsights, setSwarmInsights] = useState<SwarmInsight[]>([]);
  const [swarmRunning, setSwarmRunning] = useState(false);
  const [swarmSummary, setSwarmSummary] = useState<string | null>(null);

  // Reward tiers
  const [rewardTiers, setRewardTiers] = useState<RewardTier[]>([]);

  // Fulfillment estimates
  const [fulfillmentEstimates, setFulfillmentEstimates] = useState<FulfillmentEstimate[]>([]);

  const raised = (pledges ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  // Load swarm insights + reward tiers + fulfillment estimates when campaign is ready.
  useEffect(() => {
    if (!campaign?.id) return;
    void loadSwarmInsights(campaign.id);
    void loadRewardTiers(campaign.id);
    void loadFulfillmentEstimates(campaign.id);
  }, [campaign?.id]);

  // Run the LangGraph-style agent on first load.
  useEffect(() => {
    if (!campaign?.id || !user?.id || agentRunning) return;
    void runAgent(campaign.id, user.id, "manual");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id, user?.id]);

  const loadSwarmInsights = useCallback(async (campaignId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data } = await sb
      .from("campaign_swarm_insights")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("dismissed", false)
      .order("severity", { ascending: false })
      .limit(30);
    setSwarmInsights((data as SwarmInsight[]) ?? []);

    const { data: run } = await sb
      .from("campaign_swarm_runs")
      .select("summary")
      .eq("campaign_id", campaignId)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSwarmSummary((run as { summary: string } | null)?.summary ?? null);
  }, []);

  const loadRewardTiers = useCallback(async (campaignId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data } = await sb
      .from("campaign_reward_tiers")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("position", { ascending: true });
    setRewardTiers((data as RewardTier[]) ?? []);
  }, []);

  const loadFulfillmentEstimates = useCallback(async (campaignId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data } = await sb
      .from("campaign_fulfillment_estimates")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(10);
    setFulfillmentEstimates((data as FulfillmentEstimate[]) ?? []);
  }, []);

  const runAgent = useCallback(
    async (campaignId: string, userId: string, trigger: "manual" | "swarm_complete") => {
      if (agentRunning) return;
      setAgentRunning(true);
      try {
        const graph = createCrowdfundGraph(supabase, userId);
        const state = await graph.invoke({ campaignId, trigger });
        setNextActions(state.nextActions);
      } catch {
        // Agent failures are silent — next-actions just stay empty.
      } finally {
        setAgentRunning(false);
      }
    },
    [agentRunning],
  );

  const handleRunSwarm = useCallback(async () => {
    if (!campaign?.id || swarmRunning) return;
    setSwarmRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("crowdfund-swarm", {
        body: { campaignId: campaign.id },
      });
      if (error) throw error;
      if (data?.skipped) {
        toast.info("Swarm analysis throttled — try again in a few minutes.");
      } else {
        toast.success(`Swarm complete — ${data?.insightCount ?? 0} insights generated.`);
        await loadSwarmInsights(campaign.id);
        if (user?.id) void runAgent(campaign.id, user.id, "swarm_complete");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Swarm analysis failed");
    } finally {
      setSwarmRunning(false);
    }
  }, [campaign?.id, swarmRunning, loadSwarmInsights, runAgent, user?.id]);

  const handleDismissInsight = useCallback(async (insightId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("campaign_swarm_insights")
      .update({ dismissed: true })
      .eq("id", insightId);
    setSwarmInsights((prev) => prev.filter((i) => i.id !== insightId));
  }, []);

  if (isLoading) {
    return (
      <div className="p-8 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!campaign) {
    return (
      <CreateCampaignPanel
        projectId={projectId}
        defaultTitle={project?.working_name ?? "My venture"}
        defaultPitch={project?.tagline ?? ""}
        onCreate={async (input) => {
          if (!user) return;
          try {
            await createCampaign.mutateAsync({
              project_id: projectId,
              created_by: user.id,
              ...input,
            });
            toast.success("Campaign created — private by default.");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not create campaign");
          }
        }}
        isPending={createCampaign.isPending}
      />
    );
  }

  const campaignAny = campaign as Campaign & {
    funding_model?: string;
    visibility?: string;
    swarm_last_run_at?: string | null;
  };

  const visibilityOption =
    VISIBILITY_OPTIONS.find((v) => v.value === (campaignAny.visibility ?? "private")) ??
    VISIBILITY_OPTIONS[0];
  const VisibilityIcon = visibilityOption.icon;

  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-10 py-10 space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            TruaraCrowdfund
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight">{campaign.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest">
              <VisibilityIcon className="size-3 mr-1" />
              {visibilityOption.label}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest">
              {FUNDING_MODEL_OPTIONS.find((m) => m.value === (campaignAny.funding_model ?? "all_or_nothing"))?.label ?? "All-or-Nothing"}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest">
              {STATUS_OPTIONS.find((s) => s.value === campaign.status)?.label}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {campaignAny.visibility === "public" && (
            <Link to="/community/$campaignId" params={{ campaignId: campaign.id }}>
              <Button variant="outline" className="rounded-full" size="sm">
                <ExternalLink className="size-4 mr-2" /> Public page
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* ── Progress card ── */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <CampaignProgress
          raised={raised}
          goal={Number(campaign.goal_amount ?? 0)}
          currency={campaign.currency}
          backers={pledges?.length ?? 0}
        />
      </div>

      {/* ── AI next-actions ── */}
      {nextActions.length > 0 && (
        <AgentNextActions actions={nextActions} running={agentRunning} />
      )}

      {/* ── Tabs ── */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rewards">
            <Gift className="size-3.5 mr-1.5" />
            Rewards
          </TabsTrigger>
          <TabsTrigger value="swarm">
            <Brain className="size-3.5 mr-1.5" />
            Swarm Intel
            {swarmInsights.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {swarmInsights.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="fulfillment">
            <Package className="size-3.5 mr-1.5" />
            Fulfillment
          </TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="updates">Updates</TabsTrigger>
          <TabsTrigger value="backers">
            Backers{pledges && pledges.length > 0 ? ` (${pledges.length})` : ""}
          </TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="mt-6 space-y-4">
          <OverviewTab
            campaign={campaignAny}
            raised={raised}
            backerCount={pledges?.length ?? 0}
            swarmSummary={swarmSummary}
            swarmInsights={swarmInsights}
            fulfillmentEstimates={fulfillmentEstimates}
            onRunSwarm={handleRunSwarm}
            swarmRunning={swarmRunning}
          />
        </TabsContent>

        {/* ── Rewards ── */}
        <TabsContent value="rewards" className="mt-6">
          <RewardTiersPanel
            campaignId={campaign.id}
            tiers={rewardTiers}
            currency={campaign.currency}
            onRefresh={() => loadRewardTiers(campaign.id)}
          />
        </TabsContent>

        {/* ── Swarm Intel ── */}
        <TabsContent value="swarm" className="mt-6">
          <SwarmIntelPanel
            insights={swarmInsights}
            summary={swarmSummary}
            running={swarmRunning}
            lastRunAt={campaignAny.swarm_last_run_at ?? null}
            onRun={handleRunSwarm}
            onDismiss={handleDismissInsight}
          />
        </TabsContent>

        {/* ── Fulfillment ── */}
        <TabsContent value="fulfillment" className="mt-6">
          <FulfillmentPanel
            campaignId={campaign.id}
            tiers={rewardTiers}
            estimates={fulfillmentEstimates}
            currency={campaign.currency}
            category={campaign.category}
            onRefresh={() => loadFulfillmentEstimates(campaign.id)}
          />
        </TabsContent>

        {/* ── Edit ── */}
        <TabsContent value="edit" className="mt-6">
          <EditCampaignForm
            campaign={campaignAny}
            onSave={async (patch) => {
              try {
                await updateCampaign.mutateAsync({ id: campaign.id, ...patch });
                toast.success("Saved");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not save");
              }
            }}
            isPending={updateCampaign.isPending}
          />
        </TabsContent>

        {/* ── Updates ── */}
        <TabsContent value="updates" className="mt-6">
          <UpdateFeed campaign={campaign} />
        </TabsContent>

        {/* ── Backers ── */}
        <TabsContent value="backers" className="mt-6">
          <PledgeList pledges={pledges ?? []} currency={campaign.currency} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── AgentNextActions ──────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "border-red-500/40 bg-red-500/5",
  high: "border-amber-500/40 bg-amber-500/5",
  medium: "border-border bg-card",
  low: "border-border bg-card",
};

function AgentNextActions({ actions, running }: { actions: NextAction[]; running: boolean }) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <Sparkles className="size-3" />
        AI next-actions
        {running && <RefreshCw className="size-3 animate-spin ml-1" />}
      </p>
      <div className="space-y-2">
        {actions.map((a, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 border rounded-xl p-3 ${PRIORITY_COLORS[a.priority] ?? "border-border bg-card"}`}
          >
            <div className="mt-0.5 shrink-0">
              {a.priority === "urgent" ? (
                <AlertCircle className="size-4 text-red-500" />
              ) : a.priority === "high" ? (
                <Zap className="size-4 text-amber-500" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{a.action}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{a.rationale}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── OverviewTab ───────────────────────────────────────────────────────────────

function OverviewTab({
  campaign,
  raised,
  backerCount,
  swarmSummary,
  swarmInsights,
  fulfillmentEstimates,
  onRunSwarm,
  swarmRunning,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  campaign: any;
  raised: number;
  backerCount: number;
  swarmSummary: string | null;
  swarmInsights: SwarmInsight[];
  fulfillmentEstimates: FulfillmentEstimate[];
  onRunSwarm: () => void;
  swarmRunning: boolean;
}) {
  const goal = Number(campaign.goal_amount ?? 0);
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  const maxRisk = fulfillmentEstimates.reduce(
    (m, e) => Math.max(m, e.risk_score ?? 0),
    0,
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Funding progress */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <TrendingUp className="size-3" /> Funding
        </p>
        <div className="flex items-baseline justify-between">
          <span className="font-serif text-2xl font-medium">{pct}%</span>
          <span className="text-xs text-muted-foreground">{backerCount} backers</span>
        </div>
        <Progress value={pct} className="h-1.5" />
        <p className="text-xs text-muted-foreground">
          {campaign.currency} {raised.toLocaleString()} raised of{" "}
          {Number(campaign.goal_amount ?? 0).toLocaleString()} goal
        </p>
      </div>

      {/* Visibility + model */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Shield className="size-3" /> Privacy & Model
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Lock className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm">
              {VISIBILITY_OPTIONS.find((v) => v.value === (campaign.visibility ?? "private"))
                ?.label ?? "Private"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <BadgeCheck className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm">
              {FUNDING_MODEL_OPTIONS.find(
                (m) => m.value === (campaign.funding_model ?? "all_or_nothing"),
              )?.label ?? "All-or-Nothing"}
            </span>
          </div>
        </div>
      </div>

      {/* Swarm summary */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3 md:col-span-2">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Brain className="size-3" /> Swarm Intel summary
          </p>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full h-7 text-xs"
            onClick={onRunSwarm}
            disabled={swarmRunning}
          >
            {swarmRunning ? (
              <RefreshCw className="size-3 animate-spin mr-1" />
            ) : (
              <Sparkles className="size-3 mr-1" />
            )}
            {swarmRunning ? "Running…" : "Run swarm"}
          </Button>
        </div>
        {swarmSummary ? (
          <p className="text-sm text-muted-foreground leading-relaxed">{swarmSummary}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No swarm analysis yet. Run the swarm to get private pre-launch feedback from 7 AI
            personas.
          </p>
        )}
        {swarmInsights.length > 0 && (
          <p className="text-xs font-mono text-muted-foreground">
            {swarmInsights.length} active insight{swarmInsights.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Fulfillment risk */}
      {maxRisk > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-2 md:col-span-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Package className="size-3" /> Fulfillment risk
          </p>
          <div className="flex items-center gap-3">
            <span className={`font-serif text-2xl font-medium ${severityColor(maxRisk)}`}>
              {maxRisk}/10
            </span>
            <p className="text-xs text-muted-foreground">
              {fulfillmentEstimates[0]?.ai_narrative ?? ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RewardTiersPanel ──────────────────────────────────────────────────────────

function RewardTiersPanel({
  campaignId,
  tiers,
  currency,
  onRefresh,
}: {
  campaignId: string;
  tiers: RewardTier[];
  currency: string;
  onRefresh: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTier, setNewTier] = useState({
    title: "",
    description: "",
    min_pledge: 25,
    digital_only: false,
    backer_limit: "",
    estimated_delivery_at: "",
  });

  const handleAdd = async () => {
    if (!newTier.title.trim()) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { error } = await sb.from("campaign_reward_tiers").insert({
        campaign_id: campaignId,
        title: newTier.title.trim(),
        description: newTier.description.trim() || null,
        min_pledge: newTier.min_pledge,
        digital_only: newTier.digital_only,
        backer_limit: newTier.backer_limit ? parseInt(newTier.backer_limit, 10) : null,
        estimated_delivery_at: newTier.estimated_delivery_at
          ? new Date(newTier.estimated_delivery_at).toISOString()
          : null,
        position: tiers.length,
      });
      if (error) throw error;
      setNewTier({
        title: "",
        description: "",
        min_pledge: 25,
        digital_only: false,
        backer_limit: "",
        estimated_delivery_at: "",
      });
      setAdding(false);
      onRefresh();
      toast.success("Reward tier added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add tier");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tierId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("campaign_reward_tiers")
      .delete()
      .eq("id", tierId);
    if (error) toast.error("Could not delete tier");
    else {
      onRefresh();
      toast.success("Tier removed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Reward tiers ({tiers.length})
        </p>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full h-7 text-xs"
          onClick={() => setAdding((v) => !v)}
        >
          <Plus className="size-3 mr-1" /> Add tier
        </Button>
      </div>

      {adding && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <p className="text-sm font-medium">New reward tier</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rt-title" className="text-xs">Title</Label>
              <Input
                id="rt-title"
                value={newTier.title}
                onChange={(e) => setNewTier((p) => ({ ...p, title: e.target.value }))}
                placeholder="Early Bird"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="rt-pledge" className="text-xs">Min pledge ({currency})</Label>
              <Input
                id="rt-pledge"
                type="number"
                min={0}
                value={newTier.min_pledge}
                onChange={(e) =>
                  setNewTier((p) => ({ ...p, min_pledge: Number(e.target.value) }))
                }
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="rt-desc" className="text-xs">Description</Label>
            <Textarea
              id="rt-desc"
              value={newTier.description}
              onChange={(e) => setNewTier((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              className="mt-1.5"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="rt-limit" className="text-xs">Backer limit (optional)</Label>
              <Input
                id="rt-limit"
                type="number"
                min={1}
                value={newTier.backer_limit}
                onChange={(e) => setNewTier((p) => ({ ...p, backer_limit: e.target.value }))}
                placeholder="Unlimited"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="rt-delivery" className="text-xs">Est. delivery</Label>
              <Input
                id="rt-delivery"
                type="date"
                value={newTier.estimated_delivery_at}
                onChange={(e) =>
                  setNewTier((p) => ({ ...p, estimated_delivery_at: e.target.value }))
                }
                className="mt-1.5"
              />
            </div>
            <div className="flex items-end pb-1">
              <div className="flex items-center gap-2 mt-auto">
                <Switch
                  id="rt-digital"
                  checked={newTier.digital_only}
                  onCheckedChange={(v) => setNewTier((p) => ({ ...p, digital_only: v }))}
                />
                <Label htmlFor="rt-digital" className="text-xs cursor-pointer">
                  Digital only
                </Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => setAdding(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="rounded-full"
              disabled={saving || !newTier.title.trim()}
              onClick={handleAdd}
            >
              {saving ? "Saving…" : "Add tier"}
            </Button>
          </div>
        </div>
      )}

      {tiers.length === 0 && !adding && (
        <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
          No reward tiers yet. Add your first tier to unlock fulfillment estimates and swarm
          feedback.
        </div>
      )}

      <div className="space-y-3">
        {tiers.map((tier) => (
          <div key={tier.id} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{tier.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {currency} {tier.min_pledge}+
                  {tier.backer_limit && (
                    <span className="ml-2 font-mono text-xs">
                      {tier.backer_count}/{tier.backer_limit} backers
                    </span>
                  )}
                  {tier.digital_only && (
                    <span className="ml-2 font-mono text-xs text-emerald-500">digital</span>
                  )}
                </p>
                {tier.description && (
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    {tier.description}
                  </p>
                )}
                {tier.estimated_delivery_at && (
                  <p className="text-[10px] font-mono text-muted-foreground mt-1.5">
                    Est. delivery:{" "}
                    {new Date(tier.estimated_delivery_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                    })}
                  </p>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(tier.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SwarmIntelPanel ───────────────────────────────────────────────────────────

function SwarmIntelPanel({
  insights,
  summary,
  running,
  lastRunAt,
  onRun,
  onDismiss,
}: {
  insights: SwarmInsight[];
  summary: string | null;
  running: boolean;
  lastRunAt?: string | null;
  onRun: () => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Synthetic swarm — 7 AI personas
          </p>
          {lastRunAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Last run: {new Date(lastRunAt).toLocaleString()}
            </p>
          )}
        </div>
        <Button
          size="sm"
          className="rounded-full"
          onClick={onRun}
          disabled={running}
        >
          {running ? (
            <RefreshCw className="size-3.5 animate-spin mr-1.5" />
          ) : (
            <Brain className="size-3.5 mr-1.5" />
          )}
          {running ? "Running swarm…" : "Run swarm"}
        </Button>
      </div>

      {summary && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            Executive summary
          </p>
          <p className="text-sm leading-relaxed">{summary}</p>
        </div>
      )}

      {insights.length === 0 && !running && (
        <div className="text-center py-16 text-sm text-muted-foreground border border-dashed border-border rounded-2xl space-y-2">
          <Brain className="size-8 mx-auto text-muted-foreground/40" />
          <p>No swarm insights yet.</p>
          <p className="text-xs">
            Run the swarm to get private pre-launch feedback from 7 synthetic AI personas —
            skeptical backers, domain critics, logisticians, growth marketers, and more.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {insights.map((ins) => (
          <div
            key={ins.id}
            className={`bg-card border rounded-2xl p-4 space-y-2 ${
              ins.severity >= 8
                ? "border-red-500/30"
                : ins.severity >= 5
                  ? "border-amber-500/30"
                  : "border-border"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] font-mono uppercase">
                  {personaLabel(ins.persona)}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono uppercase">
                  {categoryLabel(ins.category)}
                </Badge>
                <span className={`text-xs font-mono font-medium ${severityColor(ins.severity)}`}>
                  {ins.severity}/10
                </span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="size-6 shrink-0 text-muted-foreground"
                onClick={() => onDismiss(ins.id)}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
            <p className="text-sm">{ins.insight}</p>
            {ins.suggestion && (
              <p className="text-xs text-muted-foreground border-l-2 border-border pl-3 italic">
                {ins.suggestion}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FulfillmentPanel ──────────────────────────────────────────────────────────

function FulfillmentPanel({
  campaignId,
  tiers,
  estimates,
  currency,
  category,
  onRefresh,
}: {
  campaignId: string;
  tiers: RewardTier[];
  estimates: FulfillmentEstimate[];
  currency: string;
  category: string | null | undefined;
  onRefresh: () => void;
}) {
  const [estimating, setEstimating] = useState<string | null>(null);

  const handleEstimate = async (tier: RewardTier) => {
    setEstimating(tier.id);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/crowdfund-swarm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      if (!res.ok) throw new Error("Estimate failed");
      // For now, trigger fulfillment estimate via the server function pattern.
      // In production this calls src/server-functions/crowdfunding.ts estimateFulfillment.
      const { data: { session } } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const estRes = await fetch(`${SUPABASE_URL}/functions/v1/crowdfund-fulfillment-estimate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
        },
        body: JSON.stringify({
          campaignId,
          rewardTierId: tier.id,
          tierTitle: tier.title,
          minPledge: tier.min_pledge,
          digitalOnly: tier.digital_only,
          description: tier.description,
          category: category ?? undefined,
          currency,
        }),
      });
      if (!estRes.ok) throw new Error("Estimate request failed");
      onRefresh();
      toast.success("Fulfillment estimate generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not estimate fulfillment");
    } finally {
      setEstimating(null);
    }
  };

  return (
    <div className="space-y-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Fulfillment cost & risk estimates
      </p>

      {tiers.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
          Add reward tiers first, then run estimates to see production cost, shipping, and risk
          scores.
        </div>
      )}

      <div className="space-y-4">
        {tiers.map((tier) => {
          const est = estimates.find((e) => e.reward_tier_id === tier.id);
          return (
            <div key={tier.id} className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{tier.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {currency} {tier.min_pledge}+ min pledge
                    {tier.digital_only && (
                      <span className="ml-2 text-emerald-500">digital-only</span>
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full h-7 text-xs"
                  disabled={!!estimating}
                  onClick={() => handleEstimate(tier)}
                >
                  {estimating === tier.id ? (
                    <RefreshCw className="size-3 animate-spin mr-1" />
                  ) : (
                    <Sparkles className="size-3 mr-1" />
                  )}
                  {estimating === tier.id ? "Estimating…" : est ? "Re-estimate" : "Estimate"}
                </Button>
              </div>

              {est && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border">
                  <CostCell label="Production" value={est.unit_cogs_estimate} currency={currency} />
                  <CostCell
                    label="Shipping"
                    value={est.unit_shipping_estimate}
                    currency={currency}
                  />
                  <CostCell
                    label="Platform fee"
                    value={est.unit_platform_fee_estimate}
                    currency={currency}
                  />
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Risk
                    </p>
                    <p
                      className={`font-serif text-xl font-medium mt-0.5 ${severityColor(est.risk_score ?? 0)}`}
                    >
                      {est.risk_score ?? "—"}/10
                    </p>
                  </div>
                </div>
              )}

              {est?.ai_narrative && (
                <p className="text-xs text-muted-foreground leading-relaxed">{est.ai_narrative}</p>
              )}
              {est?.risk_notes && (
                <p className="text-xs text-amber-600 dark:text-amber-400 border-l-2 border-amber-500/40 pl-3">
                  {est.risk_notes}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CostCell({
  label,
  value,
  currency,
}: {
  label: string;
  value: number | null | undefined;
  currency: string;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="font-serif text-xl font-medium mt-0.5">
        {value != null ? `${currency} ${value.toFixed(2)}` : "—"}
      </p>
    </div>
  );
}


// ── CreateCampaignPanel ───────────────────────────────────────────────────────

function CreateCampaignPanel({
  projectId,
  defaultTitle,
  defaultPitch,
  onCreate,
  isPending,
}: {
  projectId: string;
  defaultTitle: string;
  defaultPitch: string;
  onCreate: (input: {
    title: string;
    pitch: string | null;
    story: string | null;
    goal_amount: number;
    currency: string;
    deadline_at: string | null;
    category: string | null;
    cover_url: string | null;
    status: CampaignStatus;
  }) => Promise<void>;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [pitch, setPitch] = useState(defaultPitch);
  const [story, setStory] = useState("");
  const [goal, setGoal] = useState<number>(5000);
  const [currency, setCurrency] = useState("USD");
  const [deadline, setDeadline] = useState("");
  const [category, setCategory] = useState("");

  return (
    <div className="max-w-2xl mx-auto px-6 lg:px-10 py-10 space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          TruaraCrowdfund
        </p>
        <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight">
          Start your campaign
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Campaigns start <strong>private by default</strong>. Build at your own pace, run the
          synthetic swarm for pre-launch feedback, then publish when you&apos;re ready.
        </p>
      </div>

      <div className="flex items-start gap-3 bg-card border border-border rounded-xl p-4">
        <Lock className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Private workspace</p>
          <p className="text-xs text-muted-foreground">
            Your campaign, backer data, and AI insights are fully private until you explicitly set
            visibility to Public. No surprise exposure.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div>
          <Label htmlFor="cf-title">Title</Label>
          <Input
            id="cf-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="cf-pitch">One-line pitch</Label>
          <Input
            id="cf-pitch"
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            maxLength={200}
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="cf-story">Story</Label>
          <Textarea
            id="cf-story"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            rows={6}
            className="mt-2"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="cf-goal">Funding goal</Label>
            <Input
              id="cf-goal"
              type="number"
              min={0}
              value={goal}
              onChange={(e) => setGoal(Number(e.target.value))}
              className="mt-2"
            />
          </div>
          <div>
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cf-deadline">Deadline (optional)</Label>
            <Input
              id="cf-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-2"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="cf-category">Category (optional)</Label>
          <Input
            id="cf-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Productivity, Local food, Crafts…"
            className="mt-2"
          />
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground border border-dashed border-border rounded-xl p-3">
        <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
        <span>
          Pledges are recorded as non-binding intents. Real payment processing will be added in a
          future release.
        </span>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          className="rounded-full"
          disabled={isPending || !title.trim()}
          onClick={() =>
            onCreate({
              title: title.trim(),
              pitch: pitch.trim() || null,
              story: story.trim() || null,
              goal_amount: goal || 0,
              currency,
              deadline_at: deadline ? new Date(deadline).toISOString() : null,
              category: category.trim() || null,
              cover_url: null,
              status: "draft",
            })
          }
        >
          <Lock className="size-3.5 mr-2" /> Save private draft
        </Button>
        <Button
          className="rounded-full"
          disabled={isPending || !title.trim()}
          onClick={() =>
            onCreate({
              title: title.trim(),
              pitch: pitch.trim() || null,
              story: story.trim() || null,
              goal_amount: goal || 0,
              currency,
              deadline_at: deadline ? new Date(deadline).toISOString() : null,
              category: category.trim() || null,
              cover_url: null,
              status: "live",
            })
          }
        >
          <Rocket className="size-4 mr-2" /> Publish to community
        </Button>
      </div>

      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
        Project: {projectId}
      </p>
    </div>
  );
}

// ── EditCampaignForm ──────────────────────────────────────────────────────────

type CampaignWithExtras = Campaign & {
  funding_model?: string;
  visibility?: string;
  risks_text?: string;
  video_embed_url?: string;
  goal_stretch?: number | null;
};

function EditCampaignForm({
  campaign,
  onSave,
  isPending,
}: {
  campaign: CampaignWithExtras;
  onSave: (patch: Partial<CampaignWithExtras>) => Promise<void>;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(campaign.title);
  const [pitch, setPitch] = useState(campaign.pitch ?? "");
  const [story, setStory] = useState(campaign.story ?? "");
  const [risks, setRisks] = useState(campaign.risks_text ?? "");
  const [goal, setGoal] = useState<number>(Number(campaign.goal_amount ?? 0));
  const [goalStretch, setGoalStretch] = useState<number>(Number(campaign.goal_stretch ?? 0));
  const [currency, setCurrency] = useState(campaign.currency);
  const [deadline, setDeadline] = useState(
    campaign.deadline_at ? new Date(campaign.deadline_at).toISOString().slice(0, 10) : "",
  );
  const [category, setCategory] = useState(campaign.category ?? "");
  const [coverUrl, setCoverUrl] = useState(campaign.cover_url ?? "");
  const [videoUrl, setVideoUrl] = useState(campaign.video_embed_url ?? "");
  const [status, setStatus] = useState<CampaignStatus>(campaign.status);
  const [fundingModel, setFundingModel] = useState(campaign.funding_model ?? "all_or_nothing");
  const [visibility, setVisibility] = useState(campaign.visibility ?? "private");

  useEffect(() => {
    setTitle(campaign.title);
    setPitch(campaign.pitch ?? "");
    setStory(campaign.story ?? "");
    setRisks(campaign.risks_text ?? "");
    setGoal(Number(campaign.goal_amount ?? 0));
    setGoalStretch(Number(campaign.goal_stretch ?? 0));
    setCurrency(campaign.currency);
    setDeadline(
      campaign.deadline_at ? new Date(campaign.deadline_at).toISOString().slice(0, 10) : "",
    );
    setCategory(campaign.category ?? "");
    setCoverUrl(campaign.cover_url ?? "");
    setVideoUrl(campaign.video_embed_url ?? "");
    setStatus(campaign.status);
    setFundingModel(campaign.funding_model ?? "all_or_nothing");
    setVisibility(campaign.visibility ?? "private");
  }, [campaign]);

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-border">
        <div>
          <Label className="flex items-center gap-1.5">
            <Lock className="size-3.5" /> Visibility
          </Label>
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISIBILITY_OPTIONS.map((v) => (
                <SelectItem key={v.value} value={v.value}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="flex items-center gap-1.5">
            <BadgeCheck className="size-3.5" /> Funding model
          </Label>
          <Select value={fundingModel} onValueChange={setFundingModel}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FUNDING_MODEL_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1.5">
            {FUNDING_MODEL_OPTIONS.find((m) => m.value === fundingModel)?.desc}
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="ec-title">Title</Label>
        <Input
          id="ec-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="mt-2"
        />
      </div>
      <div>
        <Label htmlFor="ec-pitch">One-line pitch</Label>
        <Input
          id="ec-pitch"
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          maxLength={200}
          className="mt-2"
        />
      </div>
      <div>
        <Label htmlFor="ec-story">Story</Label>
        <Textarea
          id="ec-story"
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={6}
          className="mt-2"
        />
      </div>
      <div>
        <Label htmlFor="ec-risks">Risks &amp; challenges</Label>
        <Textarea
          id="ec-risks"
          value={risks}
          onChange={(e) => setRisks(e.target.value)}
          rows={3}
          placeholder="Be honest about what could go wrong and how you'll handle it."
          className="mt-2"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="ec-goal">Goal ({currency})</Label>
          <Input
            id="ec-goal"
            type="number"
            min={0}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="ec-stretch">Stretch goal (optional)</Label>
          <Input
            id="ec-stretch"
            type="number"
            min={0}
            value={goalStretch || ""}
            onChange={(e) => setGoalStretch(Number(e.target.value))}
            placeholder="0"
            className="mt-2"
          />
        </div>
        <div>
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="ec-deadline">Deadline</Label>
          <Input
            id="ec-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="ec-category">Category</Label>
          <Input
            id="ec-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-2"
          />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as CampaignStatus)}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="ec-cover">Cover image URL</Label>
          <Input
            id="ec-cover"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="https://…"
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="ec-video">Video embed URL (optional)</Label>
          <Input
            id="ec-video"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/embed/…"
            className="mt-2"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          className="rounded-full"
          disabled={isPending || !title.trim()}
          onClick={() =>
            onSave({
              title: title.trim(),
              pitch: pitch.trim() || null,
              story: story.trim() || null,
              risks_text: risks.trim() || undefined,
              goal_amount: goal || 0,
              goal_stretch: goalStretch || null,
              currency,
              deadline_at: deadline ? new Date(deadline).toISOString() : null,
              category: category.trim() || null,
              cover_url: coverUrl.trim() || null,
              video_embed_url: videoUrl.trim() || undefined,
              status,
              funding_model: fundingModel,
              visibility,
            })
          }
        >
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
