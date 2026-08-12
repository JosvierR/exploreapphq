-- ─── Explore · "Rutas favoritas de la comunidad" (ranking PROXY) ─────────────
-- Las señales del spec (completions, saves, rating bayesiano) no existen aún en
-- `routes` (no hay favoritos/completions/reviews de rutas). Hasta ese épico, se
-- rankea con un PROXY barato de popularidad sostenida basado en lo que SÍ existe:
--   score = 0.60 * norm_log(videos_enlazados, K=10) + 0.40 * recency_decay(created_at, 720h)
-- Geofiltro por el inicio del trazado (ST_StartPoint), igual que routes_nearby.
-- Devuelve las mismas columnas que routes_nearby (+ video_count, + score) para que
-- el cliente reutilice rowToNearbyRoute sin cambios.
--
-- Cuando lleguen las columnas reales (routes.saves_count / completions_count /
-- avg_rating), cambiar el bloque de score a los pesos 0.45/0.30/0.25 del spec.

CREATE OR REPLACE FUNCTION routes_community_favorites(
  in_lat           FLOAT,
  in_lng           FLOAT,
  radius_m         FLOAT,
  filter_category  route_category DEFAULT NULL,
  max_results      INT            DEFAULT 10,
  cursor_score     FLOAT8         DEFAULT NULL,
  cursor_id        UUID           DEFAULT NULL,
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
  video_count         INT,
  score               FLOAT8
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH scored AS (
    SELECT
      r.id,
      r.name,
      r.category,
      r.difficulty,
      r.distance_m,
      ST_Distance(
        ST_StartPoint(r.path::geometry)::geography,
        ST_MakePoint(in_lng, in_lat)::geography
      ) AS distance_to_start_m,
      ST_AsGeoJSON(r.path)::jsonb AS path,
      r.created_by,
      (
        SELECT count(*)::int FROM videos v
        WHERE v.route_id = r.id AND v.state = 'published'
      ) AS video_count,
      ROUND((
          0.60 * explore_norm_log((
            SELECT count(*) FROM videos v
            WHERE v.route_id = r.id AND v.state = 'published'
          ), 10)
        + 0.40 * explore_recency_decay(r.created_at, 720, COALESCE(as_of, now()))
      )::numeric, 6)::float8 AS score
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
    scored.id,
    scored.name,
    scored.category,
    scored.difficulty,
    scored.distance_m,
    scored.distance_to_start_m,
    scored.path,
    scored.created_by,
    scored.video_count,
    scored.score
  FROM scored
  WHERE cursor_score IS NULL OR (scored.score, scored.id) < (cursor_score, cursor_id)
  ORDER BY scored.score DESC, scored.id DESC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION routes_community_favorites(
  FLOAT, FLOAT, FLOAT, route_category, INT, FLOAT8, UUID, TIMESTAMPTZ
) TO anon, authenticated;
