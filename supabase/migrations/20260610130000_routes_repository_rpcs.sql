-- EXPLORE-168 · RPCs para routes.repository (set_route_places, reassign_route_place)

CREATE OR REPLACE FUNCTION set_route_places(p_route_id UUID, p_place_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM routes
    WHERE id = p_route_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to update route places';
  END IF;

  DELETE FROM route_places WHERE route_id = p_route_id;

  IF p_place_ids IS NOT NULL AND array_length(p_place_ids, 1) > 0 THEN
    INSERT INTO route_places (route_id, place_id, position)
    SELECT p_route_id, place_id, ord - 1
    FROM unnest(p_place_ids) WITH ORDINALITY AS t(place_id, ord);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION reassign_route_place(p_from UUID, p_to UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE route_places
  SET place_id = p_to
  WHERE place_id = p_from
    AND NOT EXISTS (
      SELECT 1 FROM route_places rp2
      WHERE rp2.route_id = route_places.route_id
        AND rp2.place_id = p_to
    );
END;
$$;

REVOKE ALL ON FUNCTION set_route_places(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_route_places(UUID, UUID[]) TO authenticated;

REVOKE ALL ON FUNCTION reassign_route_place(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reassign_route_place(UUID, UUID) TO authenticated;
