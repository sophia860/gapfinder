ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS parked_at timestamptz;
ALTER TYPE public.reaction_kind ADD VALUE IF NOT EXISTS 'heart';