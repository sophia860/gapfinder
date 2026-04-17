-- v2 RAG: pgvector + evidence snippets + match_evidence RPC.

CREATE EXTENSION IF NOT EXISTS vector;

-- One row per chunk of evidence retrieved from the wider web (Reddit, HN, …).
-- Embeddings are 1536-dim (OpenAI text-embedding-3-small).
CREATE TABLE public.evidence_snippets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source TEXT NOT NULL,                         -- 'reddit' | 'hackernews' | …
  url TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  embedding vector(1536),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.evidence_snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage evidence"
  ON public.evidence_snippets FOR ALL
  USING (public.owns_project(project_id))
  WITH CHECK (public.owns_project(project_id));
CREATE INDEX idx_evidence_project ON public.evidence_snippets(project_id, fetched_at DESC);
-- ivfflat index for cosine similarity search. `lists` = 100 is fine for the
-- small per-project corpora we expect; tune later if ingestion scales.
CREATE INDEX idx_evidence_embedding
  ON public.evidence_snippets
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Top-k cosine match for a single project. SECURITY DEFINER so it can read
-- through RLS, but it gates access via owns_project() to preserve isolation.
CREATE OR REPLACE FUNCTION public.match_evidence(
  query_embedding vector(1536),
  match_count INTEGER,
  filter_project UUID
)
RETURNS TABLE (
  id UUID,
  source TEXT,
  url TEXT,
  title TEXT,
  content TEXT,
  similarity REAL
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.owns_project(filter_project) THEN
    RAISE EXCEPTION 'not authorised for project %', filter_project USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.source,
    e.url,
    e.title,
    e.content,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM public.evidence_snippets e
  WHERE e.project_id = filter_project
    AND e.embedding IS NOT NULL
  ORDER BY e.embedding <=> query_embedding
  LIMIT GREATEST(match_count, 1);
END;
$$;
