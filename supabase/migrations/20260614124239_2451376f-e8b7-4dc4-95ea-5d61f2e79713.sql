
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
