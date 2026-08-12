-- ─── feed_rpcs_add_place_ids ──────────────────────────────────────────────────
-- Añade place_ids UUID[] a todos los RPCs de feed de videos.
-- Los RPCs devuelven una tabla plana sin el join video_places, por lo que el
-- mapper recibía siempre place_ids=[] para videos del feed, ocultando el botón
-- de "lugares/rutas relacionados" aunque el video tuviese un lugar vinculado.
-- La subquery correlacionada es O(1) por fila gracias al índice en video_places.

-- ─── 1. videos_within_radius ──────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.videos_within_radius(
  double precision, double precision, double precision, integer,
  double precision, uuid, uuid, timestamp with time zone, timestamp with time zone, text
);

CREATE OR REPLACE FUNCTION videos_within_radius(
  lat_param           FLOAT,
  lng_param           FLOAT,
  radius_meters       FLOAT,
  max_results         INT         DEFAULT 20,
  cursor_score        FLOAT8      DEFAULT NULL,
  cursor_id           UUID        DEFAULT NULL,
  uid_param           UUID        DEFAULT NULL,
  exclude_seen_since  TIMESTAMPTZ DEFAULT NULL,
  as_of               TIMESTAMPTZ DEFAULT NULL,
  filter_tag          TEXT        DEFAULT NULL
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
  score            FLOAT8,
  place_ids        UUID[]
)
LANGUAGE sql STABLE AS $$
  WITH scored AS (
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
      v.state,
      v.created_at,
      v.updated_at,
      (SELECT COALESCE(ARRAY_AGG(vp.place_id), ARRAY[]::UUID[])
       FROM video_places vp WHERE vp.video_id = v.id) AS place_ids,
      ROUND((
          0.50 * exp(-EXTRACT(EPOCH FROM (COALESCE(as_of, now()) - v.created_at)) / 259200.0)
        + 0.30 * (1.0 - LEAST(
            ST_Distance(v.location, ST_MakePoint(lng_param, lat_param)::geography) / radius_meters,
            1.0
          ))
        + 0.20 * (ln(1 + v.total_likes + 2 * v.total_comments) / ln(1 + 50))
      )::numeric, 6)::float8 AS score
    FROM videos v
    WHERE
      v.state = 'published'
      AND ST_DWithin(
        v.location,
        ST_MakePoint(lng_param, lat_param)::geography,
        radius_meters
      )
      AND (filter_tag IS NULL OR filter_tag = ANY(v.tags::text[]))
      AND (
        uid_param IS NULL
        OR exclude_seen_since IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM video_impressions vi
          WHERE vi.user_id  = uid_param
            AND vi.video_id = v.id
            AND vi.viewed_at >= exclude_seen_since
        )
      )
  )
  SELECT
    scored.id,
    scored.video_url,
    scored.thumbnail_url,
    scored.lat,
    scored.lng,
    scored.route_id,
    scored.description,
    scored.tags,
    scored.duration_seconds,
    scored.total_likes,
    scored.total_comments,
    scored.created_by,
    scored.state,
    scored.created_at,
    scored.updated_at,
    scored.score,
    scored.place_ids
  FROM scored
  WHERE
    cursor_score IS NULL
    OR (scored.score, scored.id) < (cursor_score, cursor_id)
  ORDER BY scored.score DESC, scored.id DESC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION videos_within_radius(
  FLOAT, FLOAT, FLOAT, INT, FLOAT8, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT
) TO anon, authenticated;

-- ─── 2. videos_from_following ─────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.videos_from_following(
  uuid, integer, timestamp with time zone
);

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
  updated_at       TIMESTAMPTZ,
  place_ids        UUID[]
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
    v.updated_at,
    (SELECT COALESCE(ARRAY_AGG(vp.place_id), ARRAY[]::UUID[])
     FROM video_places vp WHERE vp.video_id = v.id) AS place_ids
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

GRANT EXECUTE ON FUNCTION videos_from_following(UUID, INT, TIMESTAMPTZ) TO anon, authenticated;

-- ─── 3. videos_recent_nearby ──────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.videos_recent_nearby(
  double precision, double precision, double precision, text, integer
);

CREATE OR REPLACE FUNCTION videos_recent_nearby(
  in_lat       FLOAT,
  in_lng       FLOAT,
  radius_m     FLOAT,
  filter_tag   TEXT DEFAULT NULL,
  max_results  INT  DEFAULT 12
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
  place_ids        UUID[]
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    v.id,
    v.video_url,
    v.thumbnail_url,
    ST_Y(v.location::geometry) AS lat,
    ST_X(v.location::geometry) AS lng,
    v.route_id,
    v.description,
    v.tags::text[],
    v.duration_seconds,
    v.total_likes,
    v.total_comments,
    v.created_by,
    v.state::text,
    v.created_at,
    v.updated_at,
    (SELECT COALESCE(ARRAY_AGG(vp.place_id), ARRAY[]::UUID[])
     FROM video_places vp WHERE vp.video_id = v.id) AS place_ids
  FROM videos v
  WHERE v.state = 'published'
    AND ST_DWithin(v.location, ST_MakePoint(in_lng, in_lat)::geography, radius_m)
    AND (filter_tag IS NULL OR filter_tag = ANY(v.tags::text[]))
  ORDER BY v.created_at DESC, v.id DESC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION videos_recent_nearby(FLOAT, FLOAT, FLOAT, TEXT, INT) TO anon, authenticated;

-- ─── 4. videos_trending_weekly ────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.videos_trending_weekly(
  double precision, double precision, double precision, text, integer, timestamp with time zone
);

CREATE OR REPLACE FUNCTION videos_trending_weekly(
  in_lat      FLOAT,
  in_lng      FLOAT,
  radius_m    FLOAT,
  filter_tag  TEXT        DEFAULT NULL,
  max_results INT         DEFAULT 12,
  as_of       TIMESTAMPTZ DEFAULT NULL
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
  score            FLOAT8,
  place_ids        UUID[]
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
      (SELECT COALESCE(ARRAY_AGG(vp.place_id), ARRAY[]::UUID[])
       FROM video_places vp WHERE vp.video_id = v.id) AS place_ids,
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
    ROUND(explore_norm_log(s.interactions_7d, 20)::numeric, 6)::float8 AS score,
    s.place_ids
  FROM scored s
  WHERE s.interactions_7d > 0
  ORDER BY score DESC, s.id DESC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION videos_trending_weekly(FLOAT, FLOAT, FLOAT, TEXT, INT, TIMESTAMPTZ) TO anon, authenticated;

-- ─── 5. videos_recycled_nearby ────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.videos_recycled_nearby(
  double precision, double precision, double precision, uuid, integer, integer
);

CREATE OR REPLACE FUNCTION videos_recycled_nearby(
  lat_param     FLOAT,
  lng_param     FLOAT,
  radius_meters FLOAT,
  uid_param     UUID,
  max_results   INT DEFAULT 20,
  offset_param  INT DEFAULT 0
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
  last_viewed_at   TIMESTAMPTZ,
  place_ids        UUID[]
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
    v.state,
    v.created_at,
    v.updated_at,
    vi.viewed_at AS last_viewed_at,
    (SELECT COALESCE(ARRAY_AGG(vp.place_id), ARRAY[]::UUID[])
     FROM video_places vp WHERE vp.video_id = v.id) AS place_ids
  FROM videos v
  LEFT JOIN video_impressions vi
    ON vi.video_id = v.id AND vi.user_id = uid_param
  WHERE
    v.state = 'published'
    AND ST_DWithin(
      v.location,
      ST_MakePoint(lng_param, lat_param)::geography,
      radius_meters
    )
  ORDER BY vi.viewed_at ASC NULLS FIRST, v.created_at DESC
  LIMIT max_results OFFSET offset_param;
$$;

GRANT EXECUTE ON FUNCTION videos_recycled_nearby(FLOAT, FLOAT, FLOAT, UUID, INT, INT) TO anon, authenticated;
