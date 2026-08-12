-- Elimina la sobrecarga obsoleta de videos_within_radius (5 parámetros).
-- CREATE OR REPLACE en 20260528120000 NO la reemplazó porque cambió la firma
-- (añadió uid_param + exclude_seen_since), dejando dos overloads → PGRST203.
-- Conserva únicamente la versión de 7 parámetros.
DROP FUNCTION IF EXISTS public.videos_within_radius(
  double precision, double precision, double precision, integer, timestamp with time zone
);
