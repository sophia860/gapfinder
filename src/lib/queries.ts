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
export type UserMode = Database["public"]["Enums"]["user_mode"];
export type TaskColumn = Database["public"]["Enums"]["task_column"];
export type VibeProject = Database["public"]["Tables"]["vibe_projects"]["Row"];
export type VibeVersion = Database["public"]["Tables"]["vibe_versions"]["Row"];
export type VibeFile = Database["public"]["Tables"]["vibe_files"]["Row"];
export type VibeMessage = Database["public"]["Tables"]["vibe_messages"]["Row"];
export type VibeProjectKind = Database["public"]["Enums"]["vibe_project_kind"];

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

/* ---------- vibe projects ---------- */
export function useVibeProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["vibe-project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vibe_projects")
        .select("*")
        .eq("project_id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data as VibeProject | null;
    },
  });
}

export function useCreateVibeProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { project_id: string; kind?: VibeProjectKind }) => {
      const { data, error } = await supabase
        .from("vibe_projects")
        .insert({
          project_id: input.project_id,
          kind: input.kind ?? "website",
        })
        .select()
        .single();
      if (error) throw error;
      return data as VibeProject;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["vibe-project", data.project_id] });
    },
  });
}

export function useUpdateVibeProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<VibeProject> & { id: string }) => {
      const { data, error } = await supabase
        .from("vibe_projects")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as VibeProject;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["vibe-project"] });
    },
  });
}

/* ---------- vibe versions ---------- */
export function useVibeVersions(vibeProjectId: string | undefined) {
  return useQuery({
    queryKey: ["vibe-versions", vibeProjectId],
    enabled: !!vibeProjectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vibe_versions")
        .select("*")
        .eq("vibe_project_id", vibeProjectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VibeVersion[];
    },
  });
}

export function useCreateVibeVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      vibe_project_id: string;
      prompt?: string;
      summary?: string;
      created_by?: string;
    }) => {
      const { data, error } = await supabase.from("vibe_versions").insert(input).select().single();
      if (error) throw error;
      return data as VibeVersion;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["vibe-versions", data.vibe_project_id] });
    },
  });
}

/* ---------- vibe files ---------- */
export function useVibeFiles(versionId: string | undefined) {
  return useQuery({
    queryKey: ["vibe-files", versionId],
    enabled: !!versionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vibe_files")
        .select("*")
        .eq("version_id", versionId!)
        .order("path", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VibeFile[];
    },
  });
}

export function useCreateVibeFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      version_id: string;
      path: string;
      content: string;
      mime?: string;
    }) => {
      const { data, error } = await supabase.from("vibe_files").insert(input).select().single();
      if (error) throw error;
      return data as VibeFile;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["vibe-files", data.version_id] });
    },
  });
}

export function useUpdateVibeFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      version_id,
      ...patch
    }: Partial<VibeFile> & { id: string; version_id: string }) => {
      const { data, error } = await supabase
        .from("vibe_files")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as VibeFile;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["vibe-files", data.version_id] });
    },
  });
}

/* ---------- vibe messages ---------- */
export function useVibeMessages(vibeProjectId: string | undefined) {
  return useQuery({
    queryKey: ["vibe-messages", vibeProjectId],
    enabled: !!vibeProjectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vibe_messages")
        .select("*")
        .eq("vibe_project_id", vibeProjectId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VibeMessage[];
    },
  });
}

export function usePublishVibeVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { vibe_project_id: string; version_id: string }) => {
      // Update the vibe project to set published_version_id
      const { data, error } = await supabase
        .from("vibe_projects")
        .update({ published_version_id: input.version_id })
        .eq("id", input.vibe_project_id)
        .select()
        .single();
      if (error) throw error;
      return data as VibeProject;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["vibe-project"] });
    },
  });
}
