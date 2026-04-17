-- Enum for vibe project kind
CREATE TYPE public.vibe_project_kind AS ENUM ('website', 'webapp', 'landing');

-- VIBE PROJECTS
-- One row per project that uses Vibe Coding or Coding Space
CREATE TABLE public.vibe_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  kind public.vibe_project_kind NOT NULL DEFAULT 'website',
  current_version_id UUID,
  published_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vibe_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage vibe projects" ON public.vibe_projects FOR ALL 
  USING (public.owns_project(project_id)) 
  WITH CHECK (public.owns_project(project_id));

CREATE TRIGGER vibe_projects_updated_at 
  BEFORE UPDATE ON public.vibe_projects 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_vibe_projects_project ON public.vibe_projects(project_id);

-- VIBE VERSIONS
-- Immutable snapshots of generated code/sites
CREATE TABLE public.vibe_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vibe_project_id UUID NOT NULL REFERENCES public.vibe_projects(id) ON DELETE CASCADE,
  prompt TEXT,
  summary TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vibe_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage vibe versions" ON public.vibe_versions FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.vibe_projects vp 
      WHERE vp.id = vibe_project_id 
      AND public.owns_project(vp.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vibe_projects vp 
      WHERE vp.id = vibe_project_id 
      AND public.owns_project(vp.project_id)
    )
  );

CREATE INDEX idx_vibe_versions_project ON public.vibe_versions(vibe_project_id, created_at DESC);

-- Add foreign key constraint for current_version_id (now that vibe_versions exists)
ALTER TABLE public.vibe_projects 
  ADD CONSTRAINT fk_vibe_projects_current_version 
  FOREIGN KEY (current_version_id) 
  REFERENCES public.vibe_versions(id) ON DELETE SET NULL;

ALTER TABLE public.vibe_projects 
  ADD CONSTRAINT fk_vibe_projects_published_version 
  FOREIGN KEY (published_version_id) 
  REFERENCES public.vibe_versions(id) ON DELETE SET NULL;

-- VIBE FILES
-- Files belonging to a version
CREATE TABLE public.vibe_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version_id UUID NOT NULL REFERENCES public.vibe_versions(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT 'text/plain',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vibe_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage vibe files" ON public.vibe_files FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.vibe_versions vv
      JOIN public.vibe_projects vp ON vv.vibe_project_id = vp.id
      WHERE vv.id = version_id 
      AND public.owns_project(vp.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vibe_versions vv
      JOIN public.vibe_projects vp ON vv.vibe_project_id = vp.id
      WHERE vv.id = version_id 
      AND public.owns_project(vp.project_id)
    )
  );

CREATE INDEX idx_vibe_files_version ON public.vibe_files(version_id);
CREATE INDEX idx_vibe_files_version_path ON public.vibe_files(version_id, path);

-- VIBE MESSAGES
-- Chat history for the Vibe prompt panel
CREATE TABLE public.vibe_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vibe_project_id UUID NOT NULL REFERENCES public.vibe_projects(id) ON DELETE CASCADE,
  role public.chat_role NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vibe_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage vibe messages" ON public.vibe_messages FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.vibe_projects vp 
      WHERE vp.id = vibe_project_id 
      AND public.owns_project(vp.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vibe_projects vp 
      WHERE vp.id = vibe_project_id 
      AND public.owns_project(vp.project_id)
    )
  );

CREATE INDEX idx_vibe_messages_project_time ON public.vibe_messages(vibe_project_id, created_at);
