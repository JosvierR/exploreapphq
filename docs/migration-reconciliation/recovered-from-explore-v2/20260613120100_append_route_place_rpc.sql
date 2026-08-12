-- EXPLORE-180 · append_route_place — vincular un lugar al final de una ruta en grabación

CREATE OR REPLACE FUNCTION append_route_place(p_route_id UUID, p_place_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_pos INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM routes
    WHERE id = p_route_id
      AND created_by = auth.uid()
      AND state = 'recording'
  ) THEN
    RAISE EXCEPTION 'Not authorized to append place to this route';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM places
    WHERE id = p_place_id AND state <> 'deleted'
  ) THEN
    RAISE EXCEPTION 'Place not found';
  END IF;

  SELECT COALESCE(MAX(position) + 1, 0) INTO next_pos
  FROM route_places
  WHERE route_id = p_route_id;

  INSERT INTO route_places (route_id, place_id, position)
  VALUES (p_route_id, p_place_id, next_pos)
  ON CONFLICT (route_id, place_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION append_route_place(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION append_route_place(UUID, UUID) TO authenticated;
