-- ============================================================================
-- EXPLORE-121 · Fix PostgREST RPC signature lookup for places_in_bbox
-- ============================================================================

DROP FUNCTION IF EXISTS places_in_bbox(
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION
);

CREATE OR REPLACE FUNCTION places_in_bbox(
  lat1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lng1 DOUBLE PRECISION,
  lng2 DOUBLE PRECISION
)
RETURNS SETOF places
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT *
  FROM places
  WHERE state = 'published'
    AND location && ST_MakeEnvelope(lng1, lat1, lng2, lat2, 4326);
$$;

GRANT EXECUTE ON FUNCTION places_in_bbox(
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION
) TO anon, authenticated;

