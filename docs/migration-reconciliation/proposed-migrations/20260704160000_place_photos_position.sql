-- EXPLORE-234: explicit gallery order for place photos (creator-controlled).

ALTER TABLE place_photos
  ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY place_id ORDER BY created_at ASC) - 1 AS rn
  FROM place_photos
)
UPDATE place_photos AS pp
SET position = ranked.rn
FROM ranked
WHERE pp.id = ranked.id;

CREATE INDEX IF NOT EXISTS idx_place_photos_place_position
  ON place_photos (place_id, position);
