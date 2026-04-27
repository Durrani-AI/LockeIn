-- Categories and statuses
CREATE TYPE public.job_category AS ENUM ('finance', 'technology', 'law', 'graduate');
CREATE TYPE public.job_type AS ENUM ('internship', 'placement', 'graduate');
CREATE TYPE public.application_status AS ENUM ('saved', 'applying', 'applied', 'interviewing', 'offer', 'rejected');

-- Public jobs catalogue
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  role_title text NOT NULL,
  category public.job_category NOT NULL,
  job_type public.job_type NOT NULL,
  location text NOT NULL,
  deadline date,
  short_summary text NOT NULL,
  description text NOT NULL,
  requirements text,
  apply_url text,
  salary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_read_all_authenticated" ON public.jobs
  FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_jobs_category ON public.jobs(category);
CREATE INDEX idx_jobs_deadline ON public.jobs(deadline);

-- Saved jobs (user tracker)
CREATE TABLE public.saved_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  status public.application_status NOT NULL DEFAULT 'saved',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);

ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sj_select_own" ON public.saved_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sj_insert_own" ON public.saved_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sj_update_own" ON public.saved_jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sj_delete_own" ON public.saved_jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_saved_jobs_user ON public.saved_jobs(user_id);

-- CV tailoring advice (one row per analysis run)
CREATE TABLE public.cv_advice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  cv_id uuid NOT NULL,
  fit_score integer NOT NULL,
  summary text NOT NULL,
  strengths jsonb NOT NULL,
  gaps jsonb NOT NULL,
  edits jsonb NOT NULL,
  keywords_to_add jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cv_advice ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ca_select_own" ON public.cv_advice FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ca_insert_own" ON public.cv_advice FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ca_delete_own" ON public.cv_advice FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_cv_advice_user_job ON public.cv_advice(user_id, job_id);

-- Extend cover_letters: link to job and store tone overrides + extra context
ALTER TABLE public.cover_letters
  ADD COLUMN job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  ADD COLUMN tone_overrides jsonb,
  ADD COLUMN extra_context text;

CREATE INDEX idx_cover_letters_job ON public.cover_letters(job_id);

-- updated_at trigger for saved_jobs
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_saved_jobs_updated
  BEFORE UPDATE ON public.saved_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();