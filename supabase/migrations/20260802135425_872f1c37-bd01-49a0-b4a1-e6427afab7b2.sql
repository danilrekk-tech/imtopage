CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  device_id TEXT,
  source_image_url TEXT,
  title TEXT NOT NULL DEFAULT 'Без названия',
  status TEXT NOT NULL DEFAULT 'processing',
  generated_html TEXT,
  component_map JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own projects" ON public.projects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.generation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.generation_logs TO authenticated;
GRANT ALL ON public.generation_logs TO service_role;
ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own project logs" ON public.generation_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));

CREATE TABLE public.usage_counters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  day DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (subject, day)
);
GRANT ALL ON public.usage_counters TO service_role;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE INDEX projects_user_idx ON public.projects (user_id, created_at DESC);
CREATE INDEX projects_device_idx ON public.projects (device_id, created_at DESC);