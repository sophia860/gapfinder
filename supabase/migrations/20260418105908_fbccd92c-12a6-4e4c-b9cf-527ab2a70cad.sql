-- GitHub repo connections (one row per user; encrypted-at-rest by Supabase, RLS-private)
CREATE TABLE IF NOT EXISTS public.user_github_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  auth_kind text NOT NULL DEFAULT 'pat' CHECK (auth_kind IN ('pat','app')),
  access_token text,                 -- PAT (or short-lived App token); never exposed to client
  github_login text,                 -- e.g. "octocat"
  repo_full_name text,               -- e.g. "octocat/hello-world"
  default_branch text DEFAULT 'main',
  installation_id text,              -- reserved for GitHub App flow
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_github_connections ENABLE ROW LEVEL SECURITY;

-- Users can read their own connection metadata, but NEVER the token (we strip it in queries).
CREATE POLICY "Users view own github connection"
  ON public.user_github_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own github connection"
  ON public.user_github_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own github connection"
  ON public.user_github_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own github connection"
  ON public.user_github_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ugc_user ON public.user_github_connections(user_id);

CREATE TRIGGER trg_ugc_updated_at
  BEFORE UPDATE ON public.user_github_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Track every PR the agent ships, per project
CREATE TABLE IF NOT EXISTS public.repo_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  repo_full_name text NOT NULL,
  branch_name text NOT NULL,
  pr_number integer,
  pr_url text,
  title text NOT NULL,
  summary text,
  files_changed integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'opened' CHECK (status IN ('opened','failed','merged','closed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.repo_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own shipments"
  ON public.repo_shipments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own shipments"
  ON public.repo_shipments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_repo_shipments_project ON public.repo_shipments(project_id, created_at DESC);