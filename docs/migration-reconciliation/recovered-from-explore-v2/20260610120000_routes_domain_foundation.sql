-- ============================================================
-- ROUTE-01-A · EXPLORE-166 — Fundación del dominio Routes
-- Evoluciona el esquema de 00004 al modelo ROUTE-01-A.
-- Requiere: extensión postgis (00001) y places (00003+).
-- ============================================================

-- ─── 1. Limpiar políticas y objetos legacy ───────────────────────────────────

DROP POLICY IF EXISTS routes_select ON routes;
DROP POLICY IF EXISTS routes_insert ON routes;
DROP POLICY IF EXISTS routes_update_own ON routes;
DROP POLICY IF EXISTS routes_delete_own ON routes;

DROP POLICY IF EXISTS segments_select_route_owner ON route_segments;
DROP POLICY IF EXISTS segments_insert_route_owner ON route_segments;
DROP POLICY IF EXISTS segments_delete_route_owner ON route_segments;

DROP POLICY IF EXISTS route_places_select ON route_places;
DROP POLICY IF EXISTS route_places_insert_owner ON route_places;

DROP POLICY IF EXISTS participants_select ON route_participants;
DROP POLICY IF EXISTS participants_insert_self ON route_participants;
DROP POLICY IF EXISTS participants_update_self ON route_participants;

DROP FUNCTION IF EXISTS consolidate_route_segments(UUID);
DROP FUNCTION IF EXISTS simplify_route_path(UUID);

DROP TABLE IF EXISTS route_participants;

-- ─── 2. ENUM route_category (gastronomic → gastronomy, +nature) ──────────────

CREATE TYPE route_category_new AS ENUM (
  'hiking', 'urban', 'gastronomy', 'cycling', 'nature', 'other'
);

ALTER TABLE routes
  ALTER COLUMN category DROP DEFAULT;

ALTER TABLE routes
  ALTER COLUMN category TYPE route_category_new
  USING (
    CASE category::text
      WHEN 'gastronomic' THEN 'gastronomy'::route_category_new
      WHEN 'hiking'      THEN 'hiking'::route_category_new
      WHEN 'urban'       THEN 'urban'::route_category_new
      WHEN 'cycling'     THEN 'cycling'::route_category_new
      WHEN 'other'       THEN 'other'::route_category_new
      ELSE 'other'::route_category_new
    END
  );

DROP TYPE route_category;
ALTER TYPE route_category_new RENAME TO route_category;

ALTER TABLE routes
  ALTER COLUMN category SET DEFAULT 'other',
  ALTER COLUMN category SET NOT NULL;

-- route_difficulty y route_state ya coinciden con ROUTE-01-A

-- ─── 3. Tabla routes (columnas e índices) ────────────────────────────────────

ALTER TABLE routes DROP COLUMN IF EXISTS transport;
DROP TYPE IF EXISTS route_transport;

ALTER TABLE routes RENAME COLUMN distance_meters TO distance_m;
ALTER TABLE routes RENAME COLUMN forked_from TO fork_of;

UPDATE routes SET name = 'Unnamed' WHERE name IS NULL OR char_length(trim(name)) < 2;
UPDATE routes SET distance_m = 0 WHERE distance_m IS NULL;
UPDATE routes SET elevation_gain = 0 WHERE elevation_gain IS NULL;
UPDATE routes SET category = 'other' WHERE category IS NULL;
UPDATE routes SET difficulty = 'easy' WHERE difficulty IS NULL;

ALTER TABLE routes
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN distance_m SET NOT NULL,
  ALTER COLUMN distance_m SET DEFAULT 0,
  ALTER COLUMN elevation_gain SET NOT NULL,
  ALTER COLUMN elevation_gain SET DEFAULT 0,
  ALTER COLUMN difficulty SET NOT NULL,
  ALTER COLUMN difficulty SET DEFAULT 'easy',
  ALTER COLUMN is_public SET DEFAULT false;

ALTER TABLE routes
  ADD CONSTRAINT routes_name_min_length CHECK (char_length(name) >= 2);

ALTER TABLE routes DROP CONSTRAINT IF EXISTS routes_created_by_fkey;
ALTER TABLE routes
  ADD CONSTRAINT routes_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS idx_routes_one_recording_per_user;
DROP INDEX IF EXISTS idx_routes_forked_from;
DROP INDEX IF EXISTS idx_routes_transport;
DROP INDEX IF EXISTS idx_routes_published;
DROP INDEX IF EXISTS idx_routes_path;

CREATE INDEX idx_routes_path ON routes USING GIST (path);
CREATE INDEX idx_routes_state ON routes (state);
CREATE INDEX idx_routes_public ON routes (is_public) WHERE state = 'published';

-- Reutiliza update_updated_at() de 00001 (trigger ya existe como routes_updated_at)

-- ─── 4. route_places → PK compuesta + position única ─────────────────────────

CREATE TABLE route_places_new (
  route_id  UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  place_id  UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL,
  PRIMARY KEY (route_id, place_id)
);

INSERT INTO route_places_new (route_id, place_id, position)
SELECT route_id, place_id, pl_order
FROM route_places;

DROP TABLE route_places;
ALTER TABLE route_places_new RENAME TO route_places;

CREATE INDEX idx_route_places_route ON route_places (route_id, position);
CREATE INDEX idx_route_places_place ON route_places (place_id);
CREATE UNIQUE INDEX idx_route_places_position ON route_places (route_id, position);

-- ─── 5. route_segments → gps_segments ────────────────────────────────────────

ALTER TABLE route_segments RENAME TO gps_segments;
ALTER TABLE gps_segments RENAME COLUMN seg_order TO "order";

DROP INDEX IF EXISTS idx_segments_route;
CREATE INDEX idx_gps_segments_route ON gps_segments (route_id, "order");

-- ─── 6. RLS — Routes (anon puede ver published + public) ─────────────────────

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY routes_select_public ON routes
  FOR SELECT USING (state = 'published' AND is_public = true);

CREATE POLICY routes_select_own ON routes
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY routes_insert_own ON routes
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY routes_update_own ON routes
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY routes_delete_own ON routes
  FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY route_places_select ON route_places
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM routes r
      WHERE r.id = route_places.route_id
        AND (r.created_by = auth.uid()
             OR (r.state = 'published' AND r.is_public = true))
    )
  );

CREATE POLICY route_places_write_own ON route_places
  FOR ALL USING (
    EXISTS (SELECT 1 FROM routes r WHERE r.id = route_places.route_id AND r.created_by = auth.uid())
  );

CREATE POLICY gps_segments_own ON gps_segments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM routes r WHERE r.id = gps_segments.route_id AND r.created_by = auth.uid())
  );

-- route_places visible para rutas públicas vía RLS (revocado en 00006 para anon)
GRANT SELECT ON public.route_places TO anon;

-- gps_segments permanece privado para anon
REVOKE ALL ON public.gps_segments FROM anon;
