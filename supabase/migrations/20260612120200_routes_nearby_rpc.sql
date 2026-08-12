-- EXPLORE-174 · RPC routes_nearby (listas/feeds — radio + orden por distancia al inicio)

CREATE OR REPLACE FUNCTION routes_nearby(
  in_lat          DOUBLE PRECISION,
  in_lng          DOUBLE PRECISION,
  radius_m        DOUBLE PRECISION DEFAULT 50000,
  filter_category route_category DEFAULT NULL,
  result_limit    INT DEFAULT 30
)
RETURNS TABLE (
  id                  UUID,
  name                TEXT,
  category            route_category,
  difficulty          route_difficulty,
  distance_m          DECIMAL,
  distance_to_start_m DOUBLE PRECISION,
  path                JSONB,
  created_by          UUID
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
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
    r.created_by
  FROM routes r
  WHERE r.state = 'published'
    AND r.is_public = true
    AND r.path IS NOT NULL
    AND (filter_category IS NULL OR r.category = filter_category)
    AND ST_DWithin(
          ST_StartPoint(r.path::geometry)::geography,
          ST_MakePoint(in_lng, in_lat)::geography,
          radius_m
        )
  ORDER BY distance_to_start_m
  LIMIT result_limit;
$$;

GRANT EXECUTE ON FUNCTION routes_nearby(
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  route_category,
  INT
) TO anon, authenticated;
