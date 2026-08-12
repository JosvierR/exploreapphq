-- Enrich discover user search with profile accent + published route count (trips).
-- Return type changed vs 20260624120000 — must drop before recreate (42P13).

DROP FUNCTION IF EXISTS public.search_users_discover(TEXT, INT);

CREATE OR REPLACE FUNCTION public.search_users_discover(
  q              TEXT,
  result_limit   INT DEFAULT 25
)
RETURNS TABLE (
  id             UUID,
  handle         TEXT,
  display_name   TEXT,
  avatar_url     TEXT,
  accent_color   TEXT,
  trips_count    BIGINT
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
    u.avatar_url,
    u.accent_color,
    (
      SELECT COUNT(*)::BIGINT
      FROM public.routes r
      WHERE r.created_by = u.id
        AND r.state = 'published'
        AND r.is_public = true
    ) AS trips_count
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
