-- EXPLORE-200 — Reafirma la política RLS de lectura de videos tras añadir 'draft'.
--
-- Esta migración va en archivo aparte porque la anterior (ADD VALUE) debe
-- confirmarse antes de poder referenciar 'draft' en una sentencia.
--
-- Política de lectura: un video es visible si está publicado O si el usuario
-- autenticado es su creador. Esto cubre 'draft', 'private', 'processing' y
-- 'reported': ninguno es visible para terceros, solo para el creador.
-- Se recrea de forma idempotente para dejar explícita la intención del ticket.

DROP POLICY IF EXISTS videos_select ON videos;

CREATE POLICY videos_select ON videos FOR SELECT TO authenticated
  USING (
    (state = 'published'::video_state)
    OR (created_by = (select auth.uid()))
  );
