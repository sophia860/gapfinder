-- ============================================================
-- Founder Mirror: tables, RLS, triggers
-- ============================================================

-- 1. founder_mirrors: one row per user, holds the living genome
CREATE TABLE public.founder_mirrors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  genome jsonb NOT NULL DEFAULT jsonb_build_object(
    'decision_style', null,
    'risk_appetite', 0.5,
    'core_values', '[]'::jsonb,
    'energy_pattern', null,
    'strengths', '[]'::jsonb,
    'blind_spots', '[]'::jsonb,
    'past_outcomes', '[]'::jsonb,
    'narrative', null,
    'confidence', 0
  ),
  signal_count integer NOT NULL DEFAULT 0,
  last_synthesized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.founder_mirrors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own mirror" ON public.founder_mirrors
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own mirror" ON public.founder_mirrors
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own mirror" ON public.founder_mirrors
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER founder_mirrors_updated_at
  BEFORE UPDATE ON public.founder_mirrors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. founder_mirror_signals: queue of events to fold into the genome
CREATE TABLE public.founder_mirror_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid,
  kind text NOT NULL,        -- 'chat' | 'simulation' | 'task_done' | 'outcome' | 'gap_selected'
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX founder_mirror_signals_unprocessed_idx
  ON public.founder_mirror_signals (user_id, created_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.founder_mirror_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own signals" ON public.founder_mirror_signals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own signals" ON public.founder_mirror_signals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Helper: get-or-create the caller's mirror row
CREATE OR REPLACE FUNCTION public.get_or_create_founder_mirror()
RETURNS public.founder_mirrors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  row public.founder_mirrors;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO row FROM public.founder_mirrors WHERE user_id = uid;
  IF NOT FOUND THEN
    INSERT INTO public.founder_mirrors (user_id) VALUES (uid)
    RETURNING * INTO row;
  END IF;
  RETURN row;
END;
$$;

-- 4. Triggers to enqueue signals from existing tables
-- Helper: resolve project owner once
CREATE OR REPLACE FUNCTION public._project_owner(_project_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT user_id FROM public.projects WHERE id = _project_id $$;

-- chat_messages: only user-authored
CREATE OR REPLACE FUNCTION public._enqueue_signal_from_chat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  IF NEW.role <> 'user' THEN RETURN NEW; END IF;
  owner := public._project_owner(NEW.project_id);
  IF owner IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.founder_mirror_signals (user_id, project_id, kind, payload)
  VALUES (owner, NEW.project_id, 'chat',
          jsonb_build_object('content', left(NEW.content, 600)));
  RETURN NEW;
END $$;

CREATE TRIGGER chat_messages_to_mirror
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public._enqueue_signal_from_chat();

-- simulations: every new run
CREATE OR REPLACE FUNCTION public._enqueue_signal_from_simulation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  owner := public._project_owner(NEW.project_id);
  IF owner IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.founder_mirror_signals (user_id, project_id, kind, payload)
  VALUES (owner, NEW.project_id, 'simulation',
          jsonb_build_object(
            'idea', NEW.idea, 'persona', NEW.persona,
            'verdict', NEW.verdict, 'recommendation', NEW.recommendation
          ));
  RETURN NEW;
END $$;

CREATE TRIGGER simulations_to_mirror
  AFTER INSERT ON public.simulations
  FOR EACH ROW EXECUTE FUNCTION public._enqueue_signal_from_simulation();

-- tasks: when moved into 'done'
CREATE OR REPLACE FUNCTION public._enqueue_signal_from_task()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  IF NEW.column_name <> 'done' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.column_name = 'done' THEN RETURN NEW; END IF;
  owner := public._project_owner(NEW.project_id);
  IF owner IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.founder_mirror_signals (user_id, project_id, kind, payload)
  VALUES (owner, NEW.project_id, 'task_done',
          jsonb_build_object('title', NEW.title, 'notes', left(coalesce(NEW.notes,''), 400)));
  RETURN NEW;
END $$;

CREATE TRIGGER tasks_done_to_mirror
  AFTER INSERT OR UPDATE OF column_name ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public._enqueue_signal_from_task();

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.founder_mirrors;