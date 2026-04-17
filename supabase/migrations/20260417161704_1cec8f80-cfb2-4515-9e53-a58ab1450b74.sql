
-- Enum for user mode
CREATE TYPE public.user_mode AS ENUM ('solo_founder', 'freelancer', 'existing_business');
CREATE TYPE public.task_column AS ENUM ('later', 'this_week', 'in_progress', 'done');
CREATE TYPE public.chat_role AS ENUM ('user', 'assistant', 'system');
CREATE TYPE public.gap_status AS ENUM ('suggested', 'selected', 'dismissed');
CREATE TYPE public.simulation_verdict AS ENUM ('strong', 'needs_work', 'kill');

-- Shared updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  mode public.user_mode,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  profile_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own profile" ON public.profiles FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PROJECTS
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  working_name TEXT NOT NULL DEFAULT 'Untitled Project',
  tagline TEXT,
  description TEXT,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_projects_user ON public.projects(user_id, archived);

-- Helper: is user owner of a project (security definer to avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.owns_project(_project_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND user_id = auth.uid());
$$;

-- GAP CARDS
CREATE TABLE public.gap_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  persona TEXT,
  problem TEXT,
  why_gap TEXT,
  difficulty TEXT,
  status public.gap_status NOT NULL DEFAULT 'suggested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gap_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage gap cards" ON public.gap_cards FOR ALL USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE INDEX idx_gap_cards_project ON public.gap_cards(project_id);

-- OPPORTUNITY BRIEFS
CREATE TABLE public.opportunity_briefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  persona TEXT,
  problem TEXT,
  angle TEXT,
  business_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.opportunity_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage briefs" ON public.opportunity_briefs FOR ALL USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER briefs_updated_at BEFORE UPDATE ON public.opportunity_briefs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- IDENTITY
CREATE TABLE public.identity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  chosen_name TEXT,
  chosen_domain TEXT,
  tagline TEXT,
  positioning TEXT,
  name_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  domain_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage identity" ON public.identity FOR ALL USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER identity_updated_at BEFORE UPDATE ON public.identity FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CHANNELS
CREATE TABLE public.channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rationale TEXT,
  pros TEXT,
  cons TEXT,
  guide TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage channels" ON public.channels FOR ALL USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE INDEX idx_channels_project ON public.channels(project_id);

-- MONEY SETTINGS
CREATE TABLE public.money_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  income_target NUMERIC,
  price_per_unit NUMERIC,
  hours_per_week NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  scenarios JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.money_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage money" ON public.money_settings FOR ALL USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER money_updated_at BEFORE UPDATE ON public.money_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TASKS
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  column_name public.task_column NOT NULL DEFAULT 'later',
  position INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage tasks" ON public.tasks FOR ALL USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE INDEX idx_tasks_project_column ON public.tasks(project_id, column_name, position);
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SIMULATIONS
CREATE TABLE public.simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  persona TEXT,
  idea TEXT,
  reactions JSONB NOT NULL DEFAULT '[]'::jsonb,
  objections TEXT,
  hooks TEXT,
  recommendation TEXT,
  verdict public.simulation_verdict,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage simulations" ON public.simulations FOR ALL USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE INDEX idx_simulations_project ON public.simulations(project_id);

-- CONTENT PIECES
CREATE TABLE public.content_pieces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT,
  source_text TEXT,
  seo_version TEXT,
  thread_frames JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.content_pieces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage content" ON public.content_pieces FOR ALL USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE INDEX idx_content_project ON public.content_pieces(project_id);
CREATE TRIGGER content_updated_at BEFORE UPDATE ON public.content_pieces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CHAT MESSAGES
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role public.chat_role NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage chat" ON public.chat_messages FOR ALL USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE INDEX idx_chat_project_time ON public.chat_messages(project_id, created_at);
