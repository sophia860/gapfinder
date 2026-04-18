import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RepoConnection = {
  connected: boolean;
  github_login: string | null;
  repo_full_name: string | null;
  default_branch: string | null;
  auth_kind: "pat" | "app";
  last_synced_at: string | null;
} | null;

export type RepoListItem = {
  full_name: string;
  private: boolean;
  default_branch: string;
  updated_at: string;
};

export type Shipment = {
  id: string;
  project_id: string;
  repo_full_name: string;
  branch_name: string;
  pr_number: number | null;
  pr_url: string | null;
  title: string;
  summary: string | null;
  files_changed: number;
  status: string;
  created_at: string;
};

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("github-repo-agent", {
    body: { action, ...payload },
  });
  if (error) throw error;
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export function useRepoConnection() {
  return useQuery({
    queryKey: ["repo", "status"],
    queryFn: () => call<{ connection: RepoConnection }>("status").then((d) => d.connection),
  });
}

export function useConnectPat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      call<{ connection: RepoConnection }>("connect_pat", { token }).then((d) => d.connection),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repo"] }),
  });
}

export function useDisconnectRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => call<{ ok: true }>("disconnect"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repo"] }),
  });
}

export function useListRepos(enabled: boolean) {
  return useQuery({
    queryKey: ["repo", "list"],
    enabled,
    queryFn: () => call<{ repos: RepoListItem[] }>("list_repos").then((d) => d.repos),
  });
}

export function useSetRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (repo_full_name: string) =>
      call<{ connection: RepoConnection }>("set_repo", { repo_full_name }).then((d) => d.connection),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repo"] }),
  });
}

export function useShipFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; prompt?: string }) =>
      call<{ ok: true; pr_number: number; pr_url: string; branch: string; files_changed: number }>(
        "ship_feature",
        input,
      ),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["shipments", vars.projectId] }),
  });
}

export function useShipments(projectId: string | undefined) {
  return useQuery({
    queryKey: ["shipments", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repo_shipments")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Shipment[];
    },
  });
}
