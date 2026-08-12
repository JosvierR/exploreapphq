-- ============================================================================
-- EXPLORE-155 · Extend places_in_bbox with optional category filter
-- ============================================================================

DROP FUNCTION IF EXISTS places_in_bbox(
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION
);

CREATE OR REPLACE FUNCTION places_in_bbox(
  lat1            DOUBLE PRECISION,
  lat2            DOUBLE PRECISION,
  lng1            DOUBLE PRECISION,
  lng2            DOUBLE PRECISION,
  category_filter TEXT DEFAULT NULL
)
RETURNS SETOF places
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT *
  FROM places
  WHERE state = 'published'
    AND location && ST_MakeEnvelope(lng1, lat1, lng2, lat2, 4326)
    AND (category_filter IS NULL OR category::text = category_filter);
$$;

GRANT EXECUTE ON FUNCTION places_in_bbox(
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT
) TO anon, authenticated;
