-- Gap-validation pipeline: structured reports + per-user/project AI usage tracking.

CREATE TYPE public.gap_report_verdict AS ENUM ('build', 'kill', 'iterate');

-- GAP REPORTS: one row per validation run for a project.
CREATE TABLE public.gap_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Inputs
  idea TEXT NOT NULL,
  -- Structured output (validated against the Zod schema in src/lib/ai/gap-report.ts)
  problem_clarity JSONB NOT NULL,        -- { score: 1-5, reasoning: string }
  evidence_of_demand JSONB NOT NULL,     -- { score: 1-5, reasoning: string, signals: string[] }
  competitor_density JSONB NOT NULL,     -- { score: 1-5, reasoning: string, examples: string[] }
  differentiation_angle JSONB NOT NULL,  -- { score: 1-5, reasoning: string }
  verdict public.gap_report_verdict NOT NULL,
  verdict_reasoning TEXT NOT NULL,
  next_steps JSONB NOT NULL,             -- string[] (length 3)
  citations JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ source, url, snippet }] from RAG (v2)
  -- Auditability
  model TEXT NOT NULL,
  raw_request JSONB,
  raw_response JSONB,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gap_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage gap reports"
  ON public.gap_reports FOR ALL
  USING (public.owns_project(project_id))
  WITH CHECK (public.owns_project(project_id));
CREATE INDEX idx_gap_reports_project ON public.gap_reports(project_id, created_at DESC);

-- AI USAGE: lightweight per-call ledger. Used for sliding-window rate limiting and per-project cost caps.
CREATE TABLE public.ai_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  function_name TEXT NOT NULL,          -- e.g. 'gapfriend-validate'
  model TEXT,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
-- Read-only for the owning user; writes happen via Edge Functions using the user's JWT
-- (so RLS still applies — no service role required for the v1 cap).
CREATE POLICY "Users view own ai usage"
  ON public.ai_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own ai usage"
  ON public.ai_usage FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_ai_usage_user_time ON public.ai_usage(user_id, created_at DESC);
CREATE INDEX idx_ai_usage_project ON public.ai_usage(project_id, created_at DESC);
