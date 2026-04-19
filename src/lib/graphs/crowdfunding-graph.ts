// src/lib/graphs/crowdfunding-graph.ts
// TruaraCrowdfund — LangGraph-style stateful agent graph.
//
// Architecture mirrors LangGraph's design without requiring the @langchain/langgraph
// package: a typed StateGraph of async nodes connected by edge conditions, with a
// PostgresSaver-pattern checkpointer that persists every step to Supabase's
// campaign_agent_state table for longitudinal memory across sessions and years.
//
// Usage (client-side, driven by server functions):
//   const graph = new CrowdfundGraph({ supabase, userId });
//   const result = await graph.invoke({ campaignId, trigger: "swarm_complete" });
//
// Each invoke call loads the previous checkpoint, runs whichever nodes are needed,
// persists the new checkpoint, and returns the updated state — building a personal
// data flywheel over time.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// ── State ─────────────────────────────────────────────────────────────────────

export interface CrowdfundState {
  // Immutable context
  campaignId: string;
  ownerId: string;

  // Campaign snapshot (refreshed on each invoke)
  campaignTitle: string;
  campaignPitch: string | null;
  campaignGoal: number;
  campaignCurrency: string;
  fundingModel: string;
  visibility: string;
  backerCount: number;
  raisedAmount: number;

  // Swarm intelligence
  lastSwarmRunId: string | null;
  swarmInsightCount: number;
  swarmTopFindings: string[];

  // Fulfillment
  fulfillmentRiskScore: number | null;
  fulfillmentNarrative: string | null;

  // Agent outputs
  nextActions: NextAction[];
  pricingRecommendations: string[];
  copyImprovements: string[];
  fulfillmentWarnings: string[];

  // Memory / longitudinal context
  pastCampaignOutcomes: string[];
  founderPatterns: string[];
  iterationCount: number;
  lastRunAt: string | null;
}

export interface NextAction {
  priority: "urgent" | "high" | "medium" | "low";
  category: "copy" | "rewards" | "fulfillment" | "launch" | "marketing" | "backer_comms";
  action: string;
  rationale: string;
}

// ── Node results ──────────────────────────────────────────────────────────────

type NodeResult = Partial<CrowdfundState>;

// ── Checkpoint (PostgresSaver pattern) ───────────────────────────────────────

export interface AgentCheckpoint {
  state: CrowdfundState;
  stepCount: number;
  lastNodeRun: string;
  createdAt: string;
  updatedAt: string;
}

// ── Graph definition ──────────────────────────────────────────────────────────

export type NodeName =
  | "load_context"
  | "analyze_swarm"
  | "assess_fulfillment"
  | "derive_next_actions"
  | "build_memory"
  | "END";

interface GraphConfig {
  supabase: SupabaseClient<Database>;
  userId: string;
  /** Override the thread_id (defaults to campaign-scoped thread). */
  threadId?: string;
}

interface InvokeOptions {
  campaignId: string;
  /** Signal to the graph which event triggered this run. */
  trigger?: "swarm_complete" | "manual" | "fulfillment_updated" | "backer_milestone" | "scheduled";
  /** Force all nodes to re-run even if recently checkpointed. */
  force?: boolean;
}

// ── CrowdfundGraph ────────────────────────────────────────────────────────────

export class CrowdfundGraph {
  private readonly supabase: SupabaseClient<Database>;
  private readonly userId: string;
  private readonly threadIdOverride: string | undefined;

  constructor(config: GraphConfig) {
    this.supabase = config.supabase;
    this.userId = config.userId;
    this.threadIdOverride = config.threadId;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Invoke the graph for a campaign.
   * Loads the previous checkpoint, runs the node sequence, saves the new checkpoint,
   * and returns the final state. Thread-safe per (threadId, campaignId) pair.
   */
  async invoke(options: InvokeOptions): Promise<CrowdfundState> {
    const { campaignId, trigger = "manual", force = false } = options;
    const threadId = this.threadIdOverride ?? `crowdfund:${campaignId}`;

    // Load previous checkpoint (longitudinal memory).
    const previous = await this.loadCheckpoint(threadId, campaignId);
    const prevState: Partial<CrowdfundState> = previous?.state ?? {};

    // Build the initial state for this run.
    let state: CrowdfundState = {
      campaignId,
      ownerId: this.userId,
      campaignTitle: prevState.campaignTitle ?? "",
      campaignPitch: prevState.campaignPitch ?? null,
      campaignGoal: prevState.campaignGoal ?? 0,
      campaignCurrency: prevState.campaignCurrency ?? "USD",
      fundingModel: prevState.fundingModel ?? "all_or_nothing",
      visibility: prevState.visibility ?? "private",
      backerCount: prevState.backerCount ?? 0,
      raisedAmount: prevState.raisedAmount ?? 0,
      lastSwarmRunId: prevState.lastSwarmRunId ?? null,
      swarmInsightCount: prevState.swarmInsightCount ?? 0,
      swarmTopFindings: prevState.swarmTopFindings ?? [],
      fulfillmentRiskScore: prevState.fulfillmentRiskScore ?? null,
      fulfillmentNarrative: prevState.fulfillmentNarrative ?? null,
      nextActions: prevState.nextActions ?? [],
      pricingRecommendations: prevState.pricingRecommendations ?? [],
      copyImprovements: prevState.copyImprovements ?? [],
      fulfillmentWarnings: prevState.fulfillmentWarnings ?? [],
      pastCampaignOutcomes: prevState.pastCampaignOutcomes ?? [],
      founderPatterns: prevState.founderPatterns ?? [],
      iterationCount: (prevState.iterationCount ?? 0) + 1,
      lastRunAt: prevState.lastRunAt ?? null,
    };

    // Determine which nodes to run based on trigger + elapsed time.
    const nodesToRun = this.planNodes(trigger, state, force);

    // Execute nodes sequentially.
    for (const nodeName of nodesToRun) {
      const delta = await this.runNode(nodeName, state);
      state = { ...state, ...delta };
    }

    state.lastRunAt = new Date().toISOString();

    // Persist checkpoint.
    const stepCount = (previous?.stepCount ?? 0) + nodesToRun.length;
    await this.saveCheckpoint(threadId, campaignId, state, stepCount, nodesToRun.at(-1) ?? "END");

    return state;
  }

  /**
   * Resume a paused graph from a specific step — useful for long-running
   * multi-turn agent flows or human-in-the-loop confirmation steps.
   */
  async resume(options: { campaignId: string; fromNode: NodeName }): Promise<CrowdfundState> {
    const threadId = this.threadIdOverride ?? `crowdfund:${options.campaignId}`;
    const checkpoint = await this.loadCheckpoint(threadId, options.campaignId);
    if (!checkpoint) throw new Error(`No checkpoint found for campaign ${options.campaignId}`);

    const remaining = this.nodesAfter(options.fromNode);
    let state = checkpoint.state;
    for (const nodeName of remaining) {
      const delta = await this.runNode(nodeName, state);
      state = { ...state, ...delta };
    }

    state.lastRunAt = new Date().toISOString();
    await this.saveCheckpoint(
      threadId,
      options.campaignId,
      state,
      checkpoint.stepCount + remaining.length,
      remaining.at(-1) ?? "END",
    );

    return state;
  }

  // ── Node planning ────────────────────────────────────────────────────────────

  private planNodes(
    trigger: InvokeOptions["trigger"],
    state: CrowdfundState,
    force: boolean,
  ): NodeName[] {
    if (force) return this.allNodes();

    switch (trigger) {
      case "swarm_complete":
        return ["load_context", "analyze_swarm", "derive_next_actions", "build_memory"];
      case "fulfillment_updated":
        return ["load_context", "assess_fulfillment", "derive_next_actions"];
      case "backer_milestone":
        return ["load_context", "derive_next_actions"];
      case "scheduled":
        return this.allNodes();
      case "manual":
      default:
        // Skip nodes whose output is very recent (within the last hour).
        const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
        if (state.lastRunAt && state.lastRunAt > oneHourAgo && state.iterationCount > 1) {
          return ["derive_next_actions"];
        }
        return this.allNodes();
    }
  }

  private allNodes(): NodeName[] {
    return [
      "load_context",
      "analyze_swarm",
      "assess_fulfillment",
      "derive_next_actions",
      "build_memory",
    ];
  }

  private nodesAfter(node: NodeName): NodeName[] {
    const all = this.allNodes();
    const idx = all.indexOf(node as Exclude<NodeName, "END">);
    return idx === -1 ? [] : all.slice(idx + 1);
  }

  // ── Node dispatch ────────────────────────────────────────────────────────────

  private async runNode(name: NodeName, state: CrowdfundState): Promise<NodeResult> {
    switch (name) {
      case "load_context":
        return this.nodeLoadContext(state);
      case "analyze_swarm":
        return this.nodeAnalyzeSwarm(state);
      case "assess_fulfillment":
        return this.nodeAssessFulfillment(state);
      case "derive_next_actions":
        return this.nodeDeriveNextActions(state);
      case "build_memory":
        return this.nodeBuildMemory(state);
      default:
        return {};
    }
  }

  // ── Nodes ────────────────────────────────────────────────────────────────────

  /** load_context — refresh campaign snapshot from the database. */
  private async nodeLoadContext(state: CrowdfundState): Promise<NodeResult> {
    const { data: campaign } = await this.supabase
      .from("campaigns")
      .select("*")
      .eq("id", state.campaignId)
      .maybeSingle();
    if (!campaign) return {};

    const { data: pledges } = await this.supabase
      .from("pledges")
      .select("amount")
      .eq("campaign_id", state.campaignId);

    const raised = (pledges ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

    return {
      campaignTitle: campaign.title,
      campaignPitch: campaign.pitch ?? null,
      campaignGoal: Number(campaign.goal_amount ?? 0),
      campaignCurrency: campaign.currency,
      // New columns added by migration; cast to any since types.ts is not regenerated yet.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fundingModel: (campaign as any).funding_model ?? "all_or_nothing",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      visibility: (campaign as any).visibility ?? "private",
      backerCount: pledges?.length ?? 0,
      raisedAmount: raised,
    };
  }

  /** analyze_swarm — pull latest swarm run + top insights into state. */
  private async nodeAnalyzeSwarm(state: CrowdfundState): Promise<NodeResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = this.supabase as any;
    const { data: run } = await sb
      .from("campaign_swarm_runs")
      .select("id, summary")
      .eq("campaign_id", state.campaignId)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { id: string; summary: string } | null };

    if (!run) return {};

    const { data: insights } = await sb
      .from("campaign_swarm_insights")
      .select("insight, category, severity, sentiment")
      .eq("run_id", run.id)
      .eq("dismissed", false)
      .order("severity", { ascending: false })
      .limit(5) as { data: Array<{ insight: string; category: string; severity: number; sentiment: string }> | null };

    const topFindings = (insights ?? []).map(
      (i) => `[${i.category}] ${i.insight}`,
    );

    const copyImprovements = (insights ?? [])
      .filter((i) => i.category === "page_copy" || i.category === "trust_signal")
      .map((i) => i.insight);

    return {
      lastSwarmRunId: run.id,
      swarmInsightCount: insights?.length ?? 0,
      swarmTopFindings: topFindings,
      copyImprovements,
    };
  }

  /** assess_fulfillment — pull latest fulfillment estimate into state. */
  private async nodeAssessFulfillment(state: CrowdfundState): Promise<NodeResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = this.supabase as any;
    const { data: est } = await sb
      .from("campaign_fulfillment_estimates")
      .select("risk_score, risk_notes, ai_narrative")
      .eq("campaign_id", state.campaignId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { risk_score: number | null; risk_notes: string | null; ai_narrative: string | null } | null };

    if (!est) return {};

    const warnings: string[] = [];
    if (est.risk_score !== null && est.risk_score >= 7) {
      warnings.push(`High fulfillment risk (${est.risk_score}/10): ${est.risk_notes ?? ""}`);
    }

    return {
      fulfillmentRiskScore: est.risk_score,
      fulfillmentNarrative: est.ai_narrative ?? null,
      fulfillmentWarnings: warnings,
    };
  }

  /**
   * derive_next_actions — synthesise everything in state into a prioritised list
   * of calm, actionable next steps for the founder. Rule-based so it works without
   * an extra AI call; swappable for an LLM call when richer reasoning is needed.
   */
  private nodeDeriveNextActions(state: CrowdfundState): NodeResult {
    const actions: NextAction[] = [];

    // Visibility nudge — private campaigns need to eventually go public.
    if (state.visibility === "private" && state.iterationCount >= 3) {
      actions.push({
        priority: "medium",
        category: "launch",
        action: "Set campaign to 'invite_only' and share with 5 trusted early backers.",
        rationale:
          "Campaign is still private after multiple agent iterations. Gathering trusted feedback before a full launch reduces risk.",
      });
    }

    // Swarm insights available but not yet acted on.
    if (state.swarmInsightCount > 0 && state.copyImprovements.length > 0) {
      actions.push({
        priority: "high",
        category: "copy",
        action: `Address the top copy issue flagged by the swarm: "${state.copyImprovements[0]}"`,
        rationale: "Swarm identified page-copy or trust-signal gaps that reduce conversion.",
      });
    }

    // Fulfillment risk.
    if (state.fulfillmentRiskScore !== null && state.fulfillmentRiskScore >= 7) {
      actions.push({
        priority: "urgent",
        category: "fulfillment",
        action: "Review and resolve fulfillment risks before launching.",
        rationale: state.fulfillmentWarnings[0] ?? "High fulfillment risk score detected.",
      });
    }

    // No reward tiers.
    if (state.swarmInsightCount === 0 && state.iterationCount === 1) {
      actions.push({
        priority: "high",
        category: "rewards",
        action: "Add at least 3 reward tiers and run the Swarm Intel analysis.",
        rationale:
          "No swarm data yet. Adding tiers unlocks fulfillment estimates and synthetic backer feedback.",
      });
    }

    // Backer milestone comms.
    if (state.backerCount > 0 && state.backerCount % 10 === 0) {
      actions.push({
        priority: "medium",
        category: "backer_comms",
        action: `Post a backer update celebrating ${state.backerCount} backers.`,
        rationale: "Regular updates maintain momentum and reduce backer anxiety.",
      });
    }

    // Goal progress nudge.
    const progress = state.campaignGoal > 0 ? state.raisedAmount / state.campaignGoal : 0;
    if (progress >= 0.8 && progress < 1) {
      actions.push({
        priority: "high",
        category: "marketing",
        action: `You're at ${Math.round(progress * 100)}% funded — send a final push update to drive you over the goal.`,
        rationale: "Late-stage momentum is critical for all-or-nothing campaigns.",
      });
    }

    // Sort: urgent → high → medium → low.
    const order = { urgent: 0, high: 1, medium: 2, low: 3 };
    actions.sort((a, b) => order[a.priority] - order[b.priority]);

    return { nextActions: actions.slice(0, 5) };
  }

  /**
   * build_memory — extract patterns from the current state to store in
   * founderPatterns for future sessions (longitudinal data flywheel).
   */
  private nodeBuildMemory(state: CrowdfundState): NodeResult {
    const patterns: string[] = [...(state.founderPatterns ?? [])];

    // Record funding model preference.
    const modelPattern = `Preferred funding model: ${state.fundingModel}`;
    if (!patterns.includes(modelPattern)) patterns.push(modelPattern);

    // Record if founder tends to keep campaigns private a long time.
    if (state.iterationCount > 5 && state.visibility === "private") {
      const cautionNote = "Founder tends to keep campaigns private through many iterations.";
      if (!patterns.includes(cautionNote)) patterns.push(cautionNote);
    }

    // Keep last 20 patterns.
    return { founderPatterns: patterns.slice(-20) };
  }

  // ── Checkpointer (PostgresSaver pattern) ──────────────────────────────────

  private async loadCheckpoint(
    threadId: string,
    campaignId: string,
  ): Promise<AgentCheckpoint | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = this.supabase as any;
    const { data } = await sb
      .from("campaign_agent_state")
      .select("checkpoint, step_count, updated_at, created_at, metadata")
      .eq("thread_id", threadId)
      .eq("campaign_id", campaignId)
      .maybeSingle() as {
      data: {
        checkpoint: unknown;
        step_count: number;
        updated_at: string;
        created_at: string;
        metadata: Record<string, unknown>;
      } | null;
    };

    if (!data) return null;

    return {
      state: data.checkpoint as CrowdfundState,
      stepCount: data.step_count,
      lastNodeRun: (data.metadata?.lastNodeRun as string) ?? "",
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  private async saveCheckpoint(
    threadId: string,
    campaignId: string,
    state: CrowdfundState,
    stepCount: number,
    lastNodeRun: string,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = this.supabase as any;
    await sb.from("campaign_agent_state").upsert(
      {
        thread_id: threadId,
        campaign_id: campaignId,
        owner_id: this.userId,
        checkpoint: state as unknown as Record<string, unknown>,
        metadata: { lastNodeRun, iterationCount: state.iterationCount },
        step_count: stepCount,
      },
      { onConflict: "thread_id,campaign_id" },
    );

    // Keep thread_id in sync on the campaign row for easy lookup.
    // Cast to any since agent_thread_id is a new migration column not yet in types.ts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.supabase as any)
      .from("campaigns")
      .update({ agent_thread_id: threadId })
      .eq("id", campaignId);
  }
}

// ── Factory helper ────────────────────────────────────────────────────────────

/**
 * Create a CrowdfundGraph instance for the given user.
 * Pass the authenticated Supabase client so RLS is applied to all reads/writes.
 */
export function createCrowdfundGraph(
  supabase: SupabaseClient<Database>,
  userId: string,
): CrowdfundGraph {
  return new CrowdfundGraph({ supabase, userId });
}
