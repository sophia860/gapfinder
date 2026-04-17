-- Crowdfunding & community feature
-- Adds: campaigns, pledges, follows, posts, comments, reactions
-- Plus enums and RLS policies for public discovery + authenticated participation.

CREATE TYPE public.campaign_status AS ENUM ('draft', 'live', 'funded', 'closed');
CREATE TYPE public.reaction_kind AS ENUM ('like', 'clap', 'fire', 'heart');
CREATE TYPE public.comment_target AS ENUM ('campaign', 'post');
CREATE TYPE public.reaction_target AS ENUM ('campaign', 'post', 'comment');

-- =========================
-- CAMPAIGNS
-- =========================
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  pitch TEXT,
  story TEXT,
  goal_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  deadline TIMESTAMPTZ,
  cover_url TEXT,
  category TEXT,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read live/funded/closed campaigns.
CREATE POLICY "Public read live campaigns" ON public.campaigns
  FOR SELECT USING (status <> 'draft');
-- Owners can read their own campaigns regardless of status.
CREATE POLICY "Owners read own campaigns" ON public.campaigns
  FOR SELECT USING (auth.uid() = created_by);
-- Owner-only writes; created_by must match current user and project must be owned.
CREATE POLICY "Owners insert own campaigns" ON public.campaigns
  FOR INSERT WITH CHECK (auth.uid() = created_by AND public.owns_project(project_id));
CREATE POLICY "Owners update own campaigns" ON public.campaigns
  FOR UPDATE USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners delete own campaigns" ON public.campaigns
  FOR DELETE USING (auth.uid() = created_by);

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_campaigns_status_created ON public.campaigns(status, created_at DESC);
CREATE INDEX idx_campaigns_created_by ON public.campaigns(created_by);

-- Helper: is a campaign publicly visible (i.e. not draft)?
CREATE OR REPLACE FUNCTION public.campaign_is_public(_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE id = _campaign_id AND status <> 'draft'
  );
$$;

-- Helper: did the current user create this campaign?
CREATE OR REPLACE FUNCTION public.owns_campaign(_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE id = _campaign_id AND created_by = auth.uid()
  );
$$;

-- =========================
-- PLEDGES (non-binding, demo)
-- =========================
CREATE TABLE public.pledges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  backer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pledges ENABLE ROW LEVEL SECURITY;

-- Pledges on public campaigns are visible to everyone.
CREATE POLICY "Public read pledges on public campaigns" ON public.pledges
  FOR SELECT USING (public.campaign_is_public(campaign_id));
-- Backers can always read their own pledges.
CREATE POLICY "Backer reads own pledges" ON public.pledges
  FOR SELECT USING (auth.uid() = backer_user_id);
-- Campaign owners can read all pledges on their campaigns.
CREATE POLICY "Owner reads campaign pledges" ON public.pledges
  FOR SELECT USING (public.owns_campaign(campaign_id));
-- Any authenticated user may pledge to a public campaign (recorded as intent).
CREATE POLICY "Authenticated insert pledge" ON public.pledges
  FOR INSERT WITH CHECK (
    auth.uid() = backer_user_id AND public.campaign_is_public(campaign_id)
  );
-- Backers can delete their own pledges.
CREATE POLICY "Backer delete own pledge" ON public.pledges
  FOR DELETE USING (auth.uid() = backer_user_id);

CREATE INDEX idx_pledges_campaign ON public.pledges(campaign_id, created_at DESC);
CREATE INDEX idx_pledges_backer ON public.pledges(backer_user_id);

-- =========================
-- FOLLOWS (campaigns or users)
-- =========================
CREATE TABLE public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Exactly one of followee_user_id / followee_campaign_id must be set.
  CHECK (
    (followee_user_id IS NOT NULL AND followee_campaign_id IS NULL)
    OR (followee_user_id IS NULL AND followee_campaign_id IS NOT NULL)
  ),
  -- Cannot follow yourself.
  CHECK (followee_user_id IS NULL OR followee_user_id <> follower_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_follows_unique_user
  ON public.follows(follower_id, followee_user_id)
  WHERE followee_user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_follows_unique_campaign
  ON public.follows(follower_id, followee_campaign_id)
  WHERE followee_campaign_id IS NOT NULL;
CREATE INDEX idx_follows_followee_user ON public.follows(followee_user_id);
CREATE INDEX idx_follows_followee_campaign ON public.follows(followee_campaign_id);

-- Follows are public (so followers can be counted/listed).
CREATE POLICY "Public read follows" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Follower inserts own follow" ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Follower deletes own follow" ON public.follows
  FOR DELETE USING (auth.uid() = follower_id);

-- =========================
-- POSTS (campaign updates / social posts)
-- =========================
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Posts attached to a public campaign are public.
CREATE POLICY "Public read campaign posts" ON public.posts
  FOR SELECT USING (
    campaign_id IS NOT NULL AND public.campaign_is_public(campaign_id)
  );
-- Standalone posts are public too (founder timeline).
CREATE POLICY "Public read standalone posts" ON public.posts
  FOR SELECT USING (campaign_id IS NULL);
-- Authors can insert posts. If attached to a campaign, must own that campaign.
CREATE POLICY "Author inserts own post" ON public.posts
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND (campaign_id IS NULL OR public.owns_campaign(campaign_id))
  );
CREATE POLICY "Author updates own post" ON public.posts
  FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Author deletes own post" ON public.posts
  FOR DELETE USING (auth.uid() = author_id);

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_posts_campaign_created ON public.posts(campaign_id, created_at DESC);
CREATE INDEX idx_posts_author_created ON public.posts(author_id, created_at DESC);

-- Helper: is this post publicly visible?
CREATE OR REPLACE FUNCTION public.post_is_public(_post_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = _post_id
      AND (p.campaign_id IS NULL OR public.campaign_is_public(p.campaign_id))
  );
$$;

-- =========================
-- COMMENTS (on campaigns or posts)
-- =========================
CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.comment_target NOT NULL,
  target_id UUID NOT NULL,
  body TEXT NOT NULL CHECK (length(body) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read comments on public targets" ON public.comments
  FOR SELECT USING (
    (target_type = 'campaign' AND public.campaign_is_public(target_id))
    OR (target_type = 'post' AND public.post_is_public(target_id))
  );
CREATE POLICY "Author inserts own comment" ON public.comments
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND (
      (target_type = 'campaign' AND public.campaign_is_public(target_id))
      OR (target_type = 'post' AND public.post_is_public(target_id))
    )
  );
CREATE POLICY "Author updates own comment" ON public.comments
  FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Author deletes own comment" ON public.comments
  FOR DELETE USING (auth.uid() = author_id);

CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_comments_target ON public.comments(target_type, target_id, created_at DESC);
CREATE INDEX idx_comments_author ON public.comments(author_id);

-- =========================
-- REACTIONS (on campaigns / posts / comments)
-- =========================
CREATE TABLE public.reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.reaction_target NOT NULL,
  target_id UUID NOT NULL,
  kind public.reaction_kind NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- One reaction per (user, target, kind).
CREATE UNIQUE INDEX idx_reactions_unique
  ON public.reactions(user_id, target_type, target_id, kind);
CREATE INDEX idx_reactions_target
  ON public.reactions(target_type, target_id);

CREATE POLICY "Public read reactions" ON public.reactions FOR SELECT USING (true);
CREATE POLICY "User inserts own reaction" ON public.reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User deletes own reaction" ON public.reactions
  FOR DELETE USING (auth.uid() = user_id);

-- =========================
-- Public read of profiles for community
-- =========================
-- The existing profiles policy only allows users to view their own profile.
-- We need authors / founders to be visible publicly for the community.
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);
