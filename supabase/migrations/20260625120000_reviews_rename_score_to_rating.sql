-- Producción tenía reviews.score en lugar de reviews.rating.
-- En emulador/local la columna ya es rating (viene de ratings.rating).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'score'
  ) THEN
    ALTER TABLE reviews RENAME COLUMN score TO rating;
  END IF;
END $$;
