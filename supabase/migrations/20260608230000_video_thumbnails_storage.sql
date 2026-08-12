-- Thumbnails custom elegidos en el trimmer (EXPLORE-165).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video-thumbnails',
  'video-thumbnails',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS video_thumbnails_storage_select ON storage.objects;
DROP POLICY IF EXISTS video_thumbnails_storage_insert ON storage.objects;
DROP POLICY IF EXISTS video_thumbnails_storage_update ON storage.objects;
DROP POLICY IF EXISTS video_thumbnails_storage_delete ON storage.objects;

CREATE POLICY video_thumbnails_storage_select ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'video-thumbnails');

CREATE POLICY video_thumbnails_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'video-thumbnails');

CREATE POLICY video_thumbnails_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'video-thumbnails' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'video-thumbnails');

CREATE POLICY video_thumbnails_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'video-thumbnails' AND owner = auth.uid());
