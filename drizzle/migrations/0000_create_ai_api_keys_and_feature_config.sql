CREATE TABLE public.ai_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  provider text NOT NULL DEFAULT 'groq',
  base_url text NOT NULL DEFAULT 'https://api.groq.com/openai/v1',
  api_key text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active',
  last_error text,
  usage_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_feature_config (
  feature_key text PRIMARY KEY,
  model text NOT NULL DEFAULT '',
  key_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Keys are secret: only backend functions (service_role) may read them.
-- No policies and no grants to anon/authenticated.
ALTER TABLE public.ai_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feature_config ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.ai_api_keys TO service_role;
GRANT ALL ON public.ai_feature_config TO service_role;

CREATE TRIGGER ai_api_keys_updated_at
  BEFORE UPDATE ON public.ai_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER ai_feature_config_updated_at
  BEFORE UPDATE ON public.ai_feature_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
