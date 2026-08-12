-- ============================================================================
-- 20260525_community_domain.sql
-- Domain: Community
-- Complete the Community schema incrementally from the existing dev baseline.
--
-- Notes:
-- - videos, likes, comments, and followers already exist in previous migrations.
-- - videos.place_id is kept temporarily for backward compatibility while the
--   new canonical relation moves to video_places.
-- ============================================================================

-- ─── VIDEOS ───────────────────────────────────────────────────────────────────

ALTER TYPE video_state ADD VALUE IF NOT EXISTS 'private';

-- Backfill legacy nullable rows before enforcing the stricter contract.
UPDATE videos
SET video_url = COALESCE(
  video_url,
  thumbnail_url,
  'legacy://missing-video/' || id::text
)
WHERE video_url IS NULL;

UPDATE videos
SET duration_seconds = 5
WHERE duration_seconds IS NULL;

ALTER TABLE videos
  ALTER COLUMN video_url SET NOT NULL;

ALTER TABLE videos
  ALTER COLUMN duration_seconds SET NOT NULL;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_videos_state ON videos(state);

ALTER TABLE videos
  DROP CONSTRAINT IF EXISTS feed_requires_description;

DROP TRIGGER IF EXISTS videos_updated_at ON videos;

CREATE TRIGGER videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON COLUMN videos.place_id IS
  'Compatibility mirror. video_places is canonical; this column is auto-synced for legacy reads/writes.';

-- ─── VIDEO PLACES ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS video_places (
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_video_places_place_id
  ON video_places(place_id);

INSERT INTO video_places (video_id, place_id)
SELECT id, place_id
FROM videos
WHERE place_id IS NOT NULL
ON CONFLICT (video_id, place_id) DO NOTHING;

CREATE OR REPLACE FUNCTION sync_video_places_from_videos_place_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.place_id IS NOT NULL THEN
    INSERT INTO video_places (video_id, place_id)
    VALUES (NEW.id, NEW.place_id)
    ON CONFLICT (video_id, place_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = 'public';

CREATE OR REPLACE FUNCTION sync_videos_place_id_from_video_places()
RETURNS TRIGGER AS $$
DECLARE
  target_video_id UUID;
BEGIN
  target_video_id := COALESCE(NEW.video_id, OLD.video_id);

  UPDATE videos
  SET place_id = (
    SELECT vp.place_id
    FROM video_places vp
    WHERE vp.video_id = target_video_id
    ORDER BY vp.place_id
    LIMIT 1
  )
  WHERE id = target_video_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SET search_path = 'public';

DROP TRIGGER IF EXISTS sync_video_places_from_videos_place_id_insert ON videos;
DROP TRIGGER IF EXISTS sync_video_places_from_videos_place_id_update ON videos;
DROP TRIGGER IF EXISTS sync_videos_place_id_from_video_places_insert ON video_places;
DROP TRIGGER IF EXISTS sync_videos_place_id_from_video_places_delete ON video_places;

CREATE TRIGGER sync_video_places_from_videos_place_id_insert
  AFTER INSERT ON videos
  FOR EACH ROW EXECUTE FUNCTION sync_video_places_from_videos_place_id();

CREATE TRIGGER sync_video_places_from_videos_place_id_update
  AFTER UPDATE OF place_id ON videos
  FOR EACH ROW EXECUTE FUNCTION sync_video_places_from_videos_place_id();

CREATE TRIGGER sync_videos_place_id_from_video_places_insert
  AFTER INSERT ON video_places
  FOR EACH ROW EXECUTE FUNCTION sync_videos_place_id_from_video_places();

CREATE TRIGGER sync_videos_place_id_from_video_places_delete
  AFTER DELETE ON video_places
  FOR EACH ROW EXECUTE FUNCTION sync_videos_place_id_from_video_places();

-- ─── COMMENTS ────────────────────────────────────────────────────────────────

ALTER TABLE comments
  DROP CONSTRAINT IF EXISTS comments_parent_id_fkey;

ALTER TABLE comments
  ADD CONSTRAINT comments_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION ensure_comment_parent_same_video()
RETURNS TRIGGER AS $$
DECLARE
  parent_video_id UUID;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.video_id
  INTO parent_video_id
  FROM comments c
  WHERE c.id = NEW.parent_id;

  IF parent_video_id IS NULL THEN
    RAISE EXCEPTION 'Parent comment % does not exist.', NEW.parent_id;
  END IF;

  IF parent_video_id <> NEW.video_id THEN
    RAISE EXCEPTION 'Reply comments must belong to the same video as their parent.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = 'public';

DROP TRIGGER IF EXISTS comments_parent_same_video ON comments;

CREATE TRIGGER comments_parent_same_video
  BEFORE INSERT OR UPDATE OF video_id, parent_id ON comments
  FOR EACH ROW EXECUTE FUNCTION ensure_comment_parent_same_video();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

-- videos
DROP POLICY IF EXISTS videos_select ON videos;
DROP POLICY IF EXISTS videos_select_published ON videos;
DROP POLICY IF EXISTS videos_select_own ON videos;
DROP POLICY IF EXISTS videos_insert ON videos;
DROP POLICY IF EXISTS videos_insert_authenticated ON videos;
DROP POLICY IF EXISTS videos_update_own ON videos;
DROP POLICY IF EXISTS videos_delete_own ON videos;

CREATE POLICY videos_select_published
  ON videos FOR SELECT TO anon, authenticated
  USING (state = 'published'::video_state);

CREATE POLICY videos_select_own
  ON videos FOR SELECT TO authenticated
  USING ((select auth.uid()) = created_by);

CREATE POLICY videos_insert_authenticated
  ON videos FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY videos_update_own
  ON videos FOR UPDATE TO authenticated
  USING ((select auth.uid()) = created_by)
  WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY videos_delete_own
  ON videos FOR DELETE TO authenticated
  USING ((select auth.uid()) = created_by);

-- video_places
DROP POLICY IF EXISTS video_places_select ON video_places;
DROP POLICY IF EXISTS video_places_insert ON video_places;
DROP POLICY IF EXISTS video_places_delete ON video_places;

CREATE POLICY video_places_select
  ON video_places FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM videos v
      WHERE v.id = video_places.video_id
        AND (
          v.state = 'published'::video_state
          OR v.created_by = (select auth.uid())
        )
    )
  );

CREATE POLICY video_places_insert
  ON video_places FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM videos v
      WHERE v.id = video_places.video_id
        AND v.created_by = (select auth.uid())
    )
  );

CREATE POLICY video_places_delete
  ON video_places FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM videos v
      WHERE v.id = video_places.video_id
        AND v.created_by = (select auth.uid())
    )
  );

-- likes
DROP POLICY IF EXISTS likes_select ON likes;
DROP POLICY IF EXISTS likes_insert ON likes;
DROP POLICY IF EXISTS likes_insert_own ON likes;
DROP POLICY IF EXISTS likes_delete ON likes;
DROP POLICY IF EXISTS likes_delete_own ON likes;

CREATE POLICY likes_select
  ON likes FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM videos v
      WHERE v.id = likes.video_id
        AND (
          v.state = 'published'::video_state
          OR v.created_by = (select auth.uid())
        )
    )
  );

CREATE POLICY likes_insert
  ON likes FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM videos v
      WHERE v.id = likes.video_id
        AND (
          v.state = 'published'::video_state
          OR v.created_by = (select auth.uid())
        )
    )
  );

CREATE POLICY likes_delete
  ON likes FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- comments
DROP POLICY IF EXISTS comments_select ON comments;
DROP POLICY IF EXISTS comments_insert ON comments;
DROP POLICY IF EXISTS comments_delete ON comments;

CREATE POLICY comments_select
  ON comments FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM videos v
      WHERE v.id = comments.video_id
        AND (
          v.state = 'published'::video_state
          OR v.created_by = (select auth.uid())
        )
    )
  );

CREATE POLICY comments_insert
  ON comments FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM videos v
      WHERE v.id = comments.video_id
        AND (
          v.state = 'published'::video_state
          OR v.created_by = (select auth.uid())
        )
    )
  );

CREATE POLICY comments_delete
  ON comments FOR DELETE TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR (select auth.uid()) IN (
      SELECT v.created_by FROM videos v WHERE v.id = comments.video_id
    )
  );

-- followers
DROP POLICY IF EXISTS followers_select ON followers;
DROP POLICY IF EXISTS followers_insert ON followers;
DROP POLICY IF EXISTS followers_insert_own ON followers;
DROP POLICY IF EXISTS followers_delete ON followers;
DROP POLICY IF EXISTS followers_delete_own ON followers;

CREATE POLICY followers_select
  ON followers FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY followers_insert
  ON followers FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = follower_id);

CREATE POLICY followers_delete
  ON followers FOR DELETE TO authenticated
  USING ((select auth.uid()) = follower_id);
