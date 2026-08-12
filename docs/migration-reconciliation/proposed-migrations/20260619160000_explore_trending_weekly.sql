-- ─── Explore · "Tendencia esta semana" (videos + rutas) ──────────────────────
-- Tracción RECIENTE (ventana 7d), no popularidad histórica. Dos RPCs por dominio
-- (videos / rutas); el cliente normaliza cada lista a [0,1] (ya lo hace norm_log)
-- y las fusiona. NO es un UNION (cruzaría dos aggregate roots).
--
-- Videos: interacciones_7d = likes_7d + 2*comments_7d (por created_at).
-- Rutas (proxy, sin saves/completions aún): videos enlazados creados en 7d.

CREATE OR REPLACE FUNCTION videos_trending_weekly(
  in_lat       FLOAT,
  in_lng       FLOAT,
  radius_m     FLOAT,
  filter_tag   TEXT        DEFAULT NULL,
  max_results  INT         DEFAULT 12,
  as_of        TIMESTAMPTZ DEFAULT NULL
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
  updated_at       TIMESTAMPTZ,
  score            FLOAT8
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH win AS (SELECT (COALESCE(as_of, now()) - interval '7 days') AS since),
  scored AS (
    SELECT
      v.id, v.video_url, v.thumbnail_url,
      ST_Y(v.location::geometry) AS lat,
      ST_X(v.location::geometry) AS lng,
      v.route_id, v.description, v.tags::text[],
      v.duration_seconds, v.total_likes, v.total_comments,
      v.created_by, v.state::text, v.created_at, v.updated_at,
      (
        (SELECT count(*) FROM likes l WHERE l.video_id = v.id AND l.created_at >= (SELECT since FROM win))
        + 2 * (SELECT count(*) FROM comments c WHERE c.video_id = v.id AND c.created_at >= (SELECT since FROM win))
      ) AS interactions_7d
    FROM videos v
    WHERE v.state = 'published'
      AND ST_DWithin(v.location, ST_MakePoint(in_lng, in_lat)::geography, radius_m)
      AND (filter_tag IS NULL OR filter_tag = ANY(v.tags::text[]))
  )
  SELECT
    s.id, s.video_url, s.thumbnail_url, s.lat, s.lng, s.route_id, s.description,
    s.tags, s.duration_seconds, s.total_likes, s.total_comments, s.created_by,
    s.state, s.created_at, s.updated_at,
    ROUND(explore_norm_log(s.interactions_7d, 20)::numeric, 6)::float8 AS score
  FROM scored s
  WHERE s.interactions_7d > 0
  ORDER BY score DESC, s.id DESC
  LIMIT max_results;
$$;

CREATE OR REPLACE FUNCTION routes_trending_weekly(
  in_lat           FLOAT,
  in_lng           FLOAT,
  radius_m         FLOAT,
  filter_category  route_category DEFAULT NULL,
  max_results      INT            DEFAULT 12,
  as_of            TIMESTAMPTZ    DEFAULT NULL
)
RETURNS TABLE (
  id                  UUID,
  name                TEXT,
  category            route_category,
  difficulty          route_difficulty,
  distance_m          DOUBLE PRECISION,
  distance_to_start_m DOUBLE PRECISION,
  path                JSONB,
  created_by          UUID,
  score               FLOAT8
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH win AS (SELECT (COALESCE(as_of, now()) - interval '7 days') AS since),
  scored AS (
    SELECT
      r.id, r.name, r.category, r.difficulty, r.distance_m,
      ST_Distance(
        ST_StartPoint(r.path::geometry)::geography,
        ST_MakePoint(in_lng, in_lat)::geography
      ) AS distance_to_start_m,
      ST_AsGeoJSON(r.path)::jsonb AS path,
      r.created_by,
      (
        SELECT count(*) FROM videos v
        WHERE v.route_id = r.id AND v.state = 'published'
          AND v.created_at >= (SELECT since FROM win)
      ) AS recent_videos_7d
    FROM routes r
    WHERE r.state = 'published'
      AND r.is_public = true
      AND r.path IS NOT NULL
      AND ST_DWithin(
        ST_StartPoint(r.path::geometry)::geography,
        ST_MakePoint(in_lng, in_lat)::geography,
        radius_m
      )
      AND (filter_category IS NULL OR r.category = filter_category)
  )
  SELECT
    s.id, s.name, s.category, s.difficulty, s.distance_m, s.distance_to_start_m,
    s.path, s.created_by,
    ROUND(explore_norm_log(s.recent_videos_7d, 5)::numeric, 6)::float8 AS score
  FROM scored s
  WHERE s.recent_videos_7d > 0
  ORDER BY score DESC, s.id DESC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION videos_trending_weekly(FLOAT, FLOAT, FLOAT, TEXT, INT, TIMESTAMPTZ)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION routes_trending_weekly(FLOAT, FLOAT, FLOAT, route_category, INT, TIMESTAMPTZ)  TO anon, authenticated;
