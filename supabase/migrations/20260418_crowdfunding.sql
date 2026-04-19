-- TruaraCrowdfund — calm, zero-burnout crowdfunding OS upgrade
-- Extends the existing campaigns schema with:
--   • Hybrid funding models (all-or-nothing / flexible / recurring / installment)
--   • Private-by-default visibility controls
--   • Reward tiers with fulfillment tracking
--   • Synthetic AI swarm runs + per-persona insights
--   • Longitudinal agent memory (PostgresSaver-style checkpointing)
--   • Per-tier fulfillment cost + risk estimates

-- ============================
-- NEW ENUM TYPES
-- ============================

CREATE TYPE public.funding_model AS ENUM (
  'all_or_nothing',
  'flexible',
  'recurring',
  'installment'
);

CREATE TYPE public.campaign_visibility AS ENUM (
  'private',
  'invite_only',
  'public'
);

CREATE TYPE public.swarm_run_status AS ENUM (
  'pending',
  'running',
  'complete',
  'failed'
);

CREATE TYPE public.swarm_persona AS ENUM (
  'skeptical_backer',
  'enthusiast_backer',
  'domain_critic',
  'logistician',
  'growth_marketer',
  'price_shopper',
  'repeat_backer'
);

CREATE TYPE public.swarm_insight_category AS ENUM (
  'page_copy',
  'reward_tier',
  'pricing',
  'fulfillment_risk',
  'audience_fit',
  'trust_signal',
  'virality',
  'timing'
);

-- ============================
-- EXTEND campaigns TABLE
-- New upgrade columns; all nullable / defaulted to protect existing rows.
-- ============================

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS funding_model     public.funding_model     NOT NULL DEFAULT 'all_or_nothing',
  ADD COLUMN IF NOT EXISTS visibility        public.campaign_visibility NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS private_notes     TEXT,
  ADD COLUMN IF NOT EXISTS risks_text        TEXT,
  ADD COLUMN IF NOT EXISTS swarm_last_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agent_thread_id   TEXT,
  ADD COLUMN IF NOT EXISTS video_embed_url   TEXT,
  ADD COLUMN IF NOT EXISTS goal_stretch      NUMERIC,
  ADD COLUMN IF NOT EXISTS published_at      TIMESTAMPTZ;

-- Back-fill visibility: draft campaigns stay private, everything live/funded/closed is public.
UPDATE public.campaigns SET visibility = 'private' WHERE status = 'draft';
UPDATE public.campaigns SET visibility = 'public'  WHERE status IN ('live', 'funded', 'closed');

-- Tighten the existing public-read policy: only show campaigns where
-- status <> 'draft' AND visibility = 'public'. Owners keep full access via
-- the owner policy. Drop + re-create (idempotent).
DROP POLICY IF EXISTS "Public read live campaigns" ON public.campaigns;
CREATE POLICY "Public read live campaigns" ON public.campaigns
  FOR SELECT USING (status <> 'draft' AND visibility = 'public');

-- ============================
-- CAMPAIGN REWARD TIERS
-- ============================

CREATE TABLE public.campaign_reward_tiers (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id           UUID        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  title                 TEXT        NOT NULL,
  description           TEXT,
  min_pledge            NUMERIC     NOT NULL DEFAULT 1 CHECK (min_pledge >= 0),
  backer_limit          INT,
  backer_count          INT         NOT NULL DEFAULT 0 CHECK (backer_count >= 0),
  estimated_delivery_at TIMESTAMPTZ,
  digital_only          BOOLEAN     NOT NULL DEFAULT false,
  position              INT         NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_reward_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read reward tiers on public campaigns"
  ON public.campaign_reward_tiers FOR SELECT
  USING (public.campaign_is_public(campaign_id));

CREATE POLICY "Owner reads own reward tiers"
  ON public.campaign_reward_tiers FOR SELECT
  USING (public.owns_campaign(campaign_id));

CREATE POLICY "Owner inserts reward tiers"
  ON public.campaign_reward_tiers FOR INSERT
  WITH CHECK (public.owns_campaign(campaign_id));

CREATE POLICY "Owner updates reward tiers"
  ON public.campaign_reward_tiers FOR UPDATE
  USING  (public.owns_campaign(campaign_id))
  WITH CHECK (public.owns_campaign(campaign_id));

CREATE POLICY "Owner deletes reward tiers"
  ON public.campaign_reward_tiers FOR DELETE
  USING (public.owns_campaign(campaign_id));

CREATE TRIGGER campaign_reward_tiers_updated_at
  BEFORE UPDATE ON public.campaign_reward_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_reward_tiers_campaign
  ON public.campaign_reward_tiers(campaign_id, position ASC);

-- ============================
-- CAMPAIGN SWARM RUNS
-- Each run represents one synthetic-persona feedback loop invocation.
-- Strictly private — only the campaign owner can read or write.
-- ============================

CREATE TABLE public.campaign_swarm_runs (
  id            UUID                     NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id   UUID                     NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  owner_id      UUID                     NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  status        public.swarm_run_status  NOT NULL DEFAULT 'pending',
  summary       TEXT,
  personas_used public.swarm_persona[]   NOT NULL DEFAULT '{}',
  raw_input     JSONB,
  created_at    TIMESTAMPTZ              NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

ALTER TABLE public.campaign_swarm_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own swarm runs"
  ON public.campaign_swarm_runs FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Owner inserts swarm run"
  ON public.campaign_swarm_runs FOR INSERT
  WITH CHECK (auth.uid() = owner_id AND public.owns_campaign(campaign_id));

CREATE POLICY "Owner updates swarm run"
  ON public.campaign_swarm_runs FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE INDEX idx_swarm_runs_campaign
  ON public.campaign_swarm_runs(campaign_id, created_at DESC);

-- ============================
-- CAMPAIGN SWARM INSIGHTS
-- One row per insight/observation from a single persona within a run.
-- ============================

CREATE TABLE public.campaign_swarm_insights (
  id          UUID                          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id      UUID                          NOT NULL REFERENCES public.campaign_swarm_runs(id) ON DELETE CASCADE,
  campaign_id UUID                          NOT NULL REFERENCES public.campaigns(id)           ON DELETE CASCADE,
  owner_id    UUID                          NOT NULL REFERENCES auth.users(id)                 ON DELETE CASCADE,
  persona     public.swarm_persona          NOT NULL,
  category    public.swarm_insight_category NOT NULL,
  insight     TEXT                          NOT NULL,
  suggestion  TEXT,
  severity    INT                           NOT NULL DEFAULT 5 CHECK (severity BETWEEN 1 AND 10),
  sentiment   TEXT                          CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  dismissed   BOOLEAN                       NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ                   NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_swarm_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own swarm insights"
  ON public.campaign_swarm_insights FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Owner inserts swarm insight"
  ON public.campaign_swarm_insights FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner updates swarm insight"
  ON public.campaign_swarm_insights FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE INDEX idx_swarm_insights_campaign
  ON public.campaign_swarm_insights(campaign_id, created_at DESC);

CREATE INDEX idx_swarm_insights_run
  ON public.campaign_swarm_insights(run_id);

-- ============================
-- CAMPAIGN AGENT STATE
-- PostgresSaver-style longitudinal memory for the stateful LangGraph-pattern agent.
-- One row per (thread_id, campaign_id) pair; upserted on every checkpoint write.
-- thread_id ties a campaign to its full multi-session agent history — the personal
-- data flywheel that improves over time.
-- ============================

CREATE TABLE public.campaign_agent_state (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id   TEXT        NOT NULL,
  campaign_id UUID        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  owner_id    UUID        NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
  checkpoint  JSONB       NOT NULL DEFAULT '{}',
  metadata    JSONB       NOT NULL DEFAULT '{}',
  step_count  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (thread_id, campaign_id)
);

ALTER TABLE public.campaign_agent_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own agent state"
  ON public.campaign_agent_state FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Owner inserts agent state"
  ON public.campaign_agent_state FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner updates agent state"
  ON public.campaign_agent_state FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE TRIGGER campaign_agent_state_updated_at
  BEFORE UPDATE ON public.campaign_agent_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_agent_state_thread
  ON public.campaign_agent_state(thread_id, campaign_id);

CREATE INDEX idx_agent_state_campaign
  ON public.campaign_agent_state(campaign_id, updated_at DESC);

-- ============================
-- CAMPAIGN FULFILLMENT ESTIMATES
-- Per-tier cost/risk estimates; total_cost_per_unit computed automatically.
-- ============================

CREATE TABLE public.campaign_fulfillment_estimates (
  id                         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id                UUID        NOT NULL REFERENCES public.campaigns(id)            ON DELETE CASCADE,
  reward_tier_id             UUID                 REFERENCES public.campaign_reward_tiers(id) ON DELETE CASCADE,
  owner_id                   UUID        NOT NULL REFERENCES auth.users(id)                  ON DELETE CASCADE,
  unit_cogs_estimate         NUMERIC,
  unit_shipping_estimate     NUMERIC,
  unit_platform_fee_estimate NUMERIC,
  total_cost_per_unit        NUMERIC GENERATED ALWAYS AS (
    COALESCE(unit_cogs_estimate, 0)
    + COALESCE(unit_shipping_estimate, 0)
    + COALESCE(unit_platform_fee_estimate, 0)
  ) STORED,
  risk_score                 INT         CHECK (risk_score BETWEEN 1 AND 10),
  risk_notes                 TEXT,
  ai_narrative               TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_fulfillment_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own fulfillment estimates"
  ON public.campaign_fulfillment_estimates FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Owner inserts fulfillment estimate"
  ON public.campaign_fulfillment_estimates FOR INSERT
  WITH CHECK (auth.uid() = owner_id AND public.owns_campaign(campaign_id));

CREATE POLICY "Owner updates fulfillment estimate"
  ON public.campaign_fulfillment_estimates FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE TRIGGER campaign_fulfillment_estimates_updated_at
  BEFORE UPDATE ON public.campaign_fulfillment_estimates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_fulfillment_campaign
  ON public.campaign_fulfillment_estimates(campaign_id, created_at DESC);
