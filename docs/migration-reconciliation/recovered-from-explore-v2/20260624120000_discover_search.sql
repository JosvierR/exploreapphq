-- ============================================================================
-- Explore discover search: users, videos, routes.
-- Places reuse search_places_for_map from 20260623120000_search_places_for_map.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_users_discover(
  q              TEXT,
  result_limit   INT DEFAULT 25
)
RETURNS TABLE (
  id             UUID,
  handle         TEXT,
  display_name   TEXT,
  avatar_url     TEXT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT trim(q) AS query
  )
  SELECT
    u.id,
    u.handle,
    u.display_name,
    u.avatar_url
  FROM normalized n
  JOIN public.users u
    ON u.is_deactivated = false
   AND u.is_ghost = false
  WHERE length(n.query) >= 2
    AND (
      u.handle ILIKE '%' || n.query || '%'
      OR u.display_name ILIKE '%' || n.query || '%'
    )
  ORDER BY
    CASE WHEN u.handle ILIKE n.query || '%' THEN 0 ELSE 1 END,
    CASE WHEN u.display_name ILIKE n.query || '%' THEN 0 ELSE 1 END,
    u.handle ASC
  LIMIT LEAST(GREATEST(COALESCE(result_limit, 25), 1), 25);
$$;

GRANT EXECUTE ON FUNCTION public.search_users_discover(TEXT, INT) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_videos_discover(
  q              TEXT,
  tag_filter     TEXT DEFAULT NULL,
  result_limit   INT DEFAULT 25
)
RETURNS TABLE (
  id                   UUID,
  description          TEXT,
  thumbnail_url        TEXT,
  tags                 TEXT[],
  created_by           UUID,
  total_likes          INTEGER,
  author_handle        TEXT,
  author_display_name  TEXT,
  author_avatar_url    TEXT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT trim(q) AS query
  )
  SELECT
    v.id,
    v.description,
    v.thumbnail_url,
    v.tags,
    v.created_by,
    v.total_likes,
    u.handle AS author_handle,
    u.display_name AS author_display_name,
    u.avatar_url AS author_avatar_url
  FROM normalized n
  JOIN public.videos v
    ON v.state = 'published'
   AND v.publish_to_feed = true
  JOIN public.users u ON u.id = v.created_by
  WHERE length(n.query) >= 2
    AND COALESCE(v.description, '') ILIKE '%' || n.query || '%'
    AND (tag_filter IS NULL OR v.tags && ARRAY[tag_filter])
  ORDER BY
    CASE WHEN COALESCE(v.description, '') ILIKE n.query || '%' THEN 0 ELSE 1 END,
    v.total_likes DESC,
    v.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(result_limit, 25), 1), 25);
$$;

GRANT EXECUTE ON FUNCTION public.search_videos_discover(TEXT, TEXT, INT) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_routes_discover(
  q                TEXT,
  category_filter  route_category DEFAULT NULL,
  result_limit     INT DEFAULT 25
)
RETURNS TABLE (
  id                    UUID,
  name                  TEXT,
  description           TEXT,
  category              route_category,
  distance_meters       NUMERIC,
  created_by            UUID,
  creator_handle        TEXT,
  creator_display_name  TEXT,
  creator_avatar_url    TEXT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT trim(q) AS query
  )
  SELECT
    r.id,
    r.name,
    r.description,
    r.category,
    r.distance_m AS distance_meters,
    r.created_by,
    u.handle AS creator_handle,
    u.display_name AS creator_display_name,
    u.avatar_url AS creator_avatar_url
  FROM normalized n
  JOIN public.routes r
    ON r.state = 'published'
   AND r.is_public = true
  LEFT JOIN public.users u ON u.id = r.created_by
  WHERE length(n.query) >= 2
    AND (category_filter IS NULL OR r.category = category_filter)
    AND (
      COALESCE(r.name, '') ILIKE '%' || n.query || '%'
      OR COALESCE(r.description, '') ILIKE '%' || n.query || '%'
    )
  ORDER BY
    CASE WHEN COALESCE(r.name, '') ILIKE n.query || '%' THEN 0 ELSE 1 END,
    r.distance_m DESC NULLS LAST,
    r.name ASC
  LIMIT LEAST(GREATEST(COALESCE(result_limit, 25), 1), 25);
$$;

GRANT EXECUTE ON FUNCTION public.search_routes_discover(TEXT, route_category, INT) TO anon, authenticated;
