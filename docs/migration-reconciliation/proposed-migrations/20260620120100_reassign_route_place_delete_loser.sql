-- ROUTE-01-A - complete reassign_route_place by deleting loser links.

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

  DELETE FROM route_places
  WHERE place_id = p_from;
END;
$$;

REVOKE ALL ON FUNCTION reassign_route_place(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reassign_route_place(UUID, UUID) TO authenticated;
