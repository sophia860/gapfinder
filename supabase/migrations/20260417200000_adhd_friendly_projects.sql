-- ADHD serial-starter friendly: park (rest) projects + AI session resume note.
-- Adds three nullable columns to projects so existing rows are unaffected.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS parked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resume_note TEXT,
  ADD COLUMN IF NOT EXISTS resume_note_updated_at TIMESTAMPTZ;

-- Index supports the common "active vs resting" split in the portfolio view.
CREATE INDEX IF NOT EXISTS idx_projects_user_parked
  ON public.projects(user_id, parked_at);
