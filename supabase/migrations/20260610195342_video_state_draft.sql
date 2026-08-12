-- EXPLORE-200 — Añade el estado 'draft' al enum video_state.
--
-- 'draft' representa un video que el creador guardó pero todavía no publicó.
-- Solo el creador puede verlo (lo garantiza la política RLS videos_select, que
-- ya restringe cualquier state distinto de 'published' a created_by = auth.uid()).
--
-- IMPORTANTE: `ALTER TYPE ... ADD VALUE` no puede ejecutarse en la misma
-- transacción que una sentencia que use el nuevo valor. Por eso este archivo
-- solo añade el valor; la reafirmación de la política RLS vive en la siguiente
-- migración (20260610195500_video_state_draft_rls.sql).

ALTER TYPE video_state ADD VALUE IF NOT EXISTS 'draft';
