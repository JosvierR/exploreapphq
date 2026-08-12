-- ============================================================================
-- EXPLORE-XX · content_reports table + place_photos report/withdraw policies
-- Cierra el ciclo de vida de fotos: retirar lo propio, reportar lo ajeno.
-- ============================================================================

-- ─── TABLE: content_reports ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_reports (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT        NOT NULL,   -- 'place_photo', 'place', 'video', etc.
  content_id   UUID        NOT NULL,
  reported_by  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason       TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_reports_content
  ON content_reports (content_type, content_id);

CREATE INDEX IF NOT EXISTS idx_content_reports_reporter
  ON content_reports (reported_by);

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

-- Solo el reportador puede insertar su propio reporte.
CREATE POLICY content_reports_insert ON content_reports
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = reported_by);

-- Moderadores (role check futuro) o el propio reportador pueden leer sus reportes.
-- Por ahora solo el propio usuario puede leer los suyos.
CREATE POLICY content_reports_select ON content_reports
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = reported_by);

-- ─── RLS: place_photos — políticas de retirada y reporte ───────────────────
-- Se redefinen ambas políticas de UPDATE juntas (DROP + CREATE) para garantizar
-- un estado limpio. El emulador puede quedar inconsistente si se añaden políticas
-- en migraciones separadas sin redefinir las existentes.

DROP POLICY IF EXISTS place_photos_update_own    ON place_photos;
DROP POLICY IF EXISTS place_photos_update_report ON place_photos;

-- El uploader puede retirar su propia foto (state → 'withdrawn').
CREATE POLICY place_photos_update_own ON place_photos
  FOR UPDATE TO authenticated
  USING  ((SELECT auth.uid()) = uploaded_by)
  WITH CHECK (
    (SELECT auth.uid()) = uploaded_by
    AND state = 'withdrawn'
  );

-- Cualquier usuario autenticado puede reportar una foto ajena (state → 'reported').
-- La validación de negocio (canReportPhoto) ocurre en el store.
CREATE POLICY place_photos_update_report ON place_photos
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND uploaded_by != (SELECT auth.uid())
  )
  WITH CHECK (state = 'reported');

-- ─── RPC: withdraw_own_photo ────────────────────────────────────────────────
-- PostgREST hace un RETURNING implícito tras el UPDATE, que pasa por el SELECT
-- policy (state = 'active'). La foto recién retirada tiene state = 'withdrawn',
-- falla el SELECT policy y Supabase lanza 42501.
-- Solución: función SECURITY DEFINER que ejecuta el UPDATE sin pasar por RLS.
-- El ownership se valida dentro: uploaded_by = auth.uid().

CREATE OR REPLACE FUNCTION withdraw_own_photo(photo_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE place_photos
  SET state = 'withdrawn'
  WHERE id = photo_id
    AND uploaded_by = auth.uid()
    AND state = 'active';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION withdraw_own_photo(UUID) TO authenticated;
