-- Atomic total_comments counter for comment insert/delete paths.
-- Replaces trigger-based counting to avoid double increments when app uses RPC.

DROP TRIGGER IF EXISTS comments_count_insert ON comments;
DROP TRIGGER IF EXISTS comments_count_delete ON comments;

CREATE OR REPLACE FUNCTION increment_video_comments(
  p_video_id UUID,
  p_delta    INT
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE videos
  SET total_comments = GREATEST(total_comments + p_delta, 0),
      updated_at     = now()
  WHERE id = p_video_id;
$$;

REVOKE ALL ON FUNCTION increment_video_comments(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_video_comments(UUID, INT) TO authenticated;
