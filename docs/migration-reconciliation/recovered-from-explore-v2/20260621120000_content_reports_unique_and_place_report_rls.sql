-- EXPLORE-214: content_reports uniqueness + place/user reporting RLS

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_reports_unique_reporter
  ON content_reports (content_type, content_id, reported_by);

DROP POLICY IF EXISTS content_reports_insert ON content_reports;

CREATE POLICY content_reports_insert ON content_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = reported_by
    AND content_type IN ('place_photo', 'place', 'user')
    AND EXISTS (
      SELECT 1
      FROM users reporter
      WHERE reporter.id = (SELECT auth.uid())
        AND reporter.email_verified = true
        AND reporter.is_deactivated = false
        AND reporter.is_ghost = false
    )
    AND (
      (
        content_type = 'place_photo'
        AND EXISTS (
          SELECT 1
          FROM place_photos photo
          WHERE photo.id = content_id
            AND photo.uploaded_by != (SELECT auth.uid())
        )
      )
      OR (
        content_type = 'place'
        AND EXISTS (
          SELECT 1
          FROM places p
          WHERE p.id = content_id
            AND p.created_by != (SELECT auth.uid())
        )
      )
      OR (
        content_type = 'user'
        AND EXISTS (
          SELECT 1
          FROM users target
          WHERE target.id = content_id
            AND target.id != (SELECT auth.uid())
            AND target.is_deactivated = false
            AND target.is_ghost = false
        )
      )
    )
  );

DROP POLICY IF EXISTS places_update_report ON places;

CREATE POLICY places_update_report ON places
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND created_by != (SELECT auth.uid())
    AND state = 'published'::place_state
    AND EXISTS (
      SELECT 1
      FROM users reporter
      WHERE reporter.id = (SELECT auth.uid())
        AND reporter.email_verified = true
        AND reporter.is_deactivated = false
        AND reporter.is_ghost = false
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND created_by != (SELECT auth.uid())
    AND state = 'reported'::place_state
    AND EXISTS (
      SELECT 1
      FROM users reporter
      WHERE reporter.id = (SELECT auth.uid())
        AND reporter.email_verified = true
        AND reporter.is_deactivated = false
        AND reporter.is_ghost = false
    )
  );

CREATE OR REPLACE FUNCTION purge_community_user_data(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to purge community data for this user';
  END IF;

  -- 1. Recalculate total_likes before removing this user's likes
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

  -- 2. Recalculate total_comments before removing this user's comments
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

  -- 3. Impressions
  DELETE FROM video_impressions WHERE user_id = p_user_id;

  -- 4. Reports filed by this user
  DELETE FROM video_reports WHERE reported_by = p_user_id;
  DELETE FROM content_reports WHERE reported_by = p_user_id;

  -- 5. Likes
  DELETE FROM likes WHERE user_id = p_user_id;

  -- 6. Comments
  DELETE FROM comments WHERE user_id = p_user_id;

  -- 7. Follow graph (as follower and as followed)
  DELETE FROM followers
  WHERE follower_id = p_user_id
     OR following_id = p_user_id;

  -- 8. Videos owned by this user (CASCADE -> video_places, etc.)
  DELETE FROM videos WHERE created_by = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION purge_community_user_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_community_user_data(UUID) TO authenticated;

-- PostgREST UPDATE + RETURNING fails when a reporter marks content as reported:
-- the new row no longer passes SELECT policies (state != published). Same class
-- of issue as withdraw_own_photo — use SECURITY DEFINER for the transition.

CREATE OR REPLACE FUNCTION mark_video_reported(p_video_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE videos
  SET state = 'reported'::video_state,
      updated_at = now()
  WHERE id = p_video_id
    AND created_by IS DISTINCT FROM auth.uid()
    AND state = 'published'::video_state;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;

CREATE OR REPLACE FUNCTION mark_place_reported(p_place_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM users reporter
    WHERE reporter.id = auth.uid()
      AND reporter.email_verified = true
      AND reporter.is_deactivated = false
      AND reporter.is_ghost = false
  ) THEN
    RETURN FALSE;
  END IF;

  UPDATE places
  SET state = 'reported'::place_state,
      updated_at = now()
  WHERE id = p_place_id
    AND created_by IS DISTINCT FROM auth.uid()
    AND state = 'published'::place_state;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_video_reported(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_place_reported(UUID) TO authenticated;
