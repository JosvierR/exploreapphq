-- EXPLORE-234 (follow-up P1): atomic reorder of place photo positions.
-- Replaces the per-row UPDATE loop in the repository so a partial failure can
-- never leave the gallery in an inconsistent order. SECURITY INVOKER keeps the
-- caller's RLS in force (only the creator/moderator can update these rows).

CREATE OR REPLACE FUNCTION reorder_place_photos(
  p_ids       UUID[],
  p_positions INT[]
)
RETURNS VOID
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  UPDATE place_photos AS pp
  SET position = v.position
  FROM unnest(p_ids, p_positions) AS v(id, position)
  WHERE pp.id = v.id;
$$;

GRANT EXECUTE ON FUNCTION reorder_place_photos(UUID[], INT[]) TO authenticated;
