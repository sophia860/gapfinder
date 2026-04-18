-- supabase/migrations/20260418_dashboard.sql
--
-- Truara Founder Command Center — schema + strict RLS.
--
-- Design principles:
--   * Private-by-default. Every table has RLS enabled and owner-only policies
--     keyed on auth.uid() = user_id. No `using (true)` shortcuts.
--   * Append-only longitudinal memory (metric snapshots, interactions) — the
--     dashboard "remembers" the founder across months/years without ever
--     mutating history.
--   * Defaults + triggers prevent accidental cross-user writes
--     (user_id auto-fills from auth.uid(), and is immutable on update).
--   * LangGraph PostgresSaver tables live alongside the app schema so a single
--     Supabase project owns all founder data — the moat.
--
-- Order: extensions → helpers → tables → indexes → triggers → policies → seed.

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- Helper: updated_at bump
-- -------------------------------------------------------------------------
create or replace function public.tg_dashboard_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Helper: lock user_id immutability (defence-in-depth on top of RLS).
create or replace function public.tg_dashboard_lock_user_id()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id is immutable';
  end if;
  return new;
end;
$$;

-- Helper: default user_id to current auth.uid() when omitted.
create or replace function public.tg_dashboard_default_user_id()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

-- =========================================================================
-- 1. dashboard_widgets — catalog (read-only to authed users)
-- =========================================================================
create table if not exists public.dashboard_widgets (
  id              text primary key,
  title           text not null,
  description     text not null,
  category        text not null check (category in (
                    'metric', 'chart', 'feed', 'ai', 'focus', 'system'
                  )),
  default_size    jsonb not null default '{"w":4,"h":3}'::jsonb,
  min_size        jsonb not null default '{"w":2,"h":2}'::jsonb,
  config_schema   jsonb not null default '{}'::jsonb,
  is_premium      boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.dashboard_widgets enable row level security;

create policy "dashboard_widgets_select_authed"
  on public.dashboard_widgets
  for select
  to authenticated
  using (true);

-- No insert/update/delete policies → catalog is service-role-only.

-- =========================================================================
-- 2. dashboard_layouts — current per-user widget grid
-- =========================================================================
create table if not exists public.dashboard_layouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  version      integer not null default 1,
  widgets      jsonb not null default '[]'::jsonb,
  ai_suggested boolean not null default false,
  source       text not null default 'user' check (source in ('user','graph','default')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id)
);

alter table public.dashboard_layouts enable row level security;

create index if not exists idx_dashboard_layouts_user
  on public.dashboard_layouts(user_id);

create trigger trg_dashboard_layouts_default_user
  before insert on public.dashboard_layouts
  for each row execute function public.tg_dashboard_default_user_id();

create trigger trg_dashboard_layouts_updated_at
  before update on public.dashboard_layouts
  for each row execute function public.tg_dashboard_set_updated_at();

create trigger trg_dashboard_layouts_lock_user_id
  before update on public.dashboard_layouts
  for each row execute function public.tg_dashboard_lock_user_id();

create policy "dashboard_layouts_select_own"
  on public.dashboard_layouts for select to authenticated
  using (auth.uid() = user_id);

create policy "dashboard_layouts_insert_own"
  on public.dashboard_layouts for insert to authenticated
  with check (auth.uid() = user_id);

create policy "dashboard_layouts_update_own"
  on public.dashboard_layouts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "dashboard_layouts_delete_own"
  on public.dashboard_layouts for delete to authenticated
  using (auth.uid() = user_id);

-- =========================================================================
-- 3. dashboard_layout_history — every accepted/rejected layout change
-- =========================================================================
create table if not exists public.dashboard_layout_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  version      integer not null,
  widgets      jsonb not null,
  source       text not null check (source in ('user','graph','default')),
  accepted     boolean not null default true,
  reason       text,
  captured_at  timestamptz not null default now()
);

alter table public.dashboard_layout_history enable row level security;

create index if not exists idx_dashboard_layout_history_user_time
  on public.dashboard_layout_history(user_id, captured_at desc);

create trigger trg_dashboard_layout_history_default_user
  before insert on public.dashboard_layout_history
  for each row execute function public.tg_dashboard_default_user_id();

create policy "dashboard_layout_history_select_own"
  on public.dashboard_layout_history for select to authenticated
  using (auth.uid() = user_id);

create policy "dashboard_layout_history_insert_own"
  on public.dashboard_layout_history for insert to authenticated
  with check (auth.uid() = user_id);

-- History is append-only by design — no update/delete policies.

-- =========================================================================
-- 4. dashboard_metric_snapshots — append-only longitudinal time-series
-- =========================================================================
create table if not exists public.dashboard_metric_snapshots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  metric_key   text not null,
  value        numeric not null,
  unit         text,
  dims         jsonb not null default '{}'::jsonb,
  source       text not null default 'user' check (source in (
                 'user','agent','swarm','integration','graph'
               )),
  captured_at  timestamptz not null default now()
);

alter table public.dashboard_metric_snapshots enable row level security;

create index if not exists idx_dashboard_metrics_user_key_time
  on public.dashboard_metric_snapshots(user_id, metric_key, captured_at desc);

create index if not exists idx_dashboard_metrics_dims
  on public.dashboard_metric_snapshots using gin (dims);

create trigger trg_dashboard_metrics_default_user
  before insert on public.dashboard_metric_snapshots
  for each row execute function public.tg_dashboard_default_user_id();

create policy "dashboard_metrics_select_own"
  on public.dashboard_metric_snapshots for select to authenticated
  using (auth.uid() = user_id);

create policy "dashboard_metrics_insert_own"
  on public.dashboard_metric_snapshots for insert to authenticated
  with check (auth.uid() = user_id);

-- Append-only: no update/delete policies.

-- =========================================================================
-- 5. dashboard_interactions — founder data flywheel
-- =========================================================================
create table if not exists public.dashboard_interactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in (
                 'view','hover','dwell','drag','resize',
                 'open','dismiss','accept','nl_query',
                 'focus_enter','focus_exit','digest_open'
               )),
  target       text,                       -- widget id, insight id, etc.
  payload      jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now()
);

alter table public.dashboard_interactions enable row level security;

create index if not exists idx_dashboard_interactions_user_time
  on public.dashboard_interactions(user_id, occurred_at desc);

create index if not exists idx_dashboard_interactions_kind
  on public.dashboard_interactions(user_id, kind, occurred_at desc);

create trigger trg_dashboard_interactions_default_user
  before insert on public.dashboard_interactions
  for each row execute function public.tg_dashboard_default_user_id();

create policy "dashboard_interactions_select_own"
  on public.dashboard_interactions for select to authenticated
  using (auth.uid() = user_id);

create policy "dashboard_interactions_insert_own"
  on public.dashboard_interactions for insert to authenticated
  with check (auth.uid() = user_id);

-- =========================================================================
-- 6. dashboard_insights — proactive ambient insights (calm, not noisy)
-- =========================================================================
create table if not exists public.dashboard_insights (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  kind              text not null,                 -- e.g. 'trend','anomaly','nudge'
  severity          text not null default 'calm'
                      check (severity in ('calm','notable','urgent')),
  title             text not null,
  body              text not null,
  related_metrics   text[] not null default '{}',
  related_widget    text,
  usefulness_score  numeric not null default 0.5,  -- 0..1, predicted value
  surfaced_at       timestamptz not null default now(),
  dismissed_at      timestamptz,
  marked_useful_at  timestamptz,
  source            text not null default 'graph'
                      check (source in ('graph','swarm','rule','user')),
  context           jsonb not null default '{}'::jsonb,
  updated_at        timestamptz not null default now()
);

alter table public.dashboard_insights enable row level security;

create index if not exists idx_dashboard_insights_user_active
  on public.dashboard_insights(user_id, dismissed_at, usefulness_score desc, surfaced_at desc);

create trigger trg_dashboard_insights_default_user
  before insert on public.dashboard_insights
  for each row execute function public.tg_dashboard_default_user_id();

create trigger trg_dashboard_insights_updated_at
  before update on public.dashboard_insights
  for each row execute function public.tg_dashboard_set_updated_at();

create trigger trg_dashboard_insights_lock_user_id
  before update on public.dashboard_insights
  for each row execute function public.tg_dashboard_lock_user_id();

create policy "dashboard_insights_select_own"
  on public.dashboard_insights for select to authenticated
  using (auth.uid() = user_id);

create policy "dashboard_insights_insert_own"
  on public.dashboard_insights for insert to authenticated
  with check (auth.uid() = user_id);

create policy "dashboard_insights_update_own"
  on public.dashboard_insights for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "dashboard_insights_delete_own"
  on public.dashboard_insights for delete to authenticated
  using (auth.uid() = user_id);

-- =========================================================================
-- 7. dashboard_swarm_runs + dashboard_swarm_critiques
--    Synthetic stakeholder feedback loops.
-- =========================================================================
create table if not exists public.dashboard_swarm_runs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  scope        text not null,             -- 'dashboard','widget:<id>','insight:<id>',...
  personas     jsonb not null default '[]'::jsonb,
  status       text not null default 'queued'
                 check (status in ('queued','running','complete','error')),
  summary      text,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  error        text
);

alter table public.dashboard_swarm_runs enable row level security;

create index if not exists idx_dashboard_swarm_runs_user_time
  on public.dashboard_swarm_runs(user_id, started_at desc);

create trigger trg_dashboard_swarm_runs_default_user
  before insert on public.dashboard_swarm_runs
  for each row execute function public.tg_dashboard_default_user_id();

create policy "dashboard_swarm_runs_select_own"
  on public.dashboard_swarm_runs for select to authenticated
  using (auth.uid() = user_id);

create policy "dashboard_swarm_runs_insert_own"
  on public.dashboard_swarm_runs for insert to authenticated
  with check (auth.uid() = user_id);

create policy "dashboard_swarm_runs_update_own"
  on public.dashboard_swarm_runs for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.dashboard_swarm_critiques (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null references public.dashboard_swarm_runs(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  persona       text not null,           -- 'early_customer','skeptical_investor',...
  target_kind   text not null check (target_kind in ('widget','insight','metric','layout','dashboard')),
  target_ref    text,
  reaction      text not null,
  refinement    jsonb not null default '{}'::jsonb,
  confidence    numeric not null default 0.5,
  created_at    timestamptz not null default now()
);

alter table public.dashboard_swarm_critiques enable row level security;

create index if not exists idx_dashboard_swarm_critiques_run
  on public.dashboard_swarm_critiques(run_id);

create index if not exists idx_dashboard_swarm_critiques_user
  on public.dashboard_swarm_critiques(user_id, created_at desc);

create trigger trg_dashboard_swarm_critiques_default_user
  before insert on public.dashboard_swarm_critiques
  for each row execute function public.tg_dashboard_default_user_id();

create policy "dashboard_swarm_critiques_select_own"
  on public.dashboard_swarm_critiques for select to authenticated
  using (auth.uid() = user_id);

create policy "dashboard_swarm_critiques_insert_own"
  on public.dashboard_swarm_critiques for insert to authenticated
  with check (auth.uid() = user_id);

-- =========================================================================
-- 8. dashboard_nl_queries — NL → widget spec (powers the moat)
-- =========================================================================
create table if not exists public.dashboard_nl_queries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  prompt        text not null,
  intent        jsonb not null default '{}'::jsonb,
  widget_spec   jsonb,
  narrative     text,
  outcome       text not null default 'pending'
                  check (outcome in ('pending','kept','discarded','iterated')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

alter table public.dashboard_nl_queries enable row level security;

create index if not exists idx_dashboard_nl_queries_user_time
  on public.dashboard_nl_queries(user_id, created_at desc);

create trigger trg_dashboard_nl_queries_default_user
  before insert on public.dashboard_nl_queries
  for each row execute function public.tg_dashboard_default_user_id();

create policy "dashboard_nl_queries_select_own"
  on public.dashboard_nl_queries for select to authenticated
  using (auth.uid() = user_id);

create policy "dashboard_nl_queries_insert_own"
  on public.dashboard_nl_queries for insert to authenticated
  with check (auth.uid() = user_id);

create policy "dashboard_nl_queries_update_own"
  on public.dashboard_nl_queries for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================================
-- 9. dashboard_focus_sessions — focus mode + digest delivery log
-- =========================================================================
create table if not exists public.dashboard_focus_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  mode          text not null check (mode in ('focus','daily_digest','weekly_digest')),
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  digest_payload jsonb,
  notes         text
);

alter table public.dashboard_focus_sessions enable row level security;

create index if not exists idx_dashboard_focus_user_time
  on public.dashboard_focus_sessions(user_id, started_at desc);

create trigger trg_dashboard_focus_default_user
  before insert on public.dashboard_focus_sessions
  for each row execute function public.tg_dashboard_default_user_id();

create policy "dashboard_focus_select_own"
  on public.dashboard_focus_sessions for select to authenticated
  using (auth.uid() = user_id);

create policy "dashboard_focus_insert_own"
  on public.dashboard_focus_sessions for insert to authenticated
  with check (auth.uid() = user_id);

create policy "dashboard_focus_update_own"
  on public.dashboard_focus_sessions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================================
-- 10. LangGraph PostgresSaver checkpoint tables
--     Schema mirrors @langchain/langgraph-checkpoint-postgres expectations.
--     thread_id convention: 'dashboard:' || user_id (see dashboard-graph.ts).
--     RLS enforces that a thread_id must match the caller's own user.
--     The graph runtime uses the service role and bypasses RLS, but RLS still
--     protects the data if a user JWT ever hits these tables directly.
-- =========================================================================
create table if not exists public.langgraph_checkpoints (
  thread_id        text    not null,
  checkpoint_ns    text    not null default '',
  checkpoint_id    text    not null,
  parent_checkpoint_id text,
  type             text,
  checkpoint       jsonb   not null,
  metadata         jsonb   not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  primary key (thread_id, checkpoint_ns, checkpoint_id)
);

create index if not exists idx_langgraph_checkpoints_thread
  on public.langgraph_checkpoints(thread_id, checkpoint_ns, created_at desc);

create table if not exists public.langgraph_checkpoint_writes (
  thread_id     text    not null,
  checkpoint_ns text    not null default '',
  checkpoint_id text    not null,
  task_id       text    not null,
  idx           integer not null,
  channel       text    not null,
  type          text,
  value         jsonb,
  created_at    timestamptz not null default now(),
  primary key (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);

create table if not exists public.langgraph_checkpoint_blobs (
  thread_id     text    not null,
  checkpoint_ns text    not null default '',
  channel       text    not null,
  version       text    not null,
  type          text,
  blob          bytea,
  created_at    timestamptz not null default now(),
  primary key (thread_id, checkpoint_ns, channel, version)
);

alter table public.langgraph_checkpoints       enable row level security;
alter table public.langgraph_checkpoint_writes enable row level security;
alter table public.langgraph_checkpoint_blobs  enable row level security;

-- Owner check: thread_id must equal 'dashboard:' || auth.uid().
-- This is the only convention the dashboard graph uses; other graphs would
-- add their own policies under their own thread_id namespace.
create policy "langgraph_checkpoints_select_own_thread"
  on public.langgraph_checkpoints for select to authenticated
  using (thread_id = 'dashboard:' || auth.uid()::text);

create policy "langgraph_checkpoint_writes_select_own_thread"
  on public.langgraph_checkpoint_writes for select to authenticated
  using (thread_id = 'dashboard:' || auth.uid()::text);

create policy "langgraph_checkpoint_blobs_select_own_thread"
  on public.langgraph_checkpoint_blobs for select to authenticated
  using (thread_id = 'dashboard:' || auth.uid()::text);

-- No insert/update/delete policies for authenticated role — only the
-- service-role (graph runtime) writes here, by design.

-- =========================================================================
-- Seed: built-in widget catalog
-- =========================================================================
insert into public.dashboard_widgets (id, title, description, category, default_size)
values
  ('revenue_trend',    'Revenue trend',    'Daily/weekly revenue over time.',                      'chart',  '{"w":6,"h":3}'),
  ('churn',            'Churn',            'Customer churn rate with calm context.',               'chart',  '{"w":3,"h":3}'),
  ('velocity',         'Velocity',         'Shipping cadence — solo-founder edition.',             'metric', '{"w":3,"h":2}'),
  ('burndown',         'Burndown',         'Burndown for the current cycle.',                      'chart',  '{"w":4,"h":3}'),
  ('cycle_time',       'Cycle time',       'Median issue cycle time, last 30 days.',               'metric', '{"w":3,"h":2}'),
  ('agent_activity',   'Agent activity',   'Quiet stream of background agent actions.',            'feed',   '{"w":4,"h":4}'),
  ('ai_copilot',       'AI copilot',       'Ambient copilot pane for instant deep dives.',         'ai',     '{"w":4,"h":6}'),
  ('proactive_strip',  'Proactive insight','One calm insight at a time, never spammy.',            'ai',     '{"w":12,"h":1}'),
  ('focus_digest',     'Focus digest',     'Today / this-week digest in place of monitoring.',     'focus',  '{"w":4,"h":3}'),
  ('founder_mood',     'Founder mood',     'Optional weekly check-in trend (private to you).',     'metric', '{"w":3,"h":2}')
on conflict (id) do nothing;
