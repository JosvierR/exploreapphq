-- ============================================================================
-- 00004_create_routes.sql
-- Domain: Routes
-- Tables: routes, route_segments, route_places, route_participants
-- Also: FK favorites.route_id → routes.id
-- ============================================================================

CREATE TYPE route_category AS ENUM (
  'hiking', 'urban', 'gastronomic', 'cycling', 'other'
);

CREATE TYPE route_difficulty AS ENUM (
  'easy', 'moderate', 'hard', 'expert'
);

CREATE TYPE route_state AS ENUM (
  'recording', 'draft', 'published', 'deleted'
);

CREATE TYPE route_transport AS ENUM (
  'walking', 'running', 'cycling', 'driving', 'motorcycle', 'mixed', 'other'
);

-- ─── ROUTES ─────────────────────────────────────────────────────────────────

CREATE TABLE routes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT,
  description        TEXT,
  path               GEOGRAPHY(LineString, 4326),
  distance_meters    DECIMAL,
  estimated_duration INTERVAL,
  elevation_gain     DECIMAL,
  category           route_category,
  difficulty         route_difficulty,
  transport          route_transport,
  is_public          BOOLEAN NOT NULL DEFAULT true,
  forked_from        UUID REFERENCES routes(id) ON DELETE SET NULL,
  created_by         UUID NOT NULL REFERENCES users(id),
  state              route_state NOT NULL DEFAULT 'recording',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_routes_path ON routes USING GIST (path) WHERE path IS NOT NULL;
CREATE INDEX idx_routes_published ON routes (state, is_public) WHERE state = 'published';
CREATE INDEX idx_routes_created_by ON routes (created_by);
CREATE INDEX idx_routes_forked_from ON routes (forked_from) WHERE forked_from IS NOT NULL;
CREATE INDEX idx_routes_transport ON routes (transport) WHERE state = 'published';

CREATE UNIQUE INDEX idx_routes_one_recording_per_user
  ON routes (created_by)
  WHERE state = 'recording';

CREATE TRIGGER routes_updated_at
  BEFORE UPDATE ON routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- FK diferida: favorites.route_id → routes.id
ALTER TABLE favorites
  ADD CONSTRAINT fk_favorites_route
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE;

-- ─── ROUTE SEGMENTS ─────────────────────────────────────────────────────────

CREATE TABLE route_segments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id   UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  points     JSONB NOT NULL,
  seg_order  INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (route_id, seg_order)
);

CREATE INDEX idx_segments_route ON route_segments (route_id);

-- ─── ROUTE PLACES ───────────────────────────────────────────────────────────

CREATE TABLE route_places (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id  UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  place_id  UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  pl_order  INTEGER NOT NULL,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (route_id, place_id)
);

CREATE INDEX idx_route_places_route ON route_places (route_id);
CREATE INDEX idx_route_places_place ON route_places (place_id);

-- ─── ROUTE PARTICIPANTS ─────────────────────────────────────────────────────

CREATE TABLE route_participants (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id  UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at   TIMESTAMPTZ,
  UNIQUE (route_id, user_id)
);

CREATE INDEX idx_participants_route ON route_participants (route_id);
CREATE INDEX idx_participants_user ON route_participants (user_id);

-- ─── FUNCTION: Consolidar segmentos ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION consolidate_route_segments(target_route_id UUID)
RETURNS void AS $$
DECLARE
  all_points JSONB;
  line_wkt TEXT;
  point JSONB;
  total_elevation DECIMAL := 0;
  prev_alt DECIMAL;
  curr_alt DECIMAL;
BEGIN
  SELECT jsonb_agg(p ORDER BY s.seg_order, ordinality)
  INTO all_points
  FROM route_segments s,
       jsonb_array_elements(s.points) WITH ORDINALITY AS p(value, ordinality)
  WHERE s.route_id = target_route_id;

  IF all_points IS NULL OR jsonb_array_length(all_points) < 2 THEN
    RETURN;
  END IF;

  line_wkt := 'LINESTRING(';
  FOR i IN 0..jsonb_array_length(all_points) - 1 LOOP
    point := all_points->i;
    IF i > 0 THEN line_wkt := line_wkt || ', '; END IF;
    line_wkt := line_wkt || (point->>'lng') || ' ' || (point->>'lat');
    curr_alt := (point->>'alt')::DECIMAL;
    IF prev_alt IS NOT NULL AND curr_alt > prev_alt THEN
      total_elevation := total_elevation + (curr_alt - prev_alt);
    END IF;
    prev_alt := curr_alt;
  END LOOP;
  line_wkt := line_wkt || ')';

  UPDATE routes SET
    path = ST_GeogFromText(line_wkt),
    distance_meters = ST_Length(ST_GeogFromText(line_wkt)),
    elevation_gain = total_elevation,
    state = 'draft'
  WHERE id = target_route_id;
END;
$$ LANGUAGE plpgsql
SET search_path = 'public';

-- ─── FUNCTION: Simplificar con RDP ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION simplify_route_path(target_route_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE routes SET
    path = ST_Simplify(path::geometry, 0.00005)::geography
  WHERE id = target_route_id
    AND path IS NOT NULL;
END;
$$ LANGUAGE plpgsql
SET search_path = 'public';
