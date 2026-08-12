-- Producción puede tener drift de columnas legacy en routes / route_ratings.
-- En emulador/local ya están normalizadas por 20260610120000 y 20260623140000.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'routes'
      AND column_name = 'distance_meters'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'routes'
      AND column_name = 'distance_m'
  ) THEN
    ALTER TABLE routes RENAME COLUMN distance_meters TO distance_m;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'routes'
      AND column_name = 'forked_from'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'routes'
      AND column_name = 'fork_of'
  ) THEN
    ALTER TABLE routes RENAME COLUMN forked_from TO fork_of;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'route_ratings'
      AND column_name = 'score'
  ) THEN
    ALTER TABLE route_ratings RENAME COLUMN score TO rating;
  END IF;
END $$;

-- Columnas agregadas por 20260623140000; no-op si ya existen.
ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS average_rating DECIMAL(2, 1) NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS total_ratings  INTEGER       NOT NULL DEFAULT 0;
