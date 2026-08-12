/**
 * Feed de videos de usuarios que sigo.
 * Filtra solo videos publicados de mis seguidos.
 */
CREATE OR REPLACE FUNCTION videos_from_following(
  p_follower_id UUID,
  max_results   INT         DEFAULT 20,
  cursor_at     TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id               UUID,
  video_url        TEXT,
  thumbnail_url    TEXT,
  lat              FLOAT,
  lng              FLOAT,
  route_id         UUID,
  description      TEXT,
  tags             TEXT[],
  duration_seconds INT,
  total_likes      INT,
  total_comments   INT,
  created_by       UUID,
  state            TEXT,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
  SELECT
    v.id,
    v.video_url,
    v.thumbnail_url,
    ST_Y(v.location::geometry) AS lat,
    ST_X(v.location::geometry) AS lng,
    v.route_id,
    v.description,
    v.tags,
    v.duration_seconds,
    v.total_likes,
    v.total_comments,
    v.created_by,
    v.state::TEXT,
    v.created_at,
    v.updated_at
  FROM videos v
  WHERE
    v.state = 'published'
    AND v.created_by IN (
      SELECT following_id FROM followers WHERE follower_id = p_follower_id
    )
    AND (cursor_at IS NULL OR v.created_at < cursor_at)
  ORDER BY v.created_at DESC
  LIMIT max_results;
$$;
