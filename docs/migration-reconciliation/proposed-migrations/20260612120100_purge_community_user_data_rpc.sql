-- EXPLORE-145 · Server-side community purge on account deletion (SECURITY DEFINER)
-- Bypasses RLS for counter updates and bulk deletes while still requiring auth.uid() = p_user_id.

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

  -- 5. Likes
  DELETE FROM likes WHERE user_id = p_user_id;

  -- 6. Comments
  DELETE FROM comments WHERE user_id = p_user_id;

  -- 7. Follow graph (as follower and as followed)
  DELETE FROM followers
  WHERE follower_id = p_user_id
     OR following_id = p_user_id;

  -- 8. Videos owned by this user (CASCADE → video_places, etc.)
  DELETE FROM videos WHERE created_by = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION purge_community_user_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_community_user_data(UUID) TO authenticated;

-- RLS: allow users to delete their own reports (fallback if RPC is not used)
CREATE POLICY video_reports_delete_own ON video_reports
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = reported_by);

-- RLS: allow users to remove rows where they are the followed account
CREATE POLICY followers_delete_as_followed ON followers
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = following_id);
