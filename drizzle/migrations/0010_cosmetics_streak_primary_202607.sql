CREATE OR REPLACE FUNCTION public.get_public_cosmetics(_user_ids uuid[])
RETURNS TABLE(user_id uuid, cosmetics jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ui.user_id, jsonb_object_agg(
    COALESCE(si.meta->>'equip_group', si.slug),
    jsonb_build_object(
      'slug', si.slug,
      'name', si.name,
      'category', si.category,
      'meta', si.meta
    )
  ) AS cosmetics
  FROM user_inventory ui
  JOIN store_items si ON si.slug = ui.item_slug
  WHERE ui.user_id = ANY(_user_ids)
    AND ui.equipped = true
    AND (ui.expires_at IS NULL OR ui.expires_at > now())
    AND COALESCE(si.category, '') <> 'consumable'
  GROUP BY ui.user_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_cosmetics(uuid[]) TO authenticated, anon;

CREATE TABLE IF NOT EXISTS public.streak_restores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restore_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, restore_date)
);
GRANT SELECT, INSERT ON public.streak_restores TO authenticated;
GRANT ALL ON public.streak_restores TO service_role;
ALTER TABLE public.streak_restores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own restores read" ON public.streak_restores FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own restores insert" ON public.streak_restores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.consume_streak_restore(_gap_date DATE)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid(); _q INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _gap_date IS NULL OR _gap_date > CURRENT_DATE THEN RAISE EXCEPTION 'Invalid date'; END IF;
  SELECT quantity INTO _q FROM user_inventory WHERE user_id = _uid AND item_slug = 'streak_restore' FOR UPDATE;
  IF _q IS NULL OR _q < 1 THEN RAISE EXCEPTION 'You do not own a Streak Restore'; END IF;
  UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = _uid AND item_slug = 'streak_restore';
  INSERT INTO streak_restores (user_id, restore_date) VALUES (_uid, _gap_date)
  ON CONFLICT DO NOTHING;
  INSERT INTO coin_transactions (user_id, amount, kind, reason, meta)
  VALUES (_uid, 0, 'consume', 'Used Streak Restore', jsonb_build_object('restore_date', _gap_date));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Add is_primary flag to ai_api_keys.
-- Enforces at most one primary key at any time via a partial unique index.

ALTER TABLE public.ai_api_keys
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_api_keys_one_primary
  ON public.ai_api_keys (is_primary)
  WHERE (is_primary = true);