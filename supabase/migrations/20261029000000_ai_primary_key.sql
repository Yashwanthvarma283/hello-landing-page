
-- Add is_primary flag to ai_api_keys.
-- Enforces at most one primary key at any time via a partial unique index.

ALTER TABLE public.ai_api_keys
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

-- Only one row can have is_primary = true at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_api_keys_one_primary
  ON public.ai_api_keys (is_primary)
  WHERE (is_primary = true);
