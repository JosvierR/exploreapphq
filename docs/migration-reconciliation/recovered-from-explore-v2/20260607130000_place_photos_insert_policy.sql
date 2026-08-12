-- Fix place_photos INSERT policy to allow any authenticated user to contribute
-- photos to published places (not just the place creator).
-- EXPLORE-150: add-photo-to-place.

DROP POLICY IF EXISTS place_photos_insert ON place_photos;

CREATE POLICY place_photos_insert ON place_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = uploaded_by
    AND EXISTS (
      SELECT 1
      FROM places p
      WHERE p.id = place_photos.place_id
        AND (
          p.created_by = (SELECT auth.uid())
          OR p.state = 'published'::place_state
        )
    )
  );
