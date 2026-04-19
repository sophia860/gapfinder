-- ============ ENUMS ============
do $$ begin create type public.swarm_status as enum ('idle','running','paused','done','failed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.swarm_agent_role as enum ('supervisor','researcher','coder','critic','executor','specialist'); exception when duplicate_object then null; end $$;
do $$ begin create type public.swarm_agent_status as enum ('idle','thinking','blocked','done','error'); exception when duplicate_object then null; end $$;
do $$ begin create type public.swarm_task_status as enum ('pending','in_progress','blocked','done','failed'); exception when duplicate_object then null; end $$;

-- ============ TABLES ============
create table if not exists public.swarms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  goal text not null,
  status public.swarm_status not null default 'idle',
  max_agents int not null default 10 check (max_agents between 1 and 50),
  model text not null default 'gpt-5-mini',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.swarm_agents (
  id uuid primary key default gen_random_uuid(),
  swarm_id uuid not null references public.swarms(id) on delete cascade,
  parent_agent_id uuid references public.swarm_agents(id) on delete set null,
  name text not null,
  role public.swarm_agent_role not null default 'specialist',
  system_prompt text not null,
  status public.swarm_agent_status not null default 'idle',
  tokens_used int not null default 0,
  steps_run int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists swarm_agents_swarm_idx on public.swarm_agents(swarm_id);

create table if not exists public.swarm_tasks (
  id uuid primary key default gen_random_uuid(),
  swarm_id uuid not null references public.swarms(id) on delete cascade,
  parent_task_id uuid references public.swarm_tasks(id) on delete set null,
  assigned_agent_id uuid references public.swarm_agents(id) on delete set null,
  title text not null,
  description text,
  status public.swarm_task_status not null default 'pending',
  priority int not null default 0,
  result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists swarm_tasks_swarm_status_idx on public.swarm_tasks(swarm_id, status);

create table if not exists public.swarm_messages (
  id uuid primary key default gen_random_uuid(),
  swarm_id uuid not null references public.swarms(id) on delete cascade,
  from_agent_id uuid references public.swarm_agents(id) on delete set null,
  to_agent_id uuid references public.swarm_agents(id) on delete set null,
  task_id uuid references public.swarm_tasks(id) on delete set null,
  content text not null,
  kind text not null default 'chat', -- chat | thought | tool_call | system
  created_at timestamptz not null default now()
);
create index if not exists swarm_messages_swarm_created_idx on public.swarm_messages(swarm_id, created_at desc);

-- ============ HELPER ============
create or replace function public.owns_swarm(_swarm_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.swarms where id = _swarm_id and user_id = auth.uid());
$$;

-- ============ TRIGGER ============
drop trigger if exists swarms_touch on public.swarms;
create trigger swarms_touch before update on public.swarms
for each row execute function public.update_updated_at_column();

drop trigger if exists swarm_tasks_touch on public.swarm_tasks;
create trigger swarm_tasks_touch before update on public.swarm_tasks
for each row execute function public.update_updated_at_column();

-- ============ RLS ============
alter table public.swarms enable row level security;
alter table public.swarm_agents enable row level security;
alter table public.swarm_tasks enable row level security;
alter table public.swarm_messages enable row level security;

drop policy if exists "Users manage own swarms" on public.swarms;
create policy "Users manage own swarms" on public.swarms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Owners manage agents" on public.swarm_agents;
create policy "Owners manage agents" on public.swarm_agents
  for all using (public.owns_swarm(swarm_id)) with check (public.owns_swarm(swarm_id));

drop policy if exists "Owners manage tasks" on public.swarm_tasks;
create policy "Owners manage tasks" on public.swarm_tasks
  for all using (public.owns_swarm(swarm_id)) with check (public.owns_swarm(swarm_id));

drop policy if exists "Owners manage messages" on public.swarm_messages;
create policy "Owners manage messages" on public.swarm_messages
  for all using (public.owns_swarm(swarm_id)) with check (public.owns_swarm(swarm_id));

-- ============ REALTIME ============
alter publication supabase_realtime add table public.swarms;
alter publication supabase_realtime add table public.swarm_agents;
alter publication supabase_realtime add table public.swarm_tasks;
alter publication supabase_realtime add table public.swarm_messages;