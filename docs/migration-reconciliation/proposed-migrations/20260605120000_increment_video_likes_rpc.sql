/**
 * RPC: incremento atómico del contador de likes.
 * delta puede ser +1 (like) o -1 (unlike).
 *
 * Reemplaza los triggers likes_count_* para evitar doble conteo cuando el
 * cliente llama insert/delete + esta RPC desde el store.
 */
CREATE OR REPLACE FUNCTION increment_video_likes(
  p_video_id UUID,
  p_delta    INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE videos
  SET total_likes = GREATEST(total_likes + p_delta, 0),
      updated_at  = now()
  WHERE id = p_video_id;
END;
$$;

REVOKE ALL ON FUNCTION increment_video_likes(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_video_likes(UUID, INT) TO authenticated;

DROP TRIGGER IF EXISTS likes_count_insert ON likes;
DROP TRIGGER IF EXISTS likes_count_delete ON likes;
