CREATE TABLE public.generation_cache (
  image_hash text PRIMARY KEY,
  result text NOT NULL,
  analysis text,
  provider text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.generation_cache TO service_role;
ALTER TABLE public.generation_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rate_limit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX rate_limit_events_subject_created_idx ON public.rate_limit_events (subject, created_at DESC);
GRANT ALL ON public.rate_limit_events TO service_role;
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;