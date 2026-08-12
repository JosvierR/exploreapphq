-- User profile media + accent color + handle change cooldown.
-- Adds banner_url / accent_color / handle_changed_at to users and a public
-- `user-media` storage bucket (avatars + banners) with owner-scoped RLS.

ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url        TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_color      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS handle_changed_at TIMESTAMPTZ;

-- accent_color is a hex string (validated in detail by domain invariants).
ALTER TABLE users DROP CONSTRAINT IF EXISTS accent_color_format;
ALTER TABLE users ADD CONSTRAINT accent_color_format
  CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$');

-- ── Storage: user-media bucket (avatars + banners) ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-media',
  'user-media',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS user_media_storage_select ON storage.objects;
DROP POLICY IF EXISTS user_media_storage_insert ON storage.objects;
DROP POLICY IF EXISTS user_media_storage_update ON storage.objects;
DROP POLICY IF EXISTS user_media_storage_delete ON storage.objects;

-- Public read (avatars/banners are public).
CREATE POLICY user_media_storage_select ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'user-media');

-- Users may only write inside their own `{uid}/...` folder.
CREATE POLICY user_media_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY user_media_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'user-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY user_media_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'user-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
