-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CVs
CREATE TABLE public.cvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  extracted_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cvs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cvs_select_own" ON public.cvs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cvs_insert_own" ON public.cvs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cvs_update_own" ON public.cvs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cvs_delete_own" ON public.cvs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX cvs_user_id_idx ON public.cvs(user_id);

-- Communication profile (one per user)
CREATE TABLE public.communication_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  directness INT NOT NULL,
  formality INT NOT NULL,
  confidence INT NOT NULL,
  detail_level INT NOT NULL,
  warmth INT NOT NULL,
  energy INT NOT NULL,
  values_text TEXT,
  voice_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.communication_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comm_select_own" ON public.communication_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "comm_insert_own" ON public.communication_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comm_update_own" ON public.communication_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "comm_delete_own" ON public.communication_profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Cover letters
CREATE TABLE public.cover_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cv_id UUID REFERENCES public.cvs(id) ON DELETE SET NULL,
  job_title TEXT NOT NULL,
  company TEXT NOT NULL,
  job_description TEXT NOT NULL,
  content TEXT NOT NULL,
  match_analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cover_letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cl_select_own" ON public.cover_letters FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cl_insert_own" ON public.cover_letters FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cl_update_own" ON public.cover_letters FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cl_delete_own" ON public.cover_letters FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX cover_letters_user_id_idx ON public.cover_letters(user_id);
CREATE INDEX cover_letters_created_idx ON public.cover_letters(user_id, created_at DESC);

-- Storage bucket for CVs (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('cvs', 'cvs', false);

-- Storage policies (user folder pattern: {user_id}/file.pdf)
CREATE POLICY "cvs_storage_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "cvs_storage_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "cvs_storage_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]);