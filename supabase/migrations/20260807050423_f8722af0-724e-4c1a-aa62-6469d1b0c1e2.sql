ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS share_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS share_visibility text NOT NULL DEFAULT 'private';

CREATE TABLE IF NOT EXISTS public.project_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, email)
);

GRANT SELECT ON public.project_shares TO authenticated;
GRANT ALL ON public.project_shares TO service_role;

ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read shares of own projects"
ON public.project_shares FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_shares.project_id AND p.user_id = auth.uid()));