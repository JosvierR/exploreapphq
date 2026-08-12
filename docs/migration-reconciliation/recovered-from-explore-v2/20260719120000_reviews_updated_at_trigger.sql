-- ============================================================================
-- EXPLORE-288 · reviews.updated_at — trigger server-side + reload schema cache
--
-- Editar una reseña fallaba en producción con PGRST204:
--   "Could not find the 'updated_at' column of 'reviews' in the schema cache"
--
-- La tabla `ratings` se creó con `updated_at` (00003) y se renombró a `reviews`
-- (20260612), pero NUNCA tuvo un trigger que la mantuviera — el cliente la
-- enviaba a mano en el UPDATE. En producción PostgREST no ve esa columna (cache
-- desactualizado tras el rename), así que el PATCH la rechaza (400) antes de
-- llegar a Postgres. El INSERT no la envía → crear sí funcionaba.
--
-- Solución: garantizar la columna, mantenerla con el trigger estándar
-- update_updated_at() (como places/users/routes) y recargar el schema cache de
-- PostgREST. El cliente deja de enviar `updated_at` (lo pone el trigger).
-- ============================================================================

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS reviews_updated_at ON reviews;
CREATE TRIGGER reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Fuerza a PostgREST a releer el esquema (elimina el PGRST204 por cache viejo).
NOTIFY pgrst, 'reload schema';
