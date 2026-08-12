-- EXPLORE-254 · Server-side permanent account deletion (follow-up account-deletion PR)
-- Moves GDPR-relevant purge off the client: service-role RPCs + sweep for expired grace.

-- ─── Community purge (service role — no auth.uid() check) ───────────────────

CREATE OR REPLACE FUNCTION purge_community_user_data_service(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  -- Idempotent: no-op body when user already purged (safe to re-run).

  UPDATE videos v
  SET
    total_likes = COALESCE((
      SELECT COUNT(*)::INT
      FROM likes l
      WHERE l.video_id = v.id
        AND l.user_id <> p_user_id
    ), 0),
    updated_at = now()
  WHERE v.id IN (
    SELECT DISTINCT video_id FROM likes WHERE user_id = p_user_id
  );

  UPDATE videos v
  SET
    total_comments = COALESCE((
      SELECT COUNT(*)::INT
      FROM comments c
      WHERE c.video_id = v.id
        AND c.user_id <> p_user_id
    ), 0),
    updated_at = now()
  WHERE v.id IN (
    SELECT DISTINCT video_id FROM comments WHERE user_id = p_user_id
  );

  DELETE FROM video_impressions WHERE user_id = p_user_id;
  DELETE FROM video_reports WHERE reported_by = p_user_id;
  DELETE FROM content_reports WHERE reported_by = p_user_id;
  DELETE FROM likes WHERE user_id = p_user_id;
  DELETE FROM comments WHERE user_id = p_user_id;
  DELETE FROM followers
  WHERE follower_id = p_user_id
     OR following_id = p_user_id;
  DELETE FROM videos WHERE created_by = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION purge_community_user_data_service(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_community_user_data_service(UUID) TO service_role;

-- ─── Places purge (EXPLORE-160 server-side) ─────────────────────────────────

CREATE OR REPLACE FUNCTION purge_places_user_data(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  -- Own places → soft delete
  UPDATE places
  SET state = 'deleted', updated_at = now()
  WHERE created_by = p_user_id
    AND state IS DISTINCT FROM 'deleted';

  -- Photos uploaded on others' places → hard delete rows
  DELETE FROM place_photos pp
  USING places p
  WHERE pp.uploaded_by = p_user_id
    AND pp.place_id = p.id
    AND p.created_by <> p_user_id;

  -- Reviews (trigger recalculate_place_rating updates averages)
  DELETE FROM reviews WHERE user_id = p_user_id;

  -- Place favorites only (route/video favorites are other domains)
  DELETE FROM favorites
  WHERE user_id = p_user_id
    AND place_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION purge_places_user_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_places_user_data(UUID) TO service_role;

-- ─── Routes purge ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION purge_routes_user_data(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  UPDATE routes
  SET state = 'deleted', updated_at = now()
  WHERE created_by = p_user_id
    AND state IS DISTINCT FROM 'deleted';
END;
$$;

REVOKE ALL ON FUNCTION purge_routes_user_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_routes_user_data(UUID) TO service_role;

-- ─── User PII finalization ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION finalize_user_account_pii(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_handle TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  -- Idempotent: already finalized
  IF EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user_id
      AND is_ghost = true
      AND handle LIKE 'deleted_%'
  ) THEN
    RETURN;
  END IF;

  v_handle := 'deleted_' || replace(substring(p_user_id::text, 1, 13), '-', '');

  UPDATE users
  SET
    handle = v_handle,
    display_name = 'Deleted user',
    email = NULL,
    avatar_url = NULL,
    bio = NULL,
    categories_preferred = '{}',
    is_deactivated = true,
    is_ghost = true,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION finalize_user_account_pii(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_user_account_pii(UUID) TO service_role;

-- ─── Orchestrator (idempotent per user) ─────────────────────────────────────

CREATE OR REPLACE FUNCTION finalize_account_deletion_server(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row users%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  SELECT * INTO v_row FROM users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Already permanently deleted
  IF v_row.is_ghost = true AND v_row.handle LIKE 'deleted_%' THEN
    RETURN;
  END IF;

  IF v_row.is_deactivated IS NOT TRUE
     OR v_row.deletion_scheduled_at IS NULL
     OR v_row.deletion_scheduled_at > now() THEN
    RAISE EXCEPTION 'Account not eligible for permanent deletion (grace period active or not scheduled)';
  END IF;

  PERFORM purge_community_user_data_service(p_user_id);
  PERFORM purge_places_user_data(p_user_id);
  PERFORM purge_routes_user_data(p_user_id);
  PERFORM finalize_user_account_pii(p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION finalize_account_deletion_server(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_account_deletion_server(UUID) TO service_role;

-- Authenticated user may trigger own purge after grace (best-effort from client).
CREATE OR REPLACE FUNCTION finalize_own_expired_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM finalize_account_deletion_server(auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION finalize_own_expired_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_own_expired_account() TO authenticated;

-- ─── Sweep expired accounts (scheduler / Edge Function entry) ────────────────

CREATE OR REPLACE FUNCTION sweep_expired_account_deletions(p_limit INT DEFAULT 50)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_count INT := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 50;
  END IF;

  FOR v_user_id IN
    SELECT id
    FROM users
    WHERE is_deactivated = true
      AND is_ghost = false
      AND deletion_scheduled_at IS NOT NULL
      AND deletion_scheduled_at <= now()
    ORDER BY deletion_scheduled_at ASC
    LIMIT p_limit
  LOOP
    BEGIN
      PERFORM finalize_account_deletion_server(v_user_id);
      v_count := v_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'finalize_account_deletion_server failed for %: %', v_user_id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION sweep_expired_account_deletions(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sweep_expired_account_deletions(INT) TO service_role;

-- Production scheduling (enable pg_cron in Supabase Dashboard, then):
--   SELECT cron.schedule(
--     'sweep-expired-account-deletions',
--     '15 * * * *',
--     $$SELECT public.sweep_expired_account_deletions(50)$$
--   );
-- Or invoke Edge Function finalize-account-deletion on the same cadence.
