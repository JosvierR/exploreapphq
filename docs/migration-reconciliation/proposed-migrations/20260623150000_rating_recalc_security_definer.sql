-- ============================================================================
-- Fix RLS en los triggers de recálculo de rating (places y routes).
--
-- Una reseña/valoración la crea SIEMPRE alguien que NO es el creador del lugar/ruta
-- (el creador no se autovalora). El trigger de recálculo hace UPDATE de las columnas
-- agregadas (average_rating/total_ratings), pero la RLS de UPDATE de places/routes es
-- solo-creador, así que el UPDATE del trigger fallaba con 42501 para el reseñador.
--
-- Solución estándar: las funciones de recálculo corren como SECURITY DEFINER, de modo
-- que el UPDATE de columnas calculadas se salta la RLS solo-creador. Es seguro: solo
-- escriben agregados derivados de reviews/route_ratings (que tienen su propia RLS) y
-- fijan search_path = public.
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_place_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_place_id UUID;
BEGIN
  target_place_id := COALESCE(NEW.place_id, OLD.place_id);
  UPDATE places SET
    average_rating = COALESCE(
      (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE place_id = target_place_id),
      0.0
    ),
    total_ratings = (SELECT COUNT(*) FROM reviews WHERE place_id = target_place_id)
  WHERE id = target_place_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public';

CREATE OR REPLACE FUNCTION recalculate_route_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_route_id UUID;
BEGIN
  target_route_id := COALESCE(NEW.route_id, OLD.route_id);
  UPDATE routes SET
    average_rating = COALESCE(
      (SELECT ROUND(AVG(rating)::numeric, 1) FROM route_ratings WHERE route_id = target_route_id),
      0.0
    ),
    total_ratings = (SELECT COUNT(*) FROM route_ratings WHERE route_id = target_route_id)
  WHERE id = target_route_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public';
