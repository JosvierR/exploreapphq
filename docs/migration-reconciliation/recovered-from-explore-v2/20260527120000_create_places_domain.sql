-- ============================================================================
-- EXPLORE-120 · Places domain completion
-- Adds place_photos, geospatial RPCs (places/ratings exist in 00003).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ─── ENUM: photo_state ──────────────────────────────────────────────────────

DO $$
BEGIN
  CREATE TYPE photo_state AS ENUM ('active', 'reported', 'withdrawn');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── TABLE: place_photos ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS place_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id    UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state       photo_state NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_place_photos_place_id
  ON place_photos (place_id)
  WHERE state = 'active';

CREATE INDEX IF NOT EXISTS idx_place_photos_uploaded_by
  ON place_photos (uploaded_by);

-- ─── RPC: places_in_bbox ────────────────────────────────────────────────────

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

-- ─── RPC: places_within_radius ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION places_within_radius(
  lat_param     DOUBLE PRECISION,
  lng_param     DOUBLE PRECISION,
  radius_meters INTEGER,
  max_results   INTEGER DEFAULT 50
)
RETURNS SETOF places
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT *
  FROM places
  WHERE state = 'published'
    AND ST_DWithin(
      location,
      ST_MakePoint(lng_param, lat_param)::geography,
      radius_meters
    )
  ORDER BY ST_Distance(
    location,
    ST_MakePoint(lng_param, lat_param)::geography
  )
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION places_in_bbox(
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION places_within_radius(
  DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER
) TO anon, authenticated;

-- ─── RLS: place_photos ──────────────────────────────────────────────────────

ALTER TABLE place_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS place_photos_select ON place_photos;
DROP POLICY IF EXISTS place_photos_insert ON place_photos;
DROP POLICY IF EXISTS place_photos_update_own ON place_photos;
DROP POLICY IF EXISTS place_photos_delete_own ON place_photos;

CREATE POLICY place_photos_select ON place_photos
  FOR SELECT TO authenticated
  USING (
    state = 'active'
    AND EXISTS (
      SELECT 1
      FROM places p
      WHERE p.id = place_photos.place_id
        AND (
          p.state = 'published'::place_state
          OR p.created_by = (SELECT auth.uid())
        )
    )
  );

CREATE POLICY place_photos_insert ON place_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = uploaded_by
    AND EXISTS (
      SELECT 1
      FROM places p
      WHERE p.id = place_photos.place_id
        AND p.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY place_photos_update_own ON place_photos
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = uploaded_by)
  WITH CHECK ((SELECT auth.uid()) = uploaded_by);

CREATE POLICY place_photos_delete_own ON place_photos
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = uploaded_by);
