-- ============================================================================
-- 00002_create_users.sql
-- Domain: User
-- Tables: users, followers, collections, favorites
-- Ref: event-storming-usuario.md
-- ============================================================================

-- ─── USERS ──────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle                TEXT UNIQUE NOT NULL,
  display_name          TEXT NOT NULL,
  email                 TEXT UNIQUE,
  avatar_url            TEXT,
  bio                   TEXT CHECK (char_length(bio) <= 150),
  language              TEXT NOT NULL DEFAULT 'es',
  categories_preferred  TEXT[] DEFAULT '{}',
  onboarding_completed  BOOLEAN NOT NULL DEFAULT false,
  email_verified        BOOLEAN NOT NULL DEFAULT false,
  is_deactivated        BOOLEAN NOT NULL DEFAULT false,
  deletion_requested_at TIMESTAMPTZ,
  deletion_scheduled_at TIMESTAMPTZ,
  is_ghost              BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT handle_format CHECK (
    handle ~ '^[a-zA-Z0-9_]{3,30}$'
  )
);

CREATE INDEX idx_users_handle ON users (handle);
CREATE INDEX idx_users_email ON users (email) WHERE email IS NOT NULL;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── SEED: Ghost User ──────────────────────────────────────────────────────

INSERT INTO users (id, handle, display_name, avatar_url, is_ghost, email_verified, onboarding_completed, language)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'deleted_user',
  'Deleted user',
  NULL,
  true, true, true,
  'en'
) ON CONFLICT (id) DO NOTHING;

-- ─── FOLLOWERS ──────────────────────────────────────────────────────────────

CREATE TABLE followers (
  follower_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

CREATE INDEX idx_followers_following ON followers (following_id);
CREATE INDEX idx_followers_follower ON followers (follower_id);

-- ─── COLLECTIONS ────────────────────────────────────────────────────────────

CREATE TABLE collections (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(name) >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collections_user ON collections (user_id);

-- ─── FAVORITES ──────────────────────────────────────────────────────────────

CREATE TABLE favorites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id      UUID,
  route_id      UUID,
  video_id      UUID,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT favorites_single_ref CHECK (
    (place_id IS NOT NULL)::int +
    (route_id IS NOT NULL)::int +
    (video_id IS NOT NULL)::int = 1
  )
);

CREATE UNIQUE INDEX idx_favorites_user_place ON favorites (user_id, place_id) WHERE place_id IS NOT NULL;
CREATE UNIQUE INDEX idx_favorites_user_route ON favorites (user_id, route_id) WHERE route_id IS NOT NULL;
CREATE UNIQUE INDEX idx_favorites_user_video ON favorites (user_id, video_id) WHERE video_id IS NOT NULL;

CREATE INDEX idx_favorites_user ON favorites (user_id);
CREATE INDEX idx_favorites_collection ON favorites (collection_id) WHERE collection_id IS NOT NULL;
