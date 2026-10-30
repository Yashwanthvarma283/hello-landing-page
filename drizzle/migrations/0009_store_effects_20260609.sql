-- 1. Extend existing store items with metadata (duration + equip category)
UPDATE public.store_items SET meta = jsonb_build_object('duration_days', 7, 'equip_group', 'theme', 'theme_class', 'theme-dracula') WHERE slug = 'theme_dracula';
UPDATE public.store_items SET meta = jsonb_build_object('duration_days', 7, 'equip_group', 'theme', 'theme_class', 'theme-midnight') WHERE slug = 'theme_midnight';
UPDATE public.store_items SET meta = jsonb_build_object('duration_days', 7, 'equip_group', 'theme', 'theme_class', 'theme-solarized') WHERE slug = 'theme_solarized';
UPDATE public.store_items SET meta = jsonb_build_object('duration_days', 7, 'equip_group', 'console_colors') WHERE slug = 'console_colors';
UPDATE public.store_items SET meta = jsonb_build_object('duration_days', 7, 'equip_group', 'banner') WHERE slug = 'avatar_banner';
UPDATE public.store_items SET meta = jsonb_build_object('duration_days', 7, 'equip_group', 'name_glow') WHERE slug = 'name_glow';
UPDATE public.store_items SET meta = jsonb_build_object('duration_days', 7, 'equip_group', 'avatar_frame', 'frame_class', 'frame-animated') WHERE slug = 'avatar_frame_animated';
UPDATE public.store_items SET meta = jsonb_build_object('duration_days', 7, 'equip_group', 'submission_effect') WHERE slug = 'submission_confetti';
UPDATE public.store_items SET meta = jsonb_build_object('duration_hours', 24, 'equip_group', 'xp_boost', 'multiplier', 2) WHERE slug = 'xp_boost_24h';
UPDATE public.store_items SET meta = jsonb_build_object('duration_hours', 48, 'equip_group', 'streak_freeze') WHERE slug = 'streak_freeze';
UPDATE public.store_items SET meta = jsonb_build_object('consumable', true, 'equip_group', 'extra_hint', 'uses', 1) WHERE slug = 'extra_hint_slot';

-- 2. Five new store items
INSERT INTO public.store_items (slug, name, description, category, price, icon, enabled, sort_order, meta) VALUES
  ('theme_neon_sunset', 'Theme: Neon Sunset', 'Vibrant pink & orange editor theme. Active 7 days.', 'theme', 300, '🌅', true, 20, jsonb_build_object('duration_days', 7, 'equip_group', 'theme', 'theme_class', 'theme-neon-sunset')),
  ('theme_oceanic', 'Theme: Oceanic', 'Deep blue calm editor theme. Active 7 days.', 'theme', 300, '🌊', true, 21, jsonb_build_object('duration_days', 7, 'equip_group', 'theme', 'theme_class', 'theme-oceanic')),
  ('avatar_frame_gold', 'Gold Avatar Frame', 'Premium gold frame around your avatar. Active 7 days.', 'cosmetic', 500, '🏆', true, 22, jsonb_build_object('duration_days', 7, 'equip_group', 'avatar_frame', 'frame_class', 'frame-gold')),
  ('profile_title_pro', 'PRO Profile Title', 'Shows a PRO badge next to your username. Active 7 days.', 'cosmetic', 350, '⭐', true, 23, jsonb_build_object('duration_days', 7, 'equip_group', 'profile_title', 'label', 'PRO')),
  ('leaderboard_avatar_pulse', 'Avatar Pulse', 'Pulsing aura on leaderboard. Active 7 days.', 'cosmetic', 300, '💫', true, 24, jsonb_build_object('duration_days', 7, 'equip_group', 'avatar_pulse'))
ON CONFLICT (slug) DO NOTHING;

-- 3. Seven new coin-earning rules
INSERT INTO public.coin_reward_rules (key, label, description, amount, enabled, per_day_limit) VALUES
  ('problem_solved_easy', 'Easy Problem Solved', 'Earn coins for solving an easy problem', 10, true, NULL),
  ('problem_solved_medium', 'Medium Problem Solved', 'Earn coins for solving a medium problem', 20, true, NULL),
  ('problem_solved_hard', 'Hard Problem Solved', 'Earn coins for solving a hard problem', 35, true, NULL),
  ('notes_saved', 'Notes Saved', 'Earn coins for writing problem notes', 5, true, 5),
  ('solution_shared', 'Solution Shared', 'Earn coins for sharing your solution', 15, true, NULL),
  ('perfect_score', 'Perfect Score', 'All test cases passed on first try', 25, true, NULL),
  ('daily_login', 'Daily Login', 'Show up every day', 10, true, 1)
ON CONFLICT (key) DO NOTHING;

-- 4. Equip / unequip helpers

CREATE OR REPLACE FUNCTION public.equip_item(_item_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _item RECORD;
  _inv RECORD;
  _group TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _item FROM store_items WHERE slug = _item_slug;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  SELECT * INTO _inv FROM user_inventory WHERE user_id = _uid AND item_slug = _item_slug;
  IF NOT FOUND THEN RAISE EXCEPTION 'You do not own this item'; END IF;
  IF _inv.expires_at IS NOT NULL AND _inv.expires_at < now() THEN
    RAISE EXCEPTION 'This item has expired. Please buy again.';
  END IF;
  _group := COALESCE(_item.meta->>'equip_group', _item.slug);

  UPDATE user_inventory ui
  SET equipped = false
  FROM store_items si
  WHERE ui.user_id = _uid
    AND ui.item_slug = si.slug
    AND COALESCE(si.meta->>'equip_group', si.slug) = _group
    AND ui.item_slug <> _item_slug;

  UPDATE user_inventory SET equipped = true WHERE user_id = _uid AND item_slug = _item_slug;
  RETURN jsonb_build_object('ok', true, 'group', _group, 'expires_at', _inv.expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.unequip_item(_item_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE user_inventory SET equipped = false WHERE user_id = _uid AND item_slug = _item_slug;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Returns all currently active (owned + not expired) items with metadata, equipped flag
CREATE OR REPLACE FUNCTION public.get_active_effects(_user_id UUID)
RETURNS TABLE(
  item_slug TEXT,
  category TEXT,
  equipped BOOLEAN,
  expires_at TIMESTAMPTZ,
  meta JSONB,
  name TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ui.item_slug, si.category, ui.equipped, ui.expires_at, si.meta, si.name
  FROM user_inventory ui
  JOIN store_items si ON si.slug = ui.item_slug
  WHERE ui.user_id = _user_id
    AND (ui.expires_at IS NULL OR ui.expires_at > now())
    AND ui.quantity > 0;
$$;

-- Consume one use of extra_hint (decrements quantity)
CREATE OR REPLACE FUNCTION public.consume_extra_hint()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid UUID := auth.uid(); _q INT;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  SELECT quantity INTO _q FROM user_inventory WHERE user_id = _uid AND item_slug = 'extra_hint_slot' FOR UPDATE;
  IF _q IS NULL OR _q < 1 THEN RETURN false; END IF;
  UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = _uid AND item_slug = 'extra_hint_slot';
  INSERT INTO coin_transactions (user_id, amount, kind, reason, meta)
  VALUES (_uid, 0, 'consume', 'Used extra hint', '{}'::jsonb);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_active_streak_freeze(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM user_inventory
    WHERE user_id = _user_id AND item_slug = 'streak_freeze'
      AND equipped = true AND expires_at > now()
  );
$$;

-- 5. Update purchase_item to honor duration + multi-buy
CREATE OR REPLACE FUNCTION public.purchase_item(_item_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _item RECORD;
  _bal INT;
  _days INT;
  _hours INT;
  _new_expiry TIMESTAMPTZ;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _item FROM store_items WHERE slug = _item_slug AND enabled = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not available'; END IF;

  SELECT balance INTO _bal FROM user_coins WHERE user_id = _uid FOR UPDATE;
  IF _bal IS NULL OR _bal < _item.price THEN RAISE EXCEPTION 'Insufficient coins'; END IF;

  UPDATE user_coins
  SET balance = balance - _item.price,
      lifetime_spent = lifetime_spent + _item.price,
      updated_at = now()
  WHERE user_id = _uid;

  _days := NULLIF(_item.meta->>'duration_days','')::INT;
  _hours := NULLIF(_item.meta->>'duration_hours','')::INT;
  IF _days IS NOT NULL THEN
    _new_expiry := now() + (_days || ' days')::INTERVAL;
  ELSIF _hours IS NOT NULL THEN
    _new_expiry := now() + (_hours || ' hours')::INTERVAL;
  ELSE
    _new_expiry := NULL;
  END IF;

  INSERT INTO user_inventory (user_id, item_slug, quantity, expires_at, acquired_at)
  VALUES (_uid, _item_slug, 1, _new_expiry, now())
  ON CONFLICT (user_id, item_slug) DO UPDATE SET
    quantity = user_inventory.quantity + 1,
    expires_at = CASE
      WHEN _new_expiry IS NULL THEN user_inventory.expires_at
      WHEN user_inventory.expires_at IS NULL OR user_inventory.expires_at < now() THEN _new_expiry
      ELSE user_inventory.expires_at + (_new_expiry - now())
    END,
    acquired_at = now();

  INSERT INTO coin_transactions (user_id, amount, kind, reason, meta)
  VALUES (_uid, -_item.price, 'spend', 'Purchase: ' || _item.name, jsonb_build_object('item_slug', _item_slug));

  RETURN jsonb_build_object('ok', true, 'remaining', _bal - _item.price, 'expires_at', _new_expiry);
END;
$$;

-- 6. award_coins with XP boost multiplier (2x if xp_boost_24h equipped & active)
CREATE OR REPLACE FUNCTION public.award_coins(_user_id UUID, _rule_key TEXT, _claim_key TEXT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _rule RECORD;
  _claim TEXT;
  _amount INT;
  _boost BOOLEAN;
  _mult INT := 1;
BEGIN
  SELECT * INTO _rule FROM coin_reward_rules WHERE key = _rule_key AND enabled = true;
  IF NOT FOUND THEN RETURN 0; END IF;

  _claim := COALESCE(_claim_key, to_char(now(), 'YYYY-MM-DD') || ':' || _rule_key);

  BEGIN
    INSERT INTO coin_daily_claims (user_id, rule_key, claim_key) VALUES (_user_id, _rule_key, _claim);
  EXCEPTION WHEN unique_violation THEN
    RETURN 0;
  END;

  SELECT EXISTS(
    SELECT 1 FROM user_inventory
    WHERE user_id = _user_id AND item_slug = 'xp_boost_24h'
      AND equipped = true AND expires_at > now()
  ) INTO _boost;
  IF _boost THEN _mult := 2; END IF;
  _amount := _rule.amount * _mult;

  INSERT INTO user_coins (user_id, balance, lifetime_earned)
  VALUES (_user_id, _amount, _amount)
  ON CONFLICT (user_id) DO UPDATE SET
    balance = user_coins.balance + _amount,
    lifetime_earned = user_coins.lifetime_earned + _amount,
    updated_at = now();

  INSERT INTO coin_transactions (user_id, amount, kind, reason, meta)
  VALUES (_user_id, _amount, 'earn', _rule.label || CASE WHEN _mult > 1 THEN ' (2x boost)' ELSE '' END,
          jsonb_build_object('rule_key', _rule_key, 'claim_key', _claim, 'multiplier', _mult));

  RETURN _amount;
END;
$$;

-- 7. Grants for new RPCs
REVOKE EXECUTE ON FUNCTION public.equip_item(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.unequip_item(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_extra_hint() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_active_effects(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_active_streak_freeze(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.equip_item(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unequip_item(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_extra_hint() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_effects(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_streak_freeze(UUID) TO authenticated;

-- Ensure every non-consumable store item has a duration (no permanent items)
UPDATE public.store_items
SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('duration_days', 7)
WHERE COALESCE(meta->>'consumable','false') <> 'true'
  AND (meta->>'duration_days') IS NULL
  AND (meta->>'duration_hours') IS NULL;

-- Backfill expires_at for previously-purchased items so nothing shows "Permanent".
UPDATE public.user_inventory ui
SET expires_at = now() + ((si.meta->>'duration_hours')::int || ' hours')::interval
FROM public.store_items si
WHERE ui.item_slug = si.slug
  AND ui.expires_at IS NULL
  AND (si.meta->>'duration_hours') IS NOT NULL;

UPDATE public.user_inventory ui
SET expires_at = now() + ((si.meta->>'duration_days')::int || ' days')::interval
FROM public.store_items si
WHERE ui.item_slug = si.slug
  AND ui.expires_at IS NULL
  AND ui.equipped = true
  AND (si.meta->>'duration_days') IS NOT NULL;

-- equip_item: start the cosmetic timer on equip (when expires_at is null or expired)
CREATE OR REPLACE FUNCTION public.equip_item(_item_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _item RECORD;
  _inv RECORD;
  _group TEXT;
  _days INT;
  _hours INT;
  _new_expiry TIMESTAMPTZ;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _item FROM store_items WHERE slug = _item_slug;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  SELECT * INTO _inv FROM user_inventory WHERE user_id = _uid AND item_slug = _item_slug;
  IF NOT FOUND THEN RAISE EXCEPTION 'You do not own this item'; END IF;

  _group := COALESCE(_item.meta->>'equip_group', _item.slug);
  _days  := NULLIF(_item.meta->>'duration_days','')::INT;
  _hours := NULLIF(_item.meta->>'duration_hours','')::INT;

  IF _inv.expires_at IS NULL OR _inv.expires_at < now() THEN
    IF _days IS NOT NULL THEN
      _new_expiry := now() + (_days || ' days')::interval;
    ELSIF _hours IS NOT NULL THEN
      _new_expiry := now() + (_hours || ' hours')::interval;
    ELSE
      _new_expiry := NULL;
    END IF;
    UPDATE user_inventory SET expires_at = _new_expiry
    WHERE user_id = _uid AND item_slug = _item_slug;
  END IF;

  UPDATE user_inventory ui
  SET equipped = false
  FROM store_items si
  WHERE ui.user_id = _uid
    AND ui.item_slug = si.slug
    AND COALESCE(si.meta->>'equip_group', si.slug) = _group
    AND ui.item_slug <> _item_slug;

  UPDATE user_inventory SET equipped = true WHERE user_id = _uid AND item_slug = _item_slug;
  RETURN jsonb_build_object('ok', true, 'group', _group);
END;
$$;

-- purchase_item: cosmetics (duration_days) leave expires_at NULL until equipped.
-- Power-ups (duration_hours) start ticking immediately on purchase.
CREATE OR REPLACE FUNCTION public.purchase_item(_item_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _item RECORD;
  _bal INT;
  _days INT;
  _hours INT;
  _new_expiry TIMESTAMPTZ;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _item FROM store_items WHERE slug = _item_slug AND enabled = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not available'; END IF;

  SELECT balance INTO _bal FROM user_coins WHERE user_id = _uid FOR UPDATE;
  IF _bal IS NULL OR _bal < _item.price THEN RAISE EXCEPTION 'Insufficient coins'; END IF;

  UPDATE user_coins
  SET balance = balance - _item.price,
      lifetime_spent = lifetime_spent + _item.price,
      updated_at = now()
  WHERE user_id = _uid;

  _days  := NULLIF(_item.meta->>'duration_days','')::INT;
  _hours := NULLIF(_item.meta->>'duration_hours','')::INT;
  IF _hours IS NOT NULL THEN
    _new_expiry := now() + (_hours || ' hours')::interval;
  ELSE
    _new_expiry := NULL;
  END IF;

  INSERT INTO user_inventory (user_id, item_slug, quantity, expires_at, acquired_at)
  VALUES (_uid, _item_slug, 1, _new_expiry, now())
  ON CONFLICT (user_id, item_slug) DO UPDATE SET
    quantity = user_inventory.quantity + 1,
    expires_at = CASE
      WHEN _hours IS NOT NULL THEN
        CASE WHEN user_inventory.expires_at IS NULL OR user_inventory.expires_at < now()
             THEN _new_expiry
             ELSE user_inventory.expires_at + (_hours || ' hours')::interval END
      WHEN _days IS NOT NULL THEN
        CASE WHEN user_inventory.expires_at IS NOT NULL AND user_inventory.expires_at > now()
             THEN user_inventory.expires_at + (_days || ' days')::interval
             ELSE NULL END
      ELSE user_inventory.expires_at
    END,
    acquired_at = now();

  INSERT INTO coin_transactions (user_id, amount, kind, reason, meta)
  VALUES (_uid, -_item.price, 'spend', 'Purchase: ' || _item.name, jsonb_build_object('item_slug', _item_slug));

  RETURN jsonb_build_object('ok', true, 'remaining', _bal - _item.price, 'expires_at', _new_expiry);
END;
$$;

GRANT EXECUTE ON FUNCTION public.equip_item(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_item(TEXT) TO authenticated;