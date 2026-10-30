-- Run this once in your Supabase SQL editor.
-- AI usage logs (one row per AI call) + global AI settings (IDE chatbot override).

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  feature text NOT NULL,
  provider text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  key_id uuid REFERENCES public.ai_api_keys(id) ON DELETE SET NULL,
  key_label text,
  status text NOT NULL DEFAULT 'ok', -- ok | rate_limited | invalid | error
  http_status int,
  prompt_tokens int NOT NULL DEFAULT 0,
  completion_tokens int NOT NULL DEFAULT 0,
  total_tokens int NOT NULL DEFAULT 0,
  latency_ms int,
  rate_limit_remaining_requests text,
  rate_limit_remaining_tokens text,
  error text
);

GRANT SELECT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read AI usage logs" ON public.ai_usage_logs;
CREATE POLICY "Admins can read AI usage logs"
  ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON public.ai_usage_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user ON public.ai_usage_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_feature ON public.ai_usage_logs (feature, created_at DESC);

-- Singleton global settings row (service_role only; read/written by edge functions)
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  ide_use_primary boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT ALL ON public.ai_settings TO service_role;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.ai_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
