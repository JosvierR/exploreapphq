-- ─── Explore · "Creadores locales" — filtro por categoría ────────────────────
-- Añade filtro de categoría a explore_local_creators para que el chip de categoría
-- de Explore afecte también a esta línea: un creador entra si tiene contenido EN LA
-- CATEGORÍA seleccionada dentro de la zona (videos por tag, lugares por categoría).
-- Con chip "Todos" (ambos filtros NULL) el comportamiento es idéntico al anterior.
--
-- Cambia la firma (añade 2 params), así que se DROPea la versión previa para evitar
-- overloads ambiguos (PGRST203), igual que hizo feed_scoring.

DROP FUNCTION IF EXISTS public.explore_local_creators(
  double precision, double precision, double precision, integer, integer, timestamp with time zone
);

CREATE OR REPLACE FUNCTION explore_local_creators(
  in_lat                FLOAT,
  in_lng                FLOAT,
  radius_m              FLOAT,
  filter_video_tag      TEXT           DEFAULT NULL,
  filter_place_category place_category DEFAULT NULL,
  max_results           INT            DEFAULT 10,
  offset_param          INT            DEFAULT 0,
  as_of                 TIMESTAMPTZ    DEFAULT NULL
)
RETURNS TABLE (
  creator_id           UUID,
  handle               TEXT,
  display_name         TEXT,
  avatar_url           TEXT,
  accent_color         TEXT,
  publications_in_zone INT,
  engagement_received  INT,
  last_publication     TIMESTAMPTZ,
  score                FLOAT8
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH contrib AS (
    SELECT v.created_by AS uid, v.created_at AS at, (v.total_likes + v.total_comments) AS eng
    FROM videos v
    WHERE v.state = 'published'
      AND ST_DWithin(v.location, ST_MakePoint(in_lng, in_lat)::geography, radius_m)
      AND (filter_video_tag IS NULL OR filter_video_tag = ANY(v.tags::text[]))
    UNION ALL
    SELECT p.created_by, p.created_at, p.total_ratings
    FROM places p
    WHERE p.state = 'published'
      AND ST_DWithin(p.location, ST_MakePoint(in_lng, in_lat)::geography, radius_m)
      AND (filter_place_category IS NULL OR p.category = filter_place_category)
  ),
  agg AS (
    SELECT uid, count(*) AS pub_count, sum(eng) AS eng_total, max(at) AS last_pub
    FROM contrib
    WHERE uid <> '00000000-0000-0000-0000-000000000001'
    GROUP BY uid
    HAVING count(*) >= 2
  )
  SELECT
    u.id, u.handle, u.display_name, u.avatar_url, u.accent_color,
    a.pub_count::int, a.eng_total::int, a.last_pub,
    ROUND((
        0.40 * explore_norm_log(a.pub_count, 10)
      + 0.35 * explore_norm_log(a.eng_total, 100)
      + 0.25 * explore_recency_decay(a.last_pub, 168, COALESCE(as_of, now()))
    )::numeric, 6)::float8 AS score
  FROM agg a
  JOIN users u ON u.id = a.uid
  ORDER BY score DESC, u.id DESC
  OFFSET offset_param
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION explore_local_creators(FLOAT, FLOAT, FLOAT, TEXT, place_category, INT, INT, TIMESTAMPTZ) TO anon, authenticated;
