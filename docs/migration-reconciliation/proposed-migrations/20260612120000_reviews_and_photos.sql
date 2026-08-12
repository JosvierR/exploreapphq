-- ============================================================================
-- REVIEW-01 · Reviews & Photos — modelo unificado
-- Reemplaza el modelo fragmentado (ratings + fotos sueltas + photo_state).
--
-- Resumen:
--   · ratings  → reviews  (reutiliza la tabla; añade `text`).
--   · place_photos: + review_id (FK→reviews, ON DELETE CASCADE) · − state/ENUM.
--   · places: − photos TEXT[] (histórico, sin uso).
--   · recálculo de rating: trigger sobre reviews (la app nunca recalcula).
--   · RLS: reviews (verified + el creador no se autovalora) · place_photos.
--   · RPCs: soft_delete_place_cascade, delete_own_review (devuelven URLs para
--     que la app limpie Storage; la FK no limpia el bucket).
-- ============================================================================

-- ─── 1. place_photos: retirar políticas y objetos que dependen de `state` ────
-- Se hace ANTES de tocar la columna `state` para que ningún objeto quede
-- referenciando una columna inexistente.

DROP POLICY IF EXISTS place_photos_select        ON place_photos;
DROP POLICY IF EXISTS place_photos_insert        ON place_photos;
DROP POLICY IF EXISTS place_photos_update_own    ON place_photos;
DROP POLICY IF EXISTS place_photos_update_report ON place_photos;
DROP POLICY IF EXISTS place_photos_delete_own    ON place_photos;
DROP POLICY IF EXISTS place_photos_delete        ON place_photos;

DROP FUNCTION IF EXISTS withdraw_own_photo(UUID);

DROP INDEX IF EXISTS idx_place_photos_place_id;   -- era parcial: WHERE state = 'active'

-- ─── 2. ratings → reviews ────────────────────────────────────────────────────
-- Reutiliza la tabla existente (preserva FK place_id ON DELETE CASCADE,
-- UNIQUE(place_id,user_id), CHECK rating 1-5 y el trigger update_updated_at).

ALTER TABLE ratings RENAME TO reviews;

ALTER INDEX IF EXISTS idx_ratings_place RENAME TO idx_reviews_place;
ALTER INDEX IF EXISTS idx_ratings_user  RENAME TO idx_reviews_user;
ALTER TABLE reviews
  RENAME CONSTRAINT ratings_place_id_user_id_key TO reviews_place_id_user_id_key;

ALTER TABLE reviews
  ADD COLUMN text TEXT CHECK (char_length(text) <= 300);
-- Nota: `rating` se mantiene INTEGER con CHECK 1-5 (funcionalmente idéntico a
-- SMALLINT); no se cambia el tipo para no tocar objetos dependientes.

-- ─── 3. Recálculo de rating sobre reviews ────────────────────────────────────
-- El RENAME no actualiza el cuerpo de la función (resuelve `ratings` en runtime),
-- así que se recrea apuntando a `reviews`. Los triggers viejos se reemplazan.

DROP TRIGGER IF EXISTS ratings_recalculate_insert ON reviews;
DROP TRIGGER IF EXISTS ratings_recalculate_update ON reviews;
DROP TRIGGER IF EXISTS ratings_recalculate_delete ON reviews;

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
SET search_path = 'public';

CREATE TRIGGER reviews_recalculate_insert AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION recalculate_place_rating();
CREATE TRIGGER reviews_recalculate_update AFTER UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION recalculate_place_rating();
CREATE TRIGGER reviews_recalculate_delete AFTER DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION recalculate_place_rating();

-- ─── 4. RLS de reviews (reemplaza las viejas de ratings) ─────────────────────

DROP POLICY IF EXISTS ratings_select     ON reviews;
DROP POLICY IF EXISTS ratings_insert     ON reviews;
DROP POLICY IF EXISTS ratings_update_own ON reviews;
DROP POLICY IF EXISTS ratings_delete_own ON reviews;

-- SELECT: público (lectura de reseñas de cualquier lugar).
CREATE POLICY reviews_select ON reviews
  FOR SELECT TO anon, authenticated
  USING (true);

-- INSERT: el autor, verificado, y NO el creador del lugar (refuerzo en DB).
CREATE POLICY reviews_insert ON reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid()) AND u.email_verified = true
    )
    AND user_id <> (SELECT created_by FROM places WHERE id = place_id)
  );

CREATE POLICY reviews_update_own ON reviews
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY reviews_delete_own ON reviews
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ─── 5. place_photos: review_id, drop state, índices ─────────────────────────

-- No se borra ninguna fila: al desaparecer `state`, todas las fotos quedan
-- visibles. Las antiguas 'withdrawn' pasan a ser fotos publicadas normales; las
-- 'reported' siguen visibles hasta que un moderador o el dueño las borre (hard).

ALTER TABLE place_photos
  ADD COLUMN review_id UUID REFERENCES reviews(id) ON DELETE CASCADE;

ALTER TABLE place_photos DROP COLUMN state;
DROP TYPE IF EXISTS photo_state;

CREATE INDEX idx_place_photos_place_id  ON place_photos (place_id);
CREATE INDEX idx_place_photos_review_id ON place_photos (review_id);

-- RLS place_photos
ALTER TABLE place_photos ENABLE ROW LEVEL SECURITY;

-- SELECT: público para lugares publicados (o el creador ve los suyos).
CREATE POLICY place_photos_select ON place_photos
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM places p
      WHERE p.id = place_photos.place_id
        AND (
          p.state = 'published'::place_state
          OR p.created_by = (select auth.uid())
        )
    )
  );

-- INSERT: el uploader, y la foto pertenece a una reseña propia (review_id no nulo)
-- o es del creador del lugar (review_id nulo).
CREATE POLICY place_photos_insert ON place_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = uploaded_by
    AND (
      (
        review_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM reviews r
          WHERE r.id = place_photos.review_id
            AND r.user_id = (select auth.uid())
        )
      )
      OR (
        review_id IS NULL
        AND EXISTS (
          SELECT 1 FROM places p
          WHERE p.id = place_photos.place_id
            AND p.created_by = (select auth.uid())
        )
      )
    )
  );

-- DELETE: el uploader o el creador del lugar (para el borrado total).
CREATE POLICY place_photos_delete ON place_photos
  FOR DELETE TO authenticated
  USING (
    (select auth.uid()) = uploaded_by
    OR EXISTS (
      SELECT 1 FROM places p
      WHERE p.id = place_photos.place_id
        AND p.created_by = (select auth.uid())
    )
  );

-- ─── 6. places: drop columna histórica photos TEXT[] ─────────────────────────

ALTER TABLE places DROP COLUMN IF EXISTS photos;

-- ─── 7. RPC: soft_delete_place_cascade ───────────────────────────────────────
-- Borrado híbrido: soft-delete del lugar (conserva FKs cross-domain + UX de
-- "lugar eliminado") + hard-delete de hijos (reviews/fotos) para liberar
-- Storage. Devuelve las URLs para que la app limpie el bucket.

CREATE OR REPLACE FUNCTION soft_delete_place_cascade(p_place_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := (select auth.uid());
  v_urls TEXT[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM places WHERE id = p_place_id AND created_by = v_uid
  ) THEN
    RAISE EXCEPTION 'DELETE_PLACE_NOT_AUTHORIZED';
  END IF;

  SELECT array_agg(url) INTO v_urls
  FROM place_photos WHERE place_id = p_place_id;

  DELETE FROM reviews      WHERE place_id = p_place_id;  -- cascade arrastra sus fotos
  DELETE FROM place_photos WHERE place_id = p_place_id;  -- fotos del creador (review_id NULL)
  UPDATE places SET state = 'deleted', updated_at = now() WHERE id = p_place_id;

  RETURN COALESCE(v_urls, '{}');
END;
$$;

GRANT EXECUTE ON FUNCTION soft_delete_place_cascade(UUID) TO authenticated;

-- ─── 8. RPC: delete_own_review ───────────────────────────────────────────────
-- Hard-delete de la reseña propia (cascade borra sus place_photos). Devuelve las
-- URLs de sus fotos para limpieza de Storage.

CREATE OR REPLACE FUNCTION delete_own_review(p_review_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := (select auth.uid());
  v_urls TEXT[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM reviews WHERE id = p_review_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'DELETE_REVIEW_NOT_AUTHORIZED';
  END IF;

  SELECT array_agg(url) INTO v_urls
  FROM place_photos WHERE review_id = p_review_id;

  DELETE FROM reviews WHERE id = p_review_id;  -- cascade borra sus place_photos

  RETURN COALESCE(v_urls, '{}');
END;
$$;

GRANT EXECUTE ON FUNCTION delete_own_review(UUID) TO authenticated;

-- ─── 9. Storage: place-photos — insert solo verified; delete uploader o creador ─

DROP POLICY IF EXISTS place_photos_storage_insert ON storage.objects;
DROP POLICY IF EXISTS place_photos_storage_delete ON storage.objects;

CREATE POLICY place_photos_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'place-photos'
    AND (storage.foldername(name))[1] = 'places'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (select auth.uid()) AND u.email_verified = true
    )
  );

-- El path es places/{placeId}/{userId}_{ts}.ext → el segundo segmento de carpeta
-- es el placeId; permitimos borrar al uploader (owner) o al creador del lugar.
CREATE POLICY place_photos_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'place-photos'
    AND (
      owner = (select auth.uid())
      OR EXISTS (
        SELECT 1 FROM places p
        WHERE p.id::text = (storage.foldername(name))[2]
          AND p.created_by = (select auth.uid())
      )
    )
  );
