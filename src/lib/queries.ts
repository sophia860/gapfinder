import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"];
export type Identity = Database["public"]["Tables"]["identity"]["Row"];
export type MoneySettings = Database["public"]["Tables"]["money_settings"]["Row"];
export type Channel = Database["public"]["Tables"]["channels"]["Row"];
export type ContentPiece = Database["public"]["Tables"]["content_pieces"]["Row"];
export type OpportunityBrief = Database["public"]["Tables"]["opportunity_briefs"]["Row"];
export type GapCard = Database["public"]["Tables"]["gap_cards"]["Row"];
export type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
export type Pledge = Database["public"]["Tables"]["pledges"]["Row"];
export type Follow = Database["public"]["Tables"]["follows"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type Comment = Database["public"]["Tables"]["comments"]["Row"];
export type Reaction = Database["public"]["Tables"]["reactions"]["Row"];
export type CampaignStatus = Database["public"]["Enums"]["campaign_status"];
export type CommentTarget = Database["public"]["Enums"]["comment_target"];
export type ReactionTarget = Database["public"]["Enums"]["reaction_target"];
export type ReactionKind = Database["public"]["Enums"]["reaction_kind"];
export type UserMode = Database["public"]["Enums"]["user_mode"];
export type TaskColumn = Database["public"]["Enums"]["task_column"];
export type BackstageInsight = Database["public"]["Tables"]["backstage_insights"]["Row"];
export type BackstageKind = Database["public"]["Enums"]["backstage_kind"];
export type BackstageStatus = Database["public"]["Enums"]["backstage_status"];
// Vibe coding tables not yet provisioned in the database. Types intentionally omitted.

/* ---------- backstage insights ---------- */
export function useBackstageInsights(projectId: string | undefined) {
  return useQuery({
    queryKey: ["backstage", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backstage_insights")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BackstageInsight[];
    },
  });
}

export function useTriggerBackstage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { projectId: string; trigger?: string }) => {
      const { data, error } = await supabase.functions.invoke("gapfriend-backstage", {
        body: { projectId: input.projectId, trigger: input.trigger },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["backstage", vars.projectId] }),
  });
}

export function useUpdateInsightStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; projectId: string; status: BackstageStatus }) => {
      const { error } = await supabase
        .from("backstage_insights")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ["backstage", data.projectId] }),
  });
}

/* ---------- profile ---------- */
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Profile> & { user_id: string }) => {
      const { user_id, ...rest } = patch;
      const { data, error } = await supabase
        .from("profiles")
        .upsert({ user_id, ...rest }, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["profile", vars.user_id] }),
  });
}

/* ---------- projects ---------- */
export function useProjects(userId: string | undefined) {
  return useQuery({
    queryKey: ["projects", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error("userId is required");
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", userId)
        .eq("archived", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data as Project | null;
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { user_id: string; working_name?: string }) => {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          user_id: input.user_id,
          working_name: input.working_name ?? "New project",
        })
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Project> & { id: string }) => {
      const { data, error } = await supabase
        .from("projects")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", data.id] });
    },
  });
}

/* ---------- tasks ---------- */
export function useTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ["tasks", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { project_id: string; title: string; column_name?: TaskColumn }) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          project_id: input.project_id,
          title: input.title,
          column_name: input.column_name ?? "later",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ["tasks", data.project_id] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Task> & { id: string }) => {
      const { data, error } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ["tasks", data.project_id] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
      return { project_id };
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ["tasks", data.project_id] }),
  });
}

/* ---------- identity ---------- */
export function useIdentity(projectId: string | undefined) {
  return useQuery({
    queryKey: ["identity", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("identity")
        .select("*")
        .eq("project_id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data as Identity | null;
    },
  });
}

/* ---------- money ---------- */
export function useMoney(projectId: string | undefined) {
  return useQuery({
    queryKey: ["money", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("money_settings")
        .select("*")
        .eq("project_id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data as MoneySettings | null;
    },
  });
}

/* ---------- channels ---------- */
export function useChannels(projectId: string | undefined) {
  return useQuery({
    queryKey: ["channels", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Channel[];
    },
  });
}

/* ---------- content ---------- */
export function useContentPieces(projectId: string | undefined) {
  return useQuery({
    queryKey: ["content", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_pieces")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContentPiece[];
    },
  });
}

/* ---------- chat ---------- */
export function useChatMessages(projectId: string | undefined) {
  return useQuery({
    queryKey: ["chat", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
  });
}

/* ---------- brief ---------- */
export function useBrief(projectId: string | undefined) {
  return useQuery({
    queryKey: ["brief", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunity_briefs")
        .select("*")
        .eq("project_id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data as OpportunityBrief | null;
    },
  });
}

/* ---------- gaps ---------- */
export function useGapCards(projectId: string | undefined) {
  return useQuery({
    queryKey: ["gaps", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gap_cards")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GapCard[];
    },
  });
}

/* ---------- community: campaigns ---------- */
type CampaignSort = "trending" | "newest" | "near_goal";

export function useCampaigns(opts?: { sort?: CampaignSort; category?: string }) {
  const sort: CampaignSort = opts?.sort ?? "newest";
  const category = opts?.category;
  return useQuery({
    queryKey: ["campaigns", "feed", sort, category ?? null],
    queryFn: async () => {
      let q = supabase.from("campaigns").select("*").neq("status", "draft");
      if (category) q = q.eq("category", category);
      // Server-side sort: newest. "trending" / "near_goal" require pledge totals,
      // so we order client-side after fetching.
      q = q.order("created_at", { ascending: false }).limit(60);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
  });
}

export function useCampaign(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["campaign", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId!)
        .maybeSingle();
      if (error) throw error;
      return data as Campaign | null;
    },
  });
}

export function useCampaignByProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["campaign", "by-project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("project_id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data as Campaign | null;
    },
  });
}

export function useCampaignsByUser(userId: string | undefined, opts?: { onlyPublic?: boolean }) {
  const onlyPublic = opts?.onlyPublic ?? false;
  return useQuery({
    queryKey: ["campaigns", "by-user", userId, onlyPublic],
    enabled: !!userId,
    queryFn: async () => {
      let q = supabase.from("campaigns").select("*").eq("created_by", userId!);
      if (onlyPublic) q = q.neq("status", "draft");
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Omit<
        Database["public"]["Tables"]["campaigns"]["Insert"],
        "id" | "created_at" | "updated_at"
      >,
    ) => {
      const { data, error } = await supabase.from("campaigns").insert(input).select().single();
      if (error) throw error;
      return data as Campaign;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["campaign", "by-project", data.project_id] });
    },
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Campaign> & { id: string }) => {
      const { data, error } = await supabase
        .from("campaigns")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Campaign;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["campaign", data.id] });
      qc.invalidateQueries({ queryKey: ["campaign", "by-project", data.project_id] });
    },
  });
}

/* ---------- community: pledges ---------- */
export function usePledges(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["pledges", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pledges")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Pledge[];
    },
  });
}

export function useCreatePledge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      campaign_id: string;
      backer_user_id: string;
      amount: number;
      message?: string | null;
    }) => {
      const { data, error } = await supabase.from("pledges").insert(input).select().single();
      if (error) throw error;
      return data as Pledge;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["pledges", data.campaign_id] });
    },
  });
}

/* ---------- community: posts ---------- */
export function useCampaignPosts(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["posts", "campaign", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Post[];
    },
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { author_id: string; campaign_id?: string | null; body: string }) => {
      const { data, error } = await supabase.from("posts").insert(input).select().single();
      if (error) throw error;
      return data as Post;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["posts", "campaign", data.campaign_id] });
    },
  });
}

/* ---------- community: comments ---------- */
export function useComments(target: { type: CommentTarget; id: string | undefined }) {
  return useQuery({
    queryKey: ["comments", target.type, target.id],
    enabled: !!target.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("target_type", target.type)
        .eq("target_id", target.id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Comment[];
    },
  });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      author_id: string;
      target_type: CommentTarget;
      target_id: string;
      body: string;
    }) => {
      const { data, error } = await supabase.from("comments").insert(input).select().single();
      if (error) throw error;
      return data as Comment;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["comments", data.target_type, data.target_id] });
    },
  });
}

/* ---------- community: reactions ---------- */
export function useReactions(target: { type: ReactionTarget; id: string | undefined }) {
  return useQuery({
    queryKey: ["reactions", target.type, target.id],
    enabled: !!target.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reactions")
        .select("*")
        .eq("target_type", target.type)
        .eq("target_id", target.id!);
      if (error) throw error;
      return (data ?? []) as Reaction[];
    },
  });
}

export function useToggleReaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      target_type: ReactionTarget;
      target_id: string;
      kind?: ReactionKind;
    }) => {
      const kind: ReactionKind = input.kind ?? "like";
      const { data: existing, error: selErr } = await supabase
        .from("reactions")
        .select("id")
        .eq("user_id", input.user_id)
        .eq("target_type", input.target_type)
        .eq("target_id", input.target_id)
        .eq("kind", kind)
        .maybeSingle();
      if (selErr) throw selErr;
      if (existing) {
        const { error } = await supabase.from("reactions").delete().eq("id", existing.id);
        if (error) throw error;
        return { ...input, kind, removed: true } as const;
      }
      const { error } = await supabase.from("reactions").insert({
        user_id: input.user_id,
        target_type: input.target_type,
        target_id: input.target_id,
        kind,
      });
      if (error) throw error;
      return { ...input, kind, removed: false } as const;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["reactions", data.target_type, data.target_id] });
    },
  });
}

/* ---------- community: follows ---------- */
export function useFollows(followerId: string | undefined) {
  return useQuery({
    queryKey: ["follows", followerId],
    enabled: !!followerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follows")
        .select("*")
        .eq("follower_id", followerId!);
      if (error) throw error;
      return (data ?? []) as Follow[];
    },
  });
}

export function useFollowersCount(target: { type: "user" | "campaign"; id: string | undefined }) {
  return useQuery({
    queryKey: ["followers-count", target.type, target.id],
    enabled: !!target.id,
    queryFn: async () => {
      const col = target.type === "user" ? "followee_user_id" : "followee_campaign_id";
      const { count, error } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq(col, target.id!);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useToggleFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      follower_id: string;
      target_type: "user" | "campaign";
      target_id: string;
    }) => {
      const col = input.target_type === "user" ? "followee_user_id" : "followee_campaign_id";
      const { data: existing, error: selErr } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", input.follower_id)
        .eq(col, input.target_id)
        .maybeSingle();
      if (selErr) throw selErr;
      if (existing) {
        const { error } = await supabase.from("follows").delete().eq("id", existing.id);
        if (error) throw error;
        return { ...input, removed: true } as const;
      }
      const row =
        input.target_type === "user"
          ? { follower_id: input.follower_id, followee_user_id: input.target_id }
          : { follower_id: input.follower_id, followee_campaign_id: input.target_id };
      const { error } = await supabase.from("follows").insert(row);
      if (error) throw error;
      return { ...input, removed: false } as const;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["follows", data.follower_id] });
      qc.invalidateQueries({ queryKey: ["followers-count", data.target_type, data.target_id] });
    },
  });
}

/* ---------- community: profiles by user id (public) ---------- */
export function useProfileByUserId(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", "by-user", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

/* ---------- community: dashboard aggregates ---------- */

/**
 * Trending founders: ranked by number of distinct followers.
 * Falls back gracefully when there are no follow rows yet — returns
 * recent campaign creators so the rail is never empty.
 */
export function useTrendingFounders(limit = 6) {
  return useQuery({
    queryKey: ["community", "trending-founders", limit],
    queryFn: async () => {
      const { data: follows, error } = await supabase
        .from("follows")
        .select("followee_user_id")
        .not("followee_user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of follows ?? []) {
        const id = row.followee_user_id as string | null;
        if (!id) continue;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }

      const ranked = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([userId, followers]) => ({ userId, followers }));

      if (ranked.length < limit) {
        const { data: recentCampaigns } = await supabase
          .from("campaigns")
          .select("created_by, created_at")
          .neq("status", "draft")
          .order("created_at", { ascending: false })
          .limit(40);
        const seen = new Set(ranked.map((r) => r.userId));
        for (const c of recentCampaigns ?? []) {
          if (ranked.length >= limit) break;
          if (seen.has(c.created_by)) continue;
          ranked.push({ userId: c.created_by, followers: 0 });
          seen.add(c.created_by);
        }
      }
      return ranked;
    },
  });
}

/** Recent posts across all live campaigns — drives the updates feed. */
export function useRecentCommunityPosts(limit = 12) {
  return useQuery({
    queryKey: ["community", "recent-posts", limit],
    queryFn: async () => {
      const { data: posts, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const list = (posts ?? []) as Post[];
      const campaignIds = Array.from(
        new Set(list.map((p) => p.campaign_id).filter(Boolean) as string[]),
      );
      let campaignsById = new Map<string, Campaign>();
      if (campaignIds.length) {
        const { data: campaigns } = await supabase
          .from("campaigns")
          .select("*")
          .in("id", campaignIds);
        campaignsById = new Map((campaigns ?? []).map((c) => [c.id, c as Campaign]));
      }
      return list.map((post) => ({
        post,
        campaign: post.campaign_id ? (campaignsById.get(post.campaign_id) ?? null) : null,
      }));
    },
  });
}
