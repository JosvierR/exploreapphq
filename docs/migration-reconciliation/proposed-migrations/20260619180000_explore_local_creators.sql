-- ─── Explore · "Creadores locales" ──────────────────────────────────────────
-- Perfiles activos cuyo contenido se ancla en la zona. Agregación de lectura
-- (denormalizada) sobre videos + lugares por autor; vive en SQL para no acoplar
-- código entre dominios. Coste: GROUP BY sobre 2 tablas → la query más cara del
-- set; perfilar antes de materializar si el tráfico crece.
--
-- score = 0.40*norm_log(pub_count,10)
--       + 0.35*norm_log(engagement_recibido,100)
--       + 0.25*recency_decay(ultima_publicacion, 168h)
-- HAVING pub_count >= 2. Excluye al usuario ghost.

CREATE OR REPLACE FUNCTION explore_local_creators(
  in_lat        FLOAT,
  in_lng        FLOAT,
  radius_m      FLOAT,
  max_results   INT         DEFAULT 10,
  offset_param  INT         DEFAULT 0,
  as_of         TIMESTAMPTZ DEFAULT NULL
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
    UNION ALL
    SELECT p.created_by, p.created_at, p.total_ratings
    FROM places p
    WHERE p.state = 'published'
      AND ST_DWithin(p.location, ST_MakePoint(in_lng, in_lat)::geography, radius_m)
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

GRANT EXECUTE ON FUNCTION explore_local_creators(FLOAT, FLOAT, FLOAT, INT, INT, TIMESTAMPTZ) TO anon, authenticated;
