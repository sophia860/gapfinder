-- Backstage: a background reasoning AI that quietly studies the user,
-- proposes redesigns, fixes bugs, sets reminders, and hunts unusual niches.

CREATE TYPE public.backstage_kind AS ENUM (
  'wild_niche',
  'redesign',
  'bug',
  'reminder',
  'observation'
);

CREATE TYPE public.backstage_status AS ENUM (
  'open',
  'acted',
  'dismissed',
  'snoozed'
);

-- BACKSTAGE_MEMORY: durable, per-user model the AI builds about its human.
-- One row per (user, key). The AI uses 'record_observation' to update it.
CREATE TABLE public.backstage_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
ALTER TABLE public.backstage_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own backstage memory"
  ON public.backstage_memory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own backstage memory"
  ON public.backstage_memory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own backstage memory"
  ON public.backstage_memory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own backstage memory"
  ON public.backstage_memory FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER backstage_memory_updated_at
  BEFORE UPDATE ON public.backstage_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_backstage_memory_user ON public.backstage_memory(user_id);

-- BACKSTAGE_INSIGHTS: timestamped surfaceable findings tied to a project.
CREATE TABLE public.backstage_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind public.backstage_kind NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.backstage_status NOT NULL DEFAULT 'open',
  weirdness INTEGER NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.backstage_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage backstage insights"
  ON public.backstage_insights FOR ALL
  USING (public.owns_project(project_id))
  WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER backstage_insights_updated_at
  BEFORE UPDATE ON public.backstage_insights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_backstage_insights_project_status
  ON public.backstage_insights(project_id, status, created_at DESC);

-- BACKSTAGE_RUNS: lightweight log so the function can self-throttle.
CREATE TABLE public.backstage_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  trigger TEXT,
  inputs_hash TEXT,
  insights_added INTEGER NOT NULL DEFAULT 0,
  observations_added INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.backstage_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read backstage runs"
  ON public.backstage_runs FOR SELECT USING (public.owns_project(project_id));
CREATE POLICY "Owners insert backstage runs"
  ON public.backstage_runs FOR INSERT WITH CHECK (public.owns_project(project_id));
CREATE INDEX idx_backstage_runs_project_time
  ON public.backstage_runs(project_id, created_at DESC);
