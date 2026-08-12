-- ============================================================================
-- 00003_create_places.sql
-- Domain: Places
-- Tables: places, ratings
-- Also: FK favorites.place_id → places.id
-- ============================================================================

CREATE TYPE place_category AS ENUM (
  'hiking', 'gastronomy', 'beach', 'urban', 'nature', 'other'
);

CREATE TYPE place_state AS ENUM (
  'draft', 'published', 'reported', 'deleted'
);

CREATE TABLE places (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL CHECK (char_length(name) >= 2),
  description     TEXT,
  location        GEOGRAPHY(Point, 4326) NOT NULL,
  category        place_category NOT NULL DEFAULT 'other',
  average_rating  DECIMAL(2,1) NOT NULL DEFAULT 0.0,
  total_ratings   INTEGER NOT NULL DEFAULT 0,
  created_by      UUID NOT NULL REFERENCES users(id),
  state           place_state NOT NULL DEFAULT 'draft',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_places_location ON places USING GIST (location);
CREATE INDEX idx_places_state ON places (state) WHERE state = 'published';
CREATE INDEX idx_places_created_by ON places (created_by);
CREATE INDEX idx_places_category_state ON places (category, state) WHERE state = 'published';

CREATE TRIGGER places_updated_at
  BEFORE UPDATE ON places
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- FK diferida: favorites.place_id → places.id
ALTER TABLE favorites
  ADD CONSTRAINT fk_favorites_place
  FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE;

-- ─── RATINGS ────────────────────────────────────────────────────────────────

CREATE TABLE ratings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id   UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (place_id, user_id)
);

CREATE INDEX idx_ratings_place ON ratings (place_id);
CREATE INDEX idx_ratings_user ON ratings (user_id);

CREATE OR REPLACE FUNCTION recalculate_place_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_place_id UUID;
BEGIN
  target_place_id := COALESCE(NEW.place_id, OLD.place_id);
  UPDATE places SET
    average_rating = COALESCE(
      (SELECT ROUND(AVG(rating)::numeric, 1) FROM ratings WHERE place_id = target_place_id),
      0.0
    ),
    total_ratings = (SELECT COUNT(*) FROM ratings WHERE place_id = target_place_id)
  WHERE id = target_place_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SET search_path = 'public';

CREATE TRIGGER ratings_recalculate_insert AFTER INSERT ON ratings
  FOR EACH ROW EXECUTE FUNCTION recalculate_place_rating();
CREATE TRIGGER ratings_recalculate_update AFTER UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION recalculate_place_rating();
CREATE TRIGGER ratings_recalculate_delete AFTER DELETE ON ratings
  FOR EACH ROW EXECUTE FUNCTION recalculate_place_rating();
