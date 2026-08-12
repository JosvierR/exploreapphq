-- ============================================================================
-- ROUTE-RATINGS · Valoraciones de rutas (espejo del modelo de reviews de places)
--
-- Las rutas solo se valoran y comentan (sin fotos). Una valoración por usuario y
-- ruta; el creador no se autovalora. Un trigger recalcula routes.average_rating /
-- total_ratings (la app nunca recalcula). RLS: lectura pública, escritura propia
-- por usuario verificado que no sea el creador de la ruta.
-- ============================================================================

-- ─── 1. Columnas agregadas en routes ────────────────────────────────────────
ALTER TABLE routes
  ADD COLUMN average_rating DECIMAL(2, 1) NOT NULL DEFAULT 0.0,
  ADD COLUMN total_ratings  INTEGER       NOT NULL DEFAULT 0;

-- ─── 2. Tabla route_ratings ─────────────────────────────────────────────────
CREATE TABLE route_ratings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id   UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text       TEXT CHECK (char_length(text) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (route_id, user_id)
);

CREATE INDEX idx_route_ratings_route ON route_ratings (route_id);
CREATE INDEX idx_route_ratings_user  ON route_ratings (user_id);

-- ─── 3. Recálculo del rating de la ruta vía trigger ─────────────────────────
-- SECURITY DEFINER: el trigger corre al insertar/editar una valoración por un
-- usuario que NO es el creador de la ruta; el UPDATE de las columnas agregadas
-- debe poder saltarse la RLS solo-creador de routes. Es seguro: solo escribe
-- average_rating/total_ratings derivadas de route_ratings (con su propia RLS).
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

CREATE TRIGGER route_ratings_recalculate_insert AFTER INSERT ON route_ratings
  FOR EACH ROW EXECUTE FUNCTION recalculate_route_rating();
CREATE TRIGGER route_ratings_recalculate_update AFTER UPDATE ON route_ratings
  FOR EACH ROW EXECUTE FUNCTION recalculate_route_rating();
CREATE TRIGGER route_ratings_recalculate_delete AFTER DELETE ON route_ratings
  FOR EACH ROW EXECUTE FUNCTION recalculate_route_rating();

-- ─── 4. RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE route_ratings ENABLE ROW LEVEL SECURITY;

-- SELECT: público (lectura de valoraciones de cualquier ruta).
CREATE POLICY route_ratings_select ON route_ratings
  FOR SELECT TO anon, authenticated
  USING (true);

-- INSERT: el autor, verificado, y NO el creador de la ruta (refuerzo en DB).
CREATE POLICY route_ratings_insert ON route_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid()) AND u.email_verified = true
    )
    AND user_id <> (SELECT created_by FROM routes WHERE id = route_id)
  );

CREATE POLICY route_ratings_update_own ON route_ratings
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY route_ratings_delete_own ON route_ratings
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);
