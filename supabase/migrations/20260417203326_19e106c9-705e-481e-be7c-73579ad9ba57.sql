-- 1. Extend user_mode enum
ALTER TYPE public.user_mode ADD VALUE IF NOT EXISTS 'developer';

-- 2. Resume-note columns on projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS resume_note text,
  ADD COLUMN IF NOT EXISTS resume_note_updated_at timestamptz;

-- 3. Enums for new domains
DO $$ BEGIN
  CREATE TYPE public.campaign_status AS ENUM ('draft', 'live', 'funded', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.comment_target AS ENUM ('campaign', 'post');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reaction_target AS ENUM ('campaign', 'post', 'comment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reaction_kind AS ENUM ('like', 'love', 'fire', 'clap');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.backstage_kind AS ENUM ('wild_niche', 'redesign', 'bug', 'reminder', 'observation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.backstage_status AS ENUM ('open', 'snoozed', 'dismissed', 'acted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  project_id uuid,
  title text NOT NULL,
  pitch text,
  story text,
  category text,
  cover_url text,
  video_url text,
  goal_amount numeric,
  currency text NOT NULL DEFAULT 'USD',
  deadline_at timestamptz,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view live campaigns" ON public.campaigns;
CREATE POLICY "Public can view live campaigns" ON public.campaigns
  FOR SELECT USING (status <> 'draft' OR auth.uid() = created_by);

DROP POLICY IF EXISTS "Owners insert campaigns" ON public.campaigns;
CREATE POLICY "Owners insert campaigns" ON public.campaigns
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Owners update campaigns" ON public.campaigns;
CREATE POLICY "Owners update campaigns" ON public.campaigns
  FOR UPDATE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Owners delete campaigns" ON public.campaigns;
CREATE POLICY "Owners delete campaigns" ON public.campaigns
  FOR DELETE USING (auth.uid() = created_by);

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON public.campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_campaigns_project_id ON public.campaigns(project_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status_created ON public.campaigns(status, created_at DESC);

-- 5. Pledges
CREATE TABLE IF NOT EXISTS public.pledges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  backer_user_id uuid NOT NULL,
  amount numeric NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pledges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated view pledges" ON public.pledges;
CREATE POLICY "Authenticated view pledges" ON public.pledges
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Backers insert pledges" ON public.pledges;
CREATE POLICY "Backers insert pledges" ON public.pledges
  FOR INSERT WITH CHECK (auth.uid() = backer_user_id);

DROP POLICY IF EXISTS "Backers delete pledges" ON public.pledges;
CREATE POLICY "Backers delete pledges" ON public.pledges
  FOR DELETE USING (auth.uid() = backer_user_id);

CREATE INDEX IF NOT EXISTS idx_pledges_campaign ON public.pledges(campaign_id, created_at DESC);

-- 6. Posts (campaign updates)
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated view posts" ON public.posts;
CREATE POLICY "Authenticated view posts" ON public.posts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authors insert posts" ON public.posts;
CREATE POLICY "Authors insert posts" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors update posts" ON public.posts;
CREATE POLICY "Authors update posts" ON public.posts
  FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors delete posts" ON public.posts;
CREATE POLICY "Authors delete posts" ON public.posts
  FOR DELETE USING (auth.uid() = author_id);

CREATE INDEX IF NOT EXISTS idx_posts_campaign ON public.posts(campaign_id, created_at DESC);

-- 7. Comments
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  target_type public.comment_target NOT NULL,
  target_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated view comments" ON public.comments;
CREATE POLICY "Authenticated view comments" ON public.comments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authors insert comments" ON public.comments;
CREATE POLICY "Authors insert comments" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors update comments" ON public.comments;
CREATE POLICY "Authors update comments" ON public.comments
  FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors delete comments" ON public.comments;
CREATE POLICY "Authors delete comments" ON public.comments
  FOR DELETE USING (auth.uid() = author_id);

CREATE INDEX IF NOT EXISTS idx_comments_target ON public.comments(target_type, target_id, created_at);

-- 8. Reactions
CREATE TABLE IF NOT EXISTS public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_type public.reaction_target NOT NULL,
  target_id uuid NOT NULL,
  kind public.reaction_kind NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id, kind)
);
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated view reactions" ON public.reactions;
CREATE POLICY "Authenticated view reactions" ON public.reactions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users insert own reactions" ON public.reactions;
CREATE POLICY "Users insert own reactions" ON public.reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own reactions" ON public.reactions;
CREATE POLICY "Users delete own reactions" ON public.reactions
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reactions_target ON public.reactions(target_type, target_id);

-- 9. Follows
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  followee_user_id uuid,
  followee_campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (followee_user_id IS NOT NULL AND followee_campaign_id IS NULL) OR
    (followee_user_id IS NULL AND followee_campaign_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_follows_user
  ON public.follows(follower_id, followee_user_id) WHERE followee_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_follows_campaign
  ON public.follows(follower_id, followee_campaign_id) WHERE followee_campaign_id IS NOT NULL;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated view follows" ON public.follows;
CREATE POLICY "Authenticated view follows" ON public.follows
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Followers insert follows" ON public.follows;
CREATE POLICY "Followers insert follows" ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Followers delete follows" ON public.follows;
CREATE POLICY "Followers delete follows" ON public.follows
  FOR DELETE USING (auth.uid() = follower_id);

-- 10. Backstage insights
CREATE TABLE IF NOT EXISTS public.backstage_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  kind public.backstage_kind NOT NULL,
  title text NOT NULL,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  weirdness integer NOT NULL DEFAULT 0,
  due_at timestamptz,
  status public.backstage_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.backstage_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage backstage" ON public.backstage_insights;
CREATE POLICY "Owners manage backstage" ON public.backstage_insights
  FOR ALL USING (public.owns_project(project_id))
  WITH CHECK (public.owns_project(project_id));

DROP TRIGGER IF EXISTS update_backstage_insights_updated_at ON public.backstage_insights;
CREATE TRIGGER update_backstage_insights_updated_at
  BEFORE UPDATE ON public.backstage_insights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_backstage_project_status
  ON public.backstage_insights(project_id, status, created_at DESC);

-- 11. Vibe coding workspace
CREATE TABLE IF NOT EXISTS public.vibe_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'landing',
  current_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vibe_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage vibe_projects" ON public.vibe_projects;
CREATE POLICY "Owners manage vibe_projects" ON public.vibe_projects
  FOR ALL USING (public.owns_project(project_id))
  WITH CHECK (public.owns_project(project_id));

DROP TRIGGER IF EXISTS update_vibe_projects_updated_at ON public.vibe_projects;
CREATE TRIGGER update_vibe_projects_updated_at
  BEFORE UPDATE ON public.vibe_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_vibe_projects_project ON public.vibe_projects(project_id);

CREATE TABLE IF NOT EXISTS public.vibe_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vibe_project_id uuid NOT NULL REFERENCES public.vibe_projects(id) ON DELETE CASCADE,
  prompt text,
  summary text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vibe_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage vibe_versions" ON public.vibe_versions;
CREATE POLICY "Owners manage vibe_versions" ON public.vibe_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.vibe_projects vp
      WHERE vp.id = vibe_project_id AND public.owns_project(vp.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vibe_projects vp
      WHERE vp.id = vibe_project_id AND public.owns_project(vp.project_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_vibe_versions_project ON public.vibe_versions(vibe_project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.vibe_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.vibe_versions(id) ON DELETE CASCADE,
  path text NOT NULL,
  content text NOT NULL,
  mime text NOT NULL DEFAULT 'text/plain',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vibe_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage vibe_files" ON public.vibe_files;
CREATE POLICY "Owners manage vibe_files" ON public.vibe_files
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.vibe_versions vv
      JOIN public.vibe_projects vp ON vp.id = vv.vibe_project_id
      WHERE vv.id = version_id AND public.owns_project(vp.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vibe_versions vv
      JOIN public.vibe_projects vp ON vp.id = vv.vibe_project_id
      WHERE vv.id = version_id AND public.owns_project(vp.project_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_vibe_files_version ON public.vibe_files(version_id);

CREATE TABLE IF NOT EXISTS public.vibe_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vibe_project_id uuid NOT NULL REFERENCES public.vibe_projects(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vibe_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage vibe_messages" ON public.vibe_messages;
CREATE POLICY "Owners manage vibe_messages" ON public.vibe_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.vibe_projects vp
      WHERE vp.id = vibe_project_id AND public.owns_project(vp.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vibe_projects vp
      WHERE vp.id = vibe_project_id AND public.owns_project(vp.project_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_vibe_messages_project ON public.vibe_messages(vibe_project_id, created_at);