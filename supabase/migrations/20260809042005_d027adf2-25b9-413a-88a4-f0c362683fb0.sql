CREATE TABLE public.ai_provider_health (
  provider text PRIMARY KEY,
  status text NOT NULL DEFAULT 'unknown',
  model text,
  latency_ms integer,
  error text,
  checked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_provider_health TO anon;
GRANT SELECT ON public.ai_provider_health TO authenticated;
GRANT ALL ON public.ai_provider_health TO service_role;
ALTER TABLE public.ai_provider_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Health status is readable by everyone" ON public.ai_provider_health FOR SELECT USING (true);