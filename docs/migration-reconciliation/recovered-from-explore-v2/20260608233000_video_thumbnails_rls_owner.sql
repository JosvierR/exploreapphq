-- Tighten video thumbnail writes to the owner of the matching videos row.

DROP POLICY IF EXISTS video_thumbnails_storage_insert ON storage.objects;
DROP POLICY IF EXISTS video_thumbnails_storage_update ON storage.objects;
DROP POLICY IF EXISTS video_thumbnails_storage_delete ON storage.objects;

CREATE POLICY video_thumbnails_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'video-thumbnails'
    AND EXISTS (
      SELECT 1
      FROM public.videos v
      WHERE v.id::text = split_part(name, '.', 1)
        AND name = v.id::text || '.jpg'
        AND v.created_by = auth.uid()
    )
  );

CREATE POLICY video_thumbnails_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'video-thumbnails'
    AND EXISTS (
      SELECT 1
      FROM public.videos v
      WHERE v.id::text = split_part(name, '.', 1)
        AND name = v.id::text || '.jpg'
        AND v.created_by = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'video-thumbnails'
    AND EXISTS (
      SELECT 1
      FROM public.videos v
      WHERE v.id::text = split_part(name, '.', 1)
        AND name = v.id::text || '.jpg'
        AND v.created_by = auth.uid()
    )
  );

CREATE POLICY video_thumbnails_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'video-thumbnails'
    AND EXISTS (
      SELECT 1
      FROM public.videos v
      WHERE v.id::text = split_part(name, '.', 1)
        AND name = v.id::text || '.jpg'
        AND v.created_by = auth.uid()
    )
  );
