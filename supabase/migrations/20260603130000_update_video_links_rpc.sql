/**
 * RPC: update_video_links
 * Actualiza place_ids y route_id de un video de forma atómica.
 * DELETE + INSERT en video_places en una sola transacción.
 */
CREATE OR REPLACE FUNCTION update_video_links(
  p_video_id  UUID,
  p_place_ids UUID[],
  p_route_id  UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM videos
    WHERE id = p_video_id
      AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to update this video';
  END IF;

  IF (
    p_place_ids IS NULL
    OR array_length(p_place_ids, 1) IS NULL
    OR array_length(p_place_ids, 1) = 0
  ) AND p_route_id IS NULL THEN
    RAISE EXCEPTION 'Video must be linked to at least one place or a route';
  END IF;

  UPDATE videos
  SET route_id   = p_route_id,
      updated_at = now()
  WHERE id = p_video_id;

  DELETE FROM video_places WHERE video_id = p_video_id;

  IF array_length(p_place_ids, 1) > 0 THEN
    INSERT INTO video_places (video_id, place_id)
    SELECT p_video_id, unnest(p_place_ids);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION update_video_links(UUID, UUID[], UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_video_links(UUID, UUID[], UUID) TO authenticated;
