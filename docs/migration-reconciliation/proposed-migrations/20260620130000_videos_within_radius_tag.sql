-- ─── videos_within_radius + filtro de tag ────────────────────────────────────
-- Añade `filter_tag` opcional al feed scored para que el Hero de Explore, al
-- filtrar por categoría, siga siendo "cerca de ti" (geo + scoring), en vez del
-- query global por created_at que usaba antes (findByCategory). Con filter_tag
-- NULL el comportamiento es idéntico al actual → el feed principal no cambia.
--
-- Cambia la firma (añade un param), así que se DROPea la versión previa de 9 args
-- para evitar overloads ambiguos (PGRST203), igual que hizo feed_scoring.

DROP FUNCTION IF EXISTS public.videos_within_radius(
  double precision, double precision, double precision, integer,
  double precision, uuid, uuid, timestamp with time zone, timestamp with time zone
);

CREATE OR REPLACE FUNCTION videos_within_radius(
  lat_param           FLOAT,
  lng_param           FLOAT,
  radius_meters       FLOAT,
  max_results         INT     DEFAULT 20,
  cursor_score        FLOAT8  DEFAULT NULL,
  cursor_id           UUID    DEFAULT NULL,
  uid_param           UUID    DEFAULT NULL,
  exclude_seen_since  TIMESTAMPTZ DEFAULT NULL,
  as_of               TIMESTAMPTZ DEFAULT NULL,
  filter_tag          TEXT    DEFAULT NULL   -- nuevo: filtra por categoría/tag
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
    scored.id, scored.video_url, scored.thumbnail_url, scored.lat, scored.lng,
    scored.route_id, scored.description, scored.tags, scored.duration_seconds,
    scored.total_likes, scored.total_comments, scored.created_by, scored.state,
    scored.created_at, scored.updated_at, scored.score
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
