-- Vibe Coding Studio: project_vibes + coding_sessions
-- Depends on public.projects (created in 20260417182152_vibe_coding_tables.sql)

-- Vibe profiles: longitudinal founder energy, palette, tone, successful code patterns
CREATE TABLE IF NOT EXISTS public.project_vibes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  vibe_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Shape: { energy: 'calm'|'creative'|'execution', colors: string[], fonts: string[], tone_keywords: string[], past_patterns: string[] }
  updated_at timestamptz DEFAULT now()
);

-- Coding sessions: each bridges one LangGraph PostgresSaver checkpoint thread
CREATE TABLE IF NOT EXISTS public.coding_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  checkpoint_id text NOT NULL, -- LangGraph thread_id key for pause/resume
  session_vibe_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- RLS: owner-only on both tables
ALTER TABLE public.project_vibes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners can manage their project vibes"
  ON public.project_vibes FOR ALL
  USING (auth.uid() = (SELECT user_id FROM public.projects WHERE id = project_vibes.project_id));

CREATE POLICY "owners can manage their coding sessions"
  ON public.coding_sessions FOR ALL
  USING (auth.uid() = (SELECT user_id FROM public.projects WHERE id = coding_sessions.project_id));

-- Indexes for fast per-project lookup
CREATE INDEX IF NOT EXISTS idx_project_vibes_project_id ON public.project_vibes (project_id);
CREATE INDEX IF NOT EXISTS idx_coding_sessions_project_id ON public.coding_sessions (project_id, created_at DESC);

-- Realtime: subscribe to live vibe + session updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_vibes, public.coding_sessions;
