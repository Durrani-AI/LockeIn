ALTER TABLE public.jobs
  ADD COLUMN external_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN external_id text,
  ADD COLUMN posted_at timestamptz,
  ADD COLUMN source_payload jsonb;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_external_source_external_id_key UNIQUE (external_source, external_id);

CREATE INDEX idx_jobs_external_source ON public.jobs(external_source);
CREATE INDEX idx_jobs_external_id ON public.jobs(external_id);
CREATE INDEX idx_jobs_posted_at ON public.jobs(posted_at DESC);
