CREATE OR REPLACE FUNCTION public.ai_pool_track_key_usage(p_key_id uuid, p_patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text := p_patch->>'p_status';
  v_ok boolean;
BEGIN
  IF p_patch ? 'p_ok' THEN
    v_ok := (p_patch->>'p_ok')::boolean;
  END IF;
  UPDATE public.ai_api_keys SET
    usage_count = usage_count + (CASE WHEN coalesce(v_ok, false) THEN 1 ELSE 0 END),
    error_count = error_count + (CASE WHEN coalesce(v_ok, false) THEN 0 ELSE 1 END),
    status = coalesce(v_status, status),
    last_error = coalesce(p_patch->>'p_error', last_error),
    last_used_at = now(),
    updated_at = now()
  WHERE id = p_key_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_pool_track_key_usage(uuid, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_pool_track_key_usage(uuid, jsonb) TO service_role;
