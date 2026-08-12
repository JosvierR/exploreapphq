-- ============================================================================
-- 00005_create_videos.sql
-- Domain: Community (Videos)
-- Tables: videos, likes, comments
-- Also: FK favorites.video_id → videos.id
-- ============================================================================

CREATE TYPE video_state AS ENUM (
  'processing', 'published', 'reported', 'deleted'
);

CREATE TABLE videos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_url        TEXT,
  thumbnail_url    TEXT,
  location         GEOGRAPHY(Point, 4326) NOT NULL,
  place_id         UUID REFERENCES places(id) ON DELETE SET NULL,
  route_id         UUID REFERENCES routes(id) ON DELETE SET NULL,
  description      TEXT,
  tags             TEXT[] DEFAULT '{}',
  duration_seconds INTEGER,
  publish_to_feed  BOOLEAN NOT NULL DEFAULT true,
  total_likes      INTEGER NOT NULL DEFAULT 0,
  total_comments   INTEGER NOT NULL DEFAULT 0,
  created_by       UUID NOT NULL REFERENCES users(id),
  state            video_state NOT NULL DEFAULT 'processing',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT video_duration_range CHECK (
    duration_seconds IS NULL OR (duration_seconds >= 5 AND duration_seconds <= 60)
  ),
  CONSTRAINT feed_requires_description CHECK (
    publish_to_feed = false OR description IS NOT NULL
  )
);

CREATE INDEX idx_videos_location ON videos USING GIST (location);
CREATE INDEX idx_videos_feed ON videos (created_at DESC)
  WHERE state = 'published' AND publish_to_feed = true;
CREATE INDEX idx_videos_place ON videos (place_id) WHERE place_id IS NOT NULL;
CREATE INDEX idx_videos_route ON videos (route_id) WHERE route_id IS NOT NULL;
CREATE INDEX idx_videos_created_by ON videos (created_by);

-- FK diferida: favorites.video_id → videos.id
ALTER TABLE favorites
  ADD CONSTRAINT fk_favorites_video
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;

-- ─── LIKES ──────────────────────────────────────────────────────────────────

CREATE TABLE likes (
  video_id   UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, user_id)
);

CREATE INDEX idx_likes_video ON likes (video_id);
CREATE INDEX idx_likes_user ON likes (user_id);

CREATE OR REPLACE FUNCTION update_video_likes_count()
RETURNS TRIGGER AS $$
DECLARE
  target_video_id UUID;
BEGIN
  target_video_id := COALESCE(NEW.video_id, OLD.video_id);
  UPDATE videos SET
    total_likes = (SELECT COUNT(*) FROM likes WHERE video_id = target_video_id)
  WHERE id = target_video_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SET search_path = 'public';

CREATE TRIGGER likes_count_insert AFTER INSERT ON likes
  FOR EACH ROW EXECUTE FUNCTION update_video_likes_count();
CREATE TRIGGER likes_count_delete AFTER DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION update_video_likes_count();

-- ─── COMMENTS ───────────────────────────────────────────────────────────────

CREATE TABLE comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id   UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL CHECK (char_length(text) >= 1 AND char_length(text) <= 500),
  parent_id  UUID REFERENCES comments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_video ON comments (video_id, created_at DESC);
CREATE INDEX idx_comments_user ON comments (user_id);
CREATE INDEX idx_comments_parent ON comments (parent_id) WHERE parent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION update_video_comments_count()
RETURNS TRIGGER AS $$
DECLARE
  target_video_id UUID;
BEGIN
  target_video_id := COALESCE(NEW.video_id, OLD.video_id);
  UPDATE videos SET
    total_comments = (SELECT COUNT(*) FROM comments WHERE video_id = target_video_id)
  WHERE id = target_video_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SET search_path = 'public';

CREATE TRIGGER comments_count_insert AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION update_video_comments_count();
CREATE TRIGGER comments_count_delete AFTER DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_video_comments_count();
