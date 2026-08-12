-- Closes an RLS gap on photo_uploads_log (EXPLORE-147 anti-spam rate-limit log),
-- flagged by the Supabase security linter: anon/authenticated had unrestricted
-- SELECT/INSERT/UPDATE/DELETE on every row. Concretely that let any client:
--   - delete their own log rows to bypass the hourly photo-upload quota
--   - read/delete other users' upload history
--   - insert fabricated rows tagged with another user's id
--
-- spatial_ref_sys (the other table flagged by the linter) is a PostGIS system
-- table owned by supabase_admin, not postgres — ALTER TABLE ... ENABLE ROW LEVEL
-- SECURITY fails with "must be owner of table" for migrations (see the commented
-- attempt already in 00006_rls_policies.sql). It holds public EPSG reference data,
-- not user data, so this is treated as an accepted false positive rather than a fix.

ALTER TABLE public.photo_uploads_log ENABLE ROW LEVEL SECURITY;

-- Client may log its own upload (used by places.repository.ts logPhotoUpload).
CREATE POLICY photo_uploads_log_insert_own ON public.photo_uploads_log FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- No SELECT/UPDATE/DELETE policy for authenticated/anon: reads go through the
-- SECURITY DEFINER RPC below, and rows are otherwise immutable from the client
-- (only cleanup_old_upload_logs, run by service_role, removes old rows).

REVOKE ALL ON public.photo_uploads_log FROM anon;
REVOKE SELECT, UPDATE, DELETE, TRUNCATE ON public.photo_uploads_log FROM authenticated;

-- Users could otherwise probe another user's upload count by passing an
-- arbitrary uid — restrict the RPC to querying only the caller's own count.
CREATE OR REPLACE FUNCTION count_user_uploads_in_window(
  uid UUID,
  window_seconds INTEGER DEFAULT 3600
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> uid THEN
    RAISE EXCEPTION 'Can only query your own upload count';
  END IF;

  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM photo_uploads_log
    WHERE user_id = uid
      AND uploaded_at > now() - (window_seconds || ' seconds')::interval
  );
END;
$$;

REVOKE ALL ON FUNCTION count_user_uploads_in_window(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION count_user_uploads_in_window(UUID, INTEGER) TO authenticated;

-- Maintenance-only: restrict to service_role (cron), matching the deletion sweep pattern.
REVOKE ALL ON FUNCTION cleanup_old_upload_logs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_old_upload_logs() TO service_role;
