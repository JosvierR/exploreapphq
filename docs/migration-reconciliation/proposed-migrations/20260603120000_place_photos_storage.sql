-- Storage RLS for place-photos bucket (local + prod).
-- Required for authenticated users to upload photos when creating a place.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'place-photos',
  'place-photos',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS place_photos_storage_select ON storage.objects;
DROP POLICY IF EXISTS place_photos_storage_insert ON storage.objects;
DROP POLICY IF EXISTS place_photos_storage_update ON storage.objects;
DROP POLICY IF EXISTS place_photos_storage_delete ON storage.objects;

CREATE POLICY place_photos_storage_select ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'place-photos');

CREATE POLICY place_photos_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'place-photos'
    AND (storage.foldername(name))[1] = 'places'
  );

CREATE POLICY place_photos_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'place-photos' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'place-photos');

CREATE POLICY place_photos_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'place-photos' AND owner = auth.uid());
