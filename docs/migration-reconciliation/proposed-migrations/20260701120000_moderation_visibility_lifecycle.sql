-- ============================================================================
-- Moderation visibility lifecycle
-- ============================================================================
-- Reports are audit/moderation workflow records. They do not globally hide
-- content. Global content visibility is controlled by moderation_status, while
-- user_hidden_content hides reported/hidden content for one viewer only.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Lifecycle status for reports
-- ---------------------------------------------------------------------------

ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE public.content_reports
SET status = 'pending'
WHERE status IS NULL
   OR status NOT IN ('pending', 'reviewed', 'dismissed', 'removed');

ALTER TABLE public.content_reports
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.content_reports'::regclass
      AND conname = 'content_reports_status_check'
  ) THEN
    ALTER TABLE public.content_reports
      ADD CONSTRAINT content_reports_status_check
      CHECK (status IN ('pending', 'reviewed', 'dismissed', 'removed'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Global moderation status
-- ---------------------------------------------------------------------------

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS moderation_status TEXT;

UPDATE public.videos
SET moderation_status = 'active'
WHERE moderation_status IS NULL
   OR moderation_status NOT IN ('active', 'under_review', 'hidden', 'removed');

ALTER TABLE public.videos
  ALTER COLUMN moderation_status SET DEFAULT 'active',
  ALTER COLUMN moderation_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.videos'::regclass
      AND conname = 'videos_moderation_status_check'
  ) THEN
    ALTER TABLE public.videos
      ADD CONSTRAINT videos_moderation_status_check
      CHECK (moderation_status IN ('active', 'under_review', 'hidden', 'removed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS videos_moderation_status_idx
  ON public.videos (moderation_status);

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS moderation_status TEXT;

UPDATE public.places
SET moderation_status = 'active'
WHERE moderation_status IS NULL
   OR moderation_status NOT IN ('active', 'under_review', 'hidden', 'removed');

ALTER TABLE public.places
  ALTER COLUMN moderation_status SET DEFAULT 'active',
  ALTER COLUMN moderation_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.places'::regclass
      AND conname = 'places_moderation_status_check'
  ) THEN
    ALTER TABLE public.places
      ADD CONSTRAINT places_moderation_status_check
      CHECK (moderation_status IN ('active', 'under_review', 'hidden', 'removed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS places_moderation_status_idx
  ON public.places (moderation_status);

-- ---------------------------------------------------------------------------
-- User-specific hidden content
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_hidden_content (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('video', 'place', 'user', 'place_photo')),
  content_id   TEXT NOT NULL,
  reason       TEXT NOT NULL DEFAULT 'reported' CHECK (reason IN ('reported', 'hidden_by_user')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS user_hidden_content_user_type_idx
  ON public.user_hidden_content (user_id, content_type);

CREATE INDEX IF NOT EXISTS user_hidden_content_content_idx
  ON public.user_hidden_content (content_type, content_id);

ALTER TABLE public.user_hidden_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_hidden_content_select_own ON public.user_hidden_content;
DROP POLICY IF EXISTS user_hidden_content_insert_own ON public.user_hidden_content;
DROP POLICY IF EXISTS user_hidden_content_delete_own ON public.user_hidden_content;

CREATE POLICY user_hidden_content_select_own
  ON public.user_hidden_content FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY user_hidden_content_insert_own
  ON public.user_hidden_content FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY user_hidden_content_delete_own
  ON public.user_hidden_content FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, DELETE ON public.user_hidden_content TO authenticated;
GRANT ALL ON public.user_hidden_content TO service_role;

-- ---------------------------------------------------------------------------
-- RLS: videos and places
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS videos_select ON public.videos;
DROP POLICY IF EXISTS videos_select_published ON public.videos;
DROP POLICY IF EXISTS videos_select_own ON public.videos;

CREATE POLICY videos_select
  ON public.videos FOR SELECT TO anon, authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR (
      state = 'published'::video_state
      AND COALESCE(moderation_status, 'active') IN ('active', 'under_review')
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_hidden_content uh
        WHERE uh.user_id = (SELECT auth.uid())
          AND uh.content_type = 'video'
          AND uh.content_id = videos.id::TEXT
      )
    )
  );

DROP POLICY IF EXISTS places_select ON public.places;

CREATE POLICY places_select
  ON public.places FOR SELECT TO anon, authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR (
      state = 'published'::place_state
      AND COALESCE(moderation_status, 'active') IN ('active', 'under_review')
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_hidden_content uh
        WHERE uh.user_id = (SELECT auth.uid())
          AND uh.content_type = 'place'
          AND uh.content_id = places.id::TEXT
      )
    )
  );

-- Keep related rows aligned with the same video/place visibility rules.
DROP POLICY IF EXISTS video_places_select ON public.video_places;

CREATE POLICY video_places_select
  ON public.video_places FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.videos v
      WHERE v.id = video_places.video_id
        AND (
          v.created_by = (SELECT auth.uid())
          OR (
            v.state = 'published'::video_state
            AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review')
            AND NOT EXISTS (
              SELECT 1
              FROM public.user_hidden_content uh
              WHERE uh.user_id = (SELECT auth.uid())
                AND uh.content_type = 'video'
                AND uh.content_id = v.id::TEXT
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS likes_select ON public.likes;
DROP POLICY IF EXISTS likes_insert ON public.likes;

CREATE POLICY likes_select
  ON public.likes FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.videos v
      WHERE v.id = likes.video_id
        AND (
          v.created_by = (SELECT auth.uid())
          OR (
            v.state = 'published'::video_state
            AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review')
            AND NOT EXISTS (
              SELECT 1
              FROM public.user_hidden_content uh
              WHERE uh.user_id = (SELECT auth.uid())
                AND uh.content_type = 'video'
                AND uh.content_id = v.id::TEXT
            )
          )
        )
    )
  );

CREATE POLICY likes_insert
  ON public.likes FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.videos v
      WHERE v.id = likes.video_id
        AND (
          v.created_by = (SELECT auth.uid())
          OR (
            v.state = 'published'::video_state
            AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review')
            AND NOT EXISTS (
              SELECT 1
              FROM public.user_hidden_content uh
              WHERE uh.user_id = (SELECT auth.uid())
                AND uh.content_type = 'video'
                AND uh.content_id = v.id::TEXT
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS comments_select ON public.comments;
DROP POLICY IF EXISTS comments_insert ON public.comments;

CREATE POLICY comments_select
  ON public.comments FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.videos v
      WHERE v.id = comments.video_id
        AND (
          v.created_by = (SELECT auth.uid())
          OR (
            v.state = 'published'::video_state
            AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review')
            AND NOT EXISTS (
              SELECT 1
              FROM public.user_hidden_content uh
              WHERE uh.user_id = (SELECT auth.uid())
                AND uh.content_type = 'video'
                AND uh.content_id = v.id::TEXT
            )
          )
        )
    )
  );

CREATE POLICY comments_insert
  ON public.comments FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.videos v
      WHERE v.id = comments.video_id
        AND (
          v.created_by = (SELECT auth.uid())
          OR (
            v.state = 'published'::video_state
            AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review')
            AND NOT EXISTS (
              SELECT 1
              FROM public.user_hidden_content uh
              WHERE uh.user_id = (SELECT auth.uid())
                AND uh.content_type = 'video'
                AND uh.content_id = v.id::TEXT
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS place_photos_select ON public.place_photos;

CREATE POLICY place_photos_select
  ON public.place_photos FOR SELECT TO anon, authenticated
  USING (
    NOT EXISTS (
      SELECT 1
      FROM public.user_hidden_content uh
      WHERE uh.user_id = (SELECT auth.uid())
        AND uh.content_type = 'place_photo'
        AND uh.content_id = place_photos.id::TEXT
    )
    AND EXISTS (
      SELECT 1
      FROM public.places p
      WHERE p.id = place_photos.place_id
        AND (
          p.created_by = (SELECT auth.uid())
          OR (
            p.state = 'published'::place_state
            AND COALESCE(p.moderation_status, 'active') IN ('active', 'under_review')
            AND NOT EXISTS (
              SELECT 1
              FROM public.user_hidden_content uh
              WHERE uh.user_id = (SELECT auth.uid())
                AND uh.content_type = 'place'
                AND uh.content_id = p.id::TEXT
            )
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Video RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.videos_within_radius(
  lat_param           FLOAT,
  lng_param           FLOAT,
  radius_meters       FLOAT,
  max_results         INT         DEFAULT 20,
  cursor_score        FLOAT8      DEFAULT NULL,
  cursor_id           UUID        DEFAULT NULL,
  uid_param           UUID        DEFAULT NULL,
  exclude_seen_since  TIMESTAMPTZ DEFAULT NULL,
  as_of               TIMESTAMPTZ DEFAULT NULL,
  filter_tag          TEXT        DEFAULT NULL
)
RETURNS TABLE (
  id               UUID,
  video_url        TEXT,
  thumbnail_url    TEXT,
  lat              FLOAT,
  lng              FLOAT,
  route_id         UUID,
  description      TEXT,
  tags             TEXT[],
  duration_seconds INT,
  total_likes      INT,
  total_comments   INT,
  created_by       UUID,
  state            TEXT,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ,
  score            FLOAT8,
  place_ids        UUID[]
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH scored AS (
    SELECT
      v.id,
      v.video_url,
      v.thumbnail_url,
      ST_Y(v.location::geometry) AS lat,
      ST_X(v.location::geometry) AS lng,
      v.route_id,
      v.description,
      v.tags,
      v.duration_seconds,
      v.total_likes,
      v.total_comments,
      v.created_by,
      v.state,
      v.created_at,
      v.updated_at,
      (SELECT COALESCE(ARRAY_AGG(vp.place_id), ARRAY[]::UUID[])
       FROM video_places vp WHERE vp.video_id = v.id) AS place_ids,
      ROUND((
          0.50 * exp(-EXTRACT(EPOCH FROM (COALESCE(as_of, now()) - v.created_at)) / 259200.0)
        + 0.30 * (1.0 - LEAST(
            ST_Distance(v.location, ST_MakePoint(lng_param, lat_param)::geography) / radius_meters,
            1.0
          ))
        + 0.20 * (ln(1 + v.total_likes + 2 * v.total_comments) / ln(1 + 50))
      )::numeric, 6)::float8 AS score
    FROM videos v
    WHERE
      v.state = 'published'
      AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review')
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_hidden_content uh
        WHERE uh.user_id = auth.uid()
          AND uh.content_type = 'video'
          AND uh.content_id = v.id::TEXT
      )
      AND ST_DWithin(
        v.location,
        ST_MakePoint(lng_param, lat_param)::geography,
        radius_meters
      )
      AND (filter_tag IS NULL OR filter_tag = ANY(v.tags::text[]))
      AND (
        uid_param IS NULL
        OR exclude_seen_since IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM video_impressions vi
          WHERE vi.user_id  = uid_param
            AND vi.video_id = v.id
            AND vi.viewed_at >= exclude_seen_since
        )
      )
  )
  SELECT
    scored.id,
    scored.video_url,
    scored.thumbnail_url,
    scored.lat,
    scored.lng,
    scored.route_id,
    scored.description,
    scored.tags,
    scored.duration_seconds,
    scored.total_likes,
    scored.total_comments,
    scored.created_by,
    scored.state,
    scored.created_at,
    scored.updated_at,
    scored.score,
    scored.place_ids
  FROM scored
  WHERE
    cursor_score IS NULL
    OR (scored.score, scored.id) < (cursor_score, cursor_id)
  ORDER BY scored.score DESC, scored.id DESC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION public.videos_within_radius(
  FLOAT, FLOAT, FLOAT, INT, FLOAT8, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.videos_from_following(
  p_follower_id UUID,
  max_results   INT         DEFAULT 20,
  cursor_at     TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id               UUID,
  video_url        TEXT,
  thumbnail_url    TEXT,
  lat              FLOAT,
  lng              FLOAT,
  route_id         UUID,
  description      TEXT,
  tags             TEXT[],
  duration_seconds INT,
  total_likes      INT,
  total_comments   INT,
  created_by       UUID,
  state            TEXT,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ,
  place_ids        UUID[]
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    v.id,
    v.video_url,
    v.thumbnail_url,
    ST_Y(v.location::geometry) AS lat,
    ST_X(v.location::geometry) AS lng,
    v.route_id,
    v.description,
    v.tags,
    v.duration_seconds,
    v.total_likes,
    v.total_comments,
    v.created_by,
    v.state::TEXT,
    v.created_at,
    v.updated_at,
    (SELECT COALESCE(ARRAY_AGG(vp.place_id), ARRAY[]::UUID[])
     FROM video_places vp WHERE vp.video_id = v.id) AS place_ids
  FROM videos v
  WHERE
    v.state = 'published'
    AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review')
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_hidden_content uh
      WHERE uh.user_id = auth.uid()
        AND uh.content_type = 'video'
        AND uh.content_id = v.id::TEXT
    )
    AND v.created_by IN (
      SELECT following_id FROM followers WHERE follower_id = p_follower_id
    )
    AND (cursor_at IS NULL OR v.created_at < cursor_at)
  ORDER BY v.created_at DESC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION public.videos_from_following(UUID, INT, TIMESTAMPTZ) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.videos_recent_nearby(
  in_lat       FLOAT,
  in_lng       FLOAT,
  radius_m     FLOAT,
  filter_tag   TEXT DEFAULT NULL,
  max_results  INT  DEFAULT 12
)
RETURNS TABLE (
  id               UUID,
  video_url        TEXT,
  thumbnail_url    TEXT,
  lat              FLOAT,
  lng              FLOAT,
  route_id         UUID,
  description      TEXT,
  tags             TEXT[],
  duration_seconds INT,
  total_likes      INT,
  total_comments   INT,
  created_by       UUID,
  state            TEXT,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ,
  place_ids        UUID[]
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    v.id,
    v.video_url,
    v.thumbnail_url,
    ST_Y(v.location::geometry) AS lat,
    ST_X(v.location::geometry) AS lng,
    v.route_id,
    v.description,
    v.tags::text[],
    v.duration_seconds,
    v.total_likes,
    v.total_comments,
    v.created_by,
    v.state::text,
    v.created_at,
    v.updated_at,
    (SELECT COALESCE(ARRAY_AGG(vp.place_id), ARRAY[]::UUID[])
     FROM video_places vp WHERE vp.video_id = v.id) AS place_ids
  FROM videos v
  WHERE v.state = 'published'
    AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review')
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_hidden_content uh
      WHERE uh.user_id = auth.uid()
        AND uh.content_type = 'video'
        AND uh.content_id = v.id::TEXT
    )
    AND ST_DWithin(v.location, ST_MakePoint(in_lng, in_lat)::geography, radius_m)
    AND (filter_tag IS NULL OR filter_tag = ANY(v.tags::text[]))
  ORDER BY v.created_at DESC, v.id DESC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION public.videos_recent_nearby(FLOAT, FLOAT, FLOAT, TEXT, INT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.videos_trending_weekly(
  in_lat      FLOAT,
  in_lng      FLOAT,
  radius_m    FLOAT,
  filter_tag  TEXT        DEFAULT NULL,
  max_results INT         DEFAULT 12,
  as_of       TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id               UUID,
  video_url        TEXT,
  thumbnail_url    TEXT,
  lat              FLOAT,
  lng              FLOAT,
  route_id         UUID,
  description      TEXT,
  tags             TEXT[],
  duration_seconds INT,
  total_likes      INT,
  total_comments   INT,
  created_by       UUID,
  state            TEXT,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ,
  score            FLOAT8,
  place_ids        UUID[]
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH win AS (SELECT (COALESCE(as_of, now()) - interval '7 days') AS since),
  scored AS (
    SELECT
      v.id, v.video_url, v.thumbnail_url,
      ST_Y(v.location::geometry) AS lat,
      ST_X(v.location::geometry) AS lng,
      v.route_id, v.description, v.tags::text[],
      v.duration_seconds, v.total_likes, v.total_comments,
      v.created_by, v.state::text, v.created_at, v.updated_at,
      (SELECT COALESCE(ARRAY_AGG(vp.place_id), ARRAY[]::UUID[])
       FROM video_places vp WHERE vp.video_id = v.id) AS place_ids,
      (
        (SELECT count(*) FROM likes l WHERE l.video_id = v.id AND l.created_at >= (SELECT since FROM win))
        + 2 * (SELECT count(*) FROM comments c WHERE c.video_id = v.id AND c.created_at >= (SELECT since FROM win))
      ) AS interactions_7d
    FROM videos v
    WHERE v.state = 'published'
      AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review')
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_hidden_content uh
        WHERE uh.user_id = auth.uid()
          AND uh.content_type = 'video'
          AND uh.content_id = v.id::TEXT
      )
      AND ST_DWithin(v.location, ST_MakePoint(in_lng, in_lat)::geography, radius_m)
      AND (filter_tag IS NULL OR filter_tag = ANY(v.tags::text[]))
  )
  SELECT
    s.id, s.video_url, s.thumbnail_url, s.lat, s.lng, s.route_id, s.description,
    s.tags, s.duration_seconds, s.total_likes, s.total_comments, s.created_by,
    s.state, s.created_at, s.updated_at,
    ROUND(explore_norm_log(s.interactions_7d, 20)::numeric, 6)::float8 AS score,
    s.place_ids
  FROM scored s
  WHERE s.interactions_7d > 0
  ORDER BY score DESC, s.id DESC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION public.videos_trending_weekly(FLOAT, FLOAT, FLOAT, TEXT, INT, TIMESTAMPTZ) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.videos_recycled_nearby(
  lat_param     FLOAT,
  lng_param     FLOAT,
  radius_meters FLOAT,
  uid_param     UUID,
  max_results   INT DEFAULT 20,
  offset_param  INT DEFAULT 0
)
RETURNS TABLE (
  id               UUID,
  video_url        TEXT,
  thumbnail_url    TEXT,
  lat              FLOAT,
  lng              FLOAT,
  route_id         UUID,
  description      TEXT,
  tags             TEXT[],
  duration_seconds INT,
  total_likes      INT,
  total_comments   INT,
  created_by       UUID,
  state            TEXT,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ,
  last_viewed_at   TIMESTAMPTZ,
  place_ids        UUID[]
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    v.id,
    v.video_url,
    v.thumbnail_url,
    ST_Y(v.location::geometry) AS lat,
    ST_X(v.location::geometry) AS lng,
    v.route_id,
    v.description,
    v.tags,
    v.duration_seconds,
    v.total_likes,
    v.total_comments,
    v.created_by,
    v.state,
    v.created_at,
    v.updated_at,
    vi.viewed_at AS last_viewed_at,
    (SELECT COALESCE(ARRAY_AGG(vp.place_id), ARRAY[]::UUID[])
     FROM video_places vp WHERE vp.video_id = v.id) AS place_ids
  FROM videos v
  LEFT JOIN video_impressions vi
    ON vi.video_id = v.id AND vi.user_id = uid_param
  WHERE
    v.state = 'published'
    AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review')
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_hidden_content uh
      WHERE uh.user_id = auth.uid()
        AND uh.content_type = 'video'
        AND uh.content_id = v.id::TEXT
    )
    AND ST_DWithin(
      v.location,
      ST_MakePoint(lng_param, lat_param)::geography,
      radius_meters
    )
  ORDER BY vi.viewed_at ASC NULLS FIRST, v.created_at DESC
  LIMIT max_results OFFSET offset_param;
$$;

GRANT EXECUTE ON FUNCTION public.videos_recycled_nearby(FLOAT, FLOAT, FLOAT, UUID, INT, INT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.search_videos_discover(
  q              TEXT,
  tag_filter     TEXT DEFAULT NULL,
  result_limit   INT DEFAULT 25
)
RETURNS TABLE (
  id                   UUID,
  description          TEXT,
  thumbnail_url        TEXT,
  tags                 TEXT[],
  created_by           UUID,
  total_likes          INTEGER,
  author_handle        TEXT,
  author_display_name  TEXT,
  author_avatar_url    TEXT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT trim(q) AS query
  )
  SELECT
    v.id,
    v.description,
    v.thumbnail_url,
    v.tags,
    v.created_by,
    v.total_likes,
    u.handle AS author_handle,
    u.display_name AS author_display_name,
    u.avatar_url AS author_avatar_url
  FROM normalized n
  JOIN public.videos v
    ON v.state = 'published'
   AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review')
   AND NOT EXISTS (
     SELECT 1
     FROM public.user_hidden_content uh
     WHERE uh.user_id = auth.uid()
       AND uh.content_type = 'video'
       AND uh.content_id = v.id::TEXT
   )
   AND v.publish_to_feed = true
  JOIN public.users u ON u.id = v.created_by
  WHERE length(n.query) >= 2
    AND COALESCE(v.description, '') ILIKE '%' || n.query || '%'
    AND (tag_filter IS NULL OR v.tags && ARRAY[tag_filter])
  ORDER BY
    CASE WHEN COALESCE(v.description, '') ILIKE n.query || '%' THEN 0 ELSE 1 END,
    v.total_likes DESC,
    v.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(result_limit, 25), 1), 25);
$$;

GRANT EXECUTE ON FUNCTION public.search_videos_discover(TEXT, TEXT, INT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Place RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.places_in_bbox(
  lat1            DOUBLE PRECISION,
  lat2            DOUBLE PRECISION,
  lng1            DOUBLE PRECISION,
  lng2            DOUBLE PRECISION,
  category_filter TEXT DEFAULT NULL
)
RETURNS SETOF public.places
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT *
  FROM public.places p
  WHERE p.state = 'published'
    AND COALESCE(p.moderation_status, 'active') IN ('active', 'under_review')
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_hidden_content uh
      WHERE uh.user_id = auth.uid()
        AND uh.content_type = 'place'
        AND uh.content_id = p.id::TEXT
    )
    AND p.location && ST_MakeEnvelope(lng1, lat1, lng2, lat2, 4326)
    AND (category_filter IS NULL OR p.category::text = category_filter);
$$;

GRANT EXECUTE ON FUNCTION public.places_in_bbox(
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.places_within_radius(
  lat_param     DOUBLE PRECISION,
  lng_param     DOUBLE PRECISION,
  radius_meters INTEGER,
  max_results   INTEGER DEFAULT 50
)
RETURNS SETOF public.places
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT *
  FROM public.places p
  WHERE p.state = 'published'
    AND COALESCE(p.moderation_status, 'active') IN ('active', 'under_review')
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_hidden_content uh
      WHERE uh.user_id = auth.uid()
        AND uh.content_type = 'place'
        AND uh.content_id = p.id::TEXT
    )
    AND ST_DWithin(
      p.location,
      ST_MakePoint(lng_param, lat_param)::geography,
      radius_meters
    )
  ORDER BY ST_Distance(
    p.location,
    ST_MakePoint(lng_param, lat_param)::geography
  )
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION public.places_within_radius(
  DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.search_places_for_map(
  search_query    TEXT,
  center_lat      DOUBLE PRECISION DEFAULT NULL,
  center_lng      DOUBLE PRECISION DEFAULT NULL,
  category_filter place_category DEFAULT NULL,
  result_limit    INT DEFAULT 25
)
RETURNS TABLE (
  id                UUID,
  name              TEXT,
  description       TEXT,
  category          place_category,
  location          GEOGRAPHY(Point, 4326),
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION,
  distance_m        DOUBLE PRECISION,
  average_rating    NUMERIC,
  total_ratings     INTEGER,
  state             place_state,
  created_by        UUID,
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ,
  primary_photo_url TEXT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT
      trim(search_query) AS q,
      CASE
        WHEN center_lat IS NOT NULL AND center_lng IS NOT NULL THEN
          ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
        ELSE NULL
      END AS center_point
  )
  SELECT
    p.id,
    p.name,
    p.description,
    p.category,
    p.location,
    ST_Y(p.location::geometry) AS latitude,
    ST_X(p.location::geometry) AS longitude,
    CASE
      WHEN n.center_point IS NULL THEN NULL
      ELSE ST_Distance(p.location, n.center_point)
    END::DOUBLE PRECISION AS distance_m,
    p.average_rating,
    p.total_ratings,
    p.state,
    p.created_by,
    p.created_at,
    p.updated_at,
    photo.url AS primary_photo_url
  FROM normalized n
  JOIN public.places p
    ON p.state = 'published'
   AND COALESCE(p.moderation_status, 'active') IN ('active', 'under_review')
   AND NOT EXISTS (
     SELECT 1
     FROM public.user_hidden_content uh
     WHERE uh.user_id = auth.uid()
       AND uh.content_type = 'place'
       AND uh.content_id = p.id::TEXT
   )
  LEFT JOIN LATERAL (
    SELECT pp.url
    FROM public.place_photos pp
    WHERE pp.place_id = p.id
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_hidden_content uh
        WHERE uh.user_id = auth.uid()
          AND uh.content_type = 'place_photo'
          AND uh.content_id = pp.id::TEXT
      )
    ORDER BY pp.created_at ASC
    LIMIT 1
  ) photo ON TRUE
  WHERE length(n.q) >= 2
    AND (category_filter IS NULL OR p.category = category_filter)
    AND (
      p.name ILIKE '%' || n.q || '%'
      OR COALESCE(p.description, '') ILIKE '%' || n.q || '%'
      OR p.category::TEXT ILIKE '%' || n.q || '%'
      OR (
        CASE p.category
          WHEN 'hiking' THEN 'hiking senderismo hike trail ruta camino'
          WHEN 'gastronomy' THEN 'gastronomy gastronomia gastronomia food comida restaurant restaurante pizza'
          WHEN 'beach' THEN 'beach playa mar costa'
          WHEN 'urban' THEN 'urban urbano city ciudad sector calle'
          WHEN 'nature' THEN 'nature naturaleza natural parque'
          ELSE 'other otro'
        END
      ) ILIKE '%' || n.q || '%'
    )
  ORDER BY
    CASE WHEN p.name ILIKE n.q || '%' THEN 0 ELSE 1 END,
    CASE
      WHEN n.center_point IS NULL THEN 0
      ELSE ST_Distance(p.location, n.center_point)
    END ASC,
    p.name ASC
  LIMIT LEAST(GREATEST(COALESCE(result_limit, 25), 1), 25);
$$;

GRANT EXECUTE ON FUNCTION public.search_places_for_map(
  TEXT,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  place_category,
  INT
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.places_recent_nearby(
  in_lat           FLOAT,
  in_lng           FLOAT,
  radius_m         FLOAT,
  filter_category  place_category DEFAULT NULL,
  max_results      INT            DEFAULT 12
)
RETURNS SETOF public.places
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT p.*
  FROM public.places p
  WHERE p.state = 'published'
    AND COALESCE(p.moderation_status, 'active') IN ('active', 'under_review')
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_hidden_content uh
      WHERE uh.user_id = auth.uid()
        AND uh.content_type = 'place'
        AND uh.content_id = p.id::TEXT
    )
    AND ST_DWithin(p.location, ST_MakePoint(in_lng, in_lat)::geography, radius_m)
    AND (filter_category IS NULL OR p.category = filter_category)
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION public.places_recent_nearby(FLOAT, FLOAT, FLOAT, place_category, INT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.places_hidden_gems(
  in_lat           FLOAT,
  in_lng           FLOAT,
  radius_m         FLOAT,
  filter_category  place_category DEFAULT NULL,
  max_results      INT            DEFAULT 12
)
RETURNS SETOF public.places
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH g AS (
    SELECT AVG(p_avg.average_rating)::float8 AS global_avg
    FROM public.places p_avg
    WHERE p_avg.state = 'published'
      AND COALESCE(p_avg.moderation_status, 'active') IN ('active', 'under_review')
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_hidden_content uh
        WHERE uh.user_id = auth.uid()
          AND uh.content_type = 'place'
          AND uh.content_id = p_avg.id::TEXT
      )
      AND p_avg.total_ratings > 0
  )
  SELECT p.*
  FROM public.places p, g
  WHERE p.state = 'published'
    AND COALESCE(p.moderation_status, 'active') IN ('active', 'under_review')
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_hidden_content uh
      WHERE uh.user_id = auth.uid()
        AND uh.content_type = 'place'
        AND uh.content_id = p.id::TEXT
    )
    AND p.total_ratings >= 3
    AND ST_DWithin(p.location, ST_MakePoint(in_lng, in_lat)::geography, radius_m)
    AND (filter_category IS NULL OR p.category = filter_category)
  ORDER BY
    (
      (explore_bayesian_rating(p.average_rating::float8, p.total_ratings, COALESCE(g.global_avg, 3.0), 5) / 5.0)
      * (1.0 - explore_norm_log(
          (SELECT count(*) FROM place_impressions pi WHERE pi.place_id = p.id), 50
        ))
    ) DESC,
    p.id DESC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION public.places_hidden_gems(FLOAT, FLOAT, FLOAT, place_category, INT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Mixed explore and route RPCs that derive results from visible videos/places
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.explore_local_creators(
  in_lat                FLOAT,
  in_lng                FLOAT,
  radius_m              FLOAT,
  filter_video_tag      TEXT           DEFAULT NULL,
  filter_place_category place_category DEFAULT NULL,
  max_results           INT            DEFAULT 10,
  offset_param          INT            DEFAULT 0,
  as_of                 TIMESTAMPTZ    DEFAULT NULL
)
RETURNS TABLE (
  creator_id           UUID,
  handle               TEXT,
  display_name         TEXT,
  avatar_url           TEXT,
  accent_color         TEXT,
  publications_in_zone INT,
  engagement_received  INT,
  last_publication     TIMESTAMPTZ,
  score                FLOAT8
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH contrib AS (
    SELECT v.created_by AS uid, v.created_at AS at, (v.total_likes + v.total_comments) AS eng
    FROM videos v
    WHERE v.state = 'published'
      AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review')
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_hidden_content uh
        WHERE uh.user_id = auth.uid()
          AND uh.content_type = 'video'
          AND uh.content_id = v.id::TEXT
      )
      AND ST_DWithin(v.location, ST_MakePoint(in_lng, in_lat)::geography, radius_m)
      AND (filter_video_tag IS NULL OR filter_video_tag = ANY(v.tags::text[]))
    UNION ALL
    SELECT p.created_by, p.created_at, p.total_ratings
    FROM places p
    WHERE p.state = 'published'
      AND COALESCE(p.moderation_status, 'active') IN ('active', 'under_review')
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_hidden_content uh
        WHERE uh.user_id = auth.uid()
          AND uh.content_type = 'place'
          AND uh.content_id = p.id::TEXT
      )
      AND ST_DWithin(p.location, ST_MakePoint(in_lng, in_lat)::geography, radius_m)
      AND (filter_place_category IS NULL OR p.category = filter_place_category)
  ),
  agg AS (
    SELECT uid, count(*) AS pub_count, sum(eng) AS eng_total, max(at) AS last_pub
    FROM contrib
    WHERE uid <> '00000000-0000-0000-0000-000000000001'
    GROUP BY uid
    HAVING count(*) >= 1
  )
  SELECT
    u.id, u.handle, u.display_name, u.avatar_url, u.accent_color,
    a.pub_count::int, a.eng_total::int, a.last_pub,
    ROUND((
        0.40 * explore_norm_log(a.pub_count, 10)
      + 0.35 * explore_norm_log(a.eng_total, 100)
      + 0.25 * explore_recency_decay(a.last_pub, 168, COALESCE(as_of, now()))
    )::numeric, 6)::float8 AS score
  FROM agg a
  JOIN users u ON u.id = a.uid
  WHERE u.is_deactivated = false AND u.is_ghost = false
  ORDER BY score DESC, u.id DESC
  OFFSET offset_param
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION public.explore_local_creators(
  FLOAT, FLOAT, FLOAT, TEXT, place_category, INT, INT, TIMESTAMPTZ
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.explore_trending_creators_global(
  filter_video_tag      TEXT           DEFAULT NULL,
  filter_place_category place_category DEFAULT NULL,
  max_results           INT            DEFAULT 10,
  offset_param          INT            DEFAULT 0,
  as_of                 TIMESTAMPTZ    DEFAULT NULL
)
RETURNS TABLE (
  creator_id           UUID,
  handle               TEXT,
  display_name         TEXT,
  avatar_url           TEXT,
  accent_color         TEXT,
  publications_in_zone INT,
  engagement_received  INT,
  last_publication     TIMESTAMPTZ,
  score                FLOAT8
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH contrib AS (
    SELECT v.created_by AS uid, v.created_at AS at, (v.total_likes + v.total_comments) AS eng
    FROM videos v
    WHERE v.state = 'published'
      AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review')
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_hidden_content uh
        WHERE uh.user_id = auth.uid()
          AND uh.content_type = 'video'
          AND uh.content_id = v.id::TEXT
      )
      AND (filter_video_tag IS NULL OR filter_video_tag = ANY(v.tags::text[]))
    UNION ALL
    SELECT p.created_by, p.created_at, p.total_ratings
    FROM places p
    WHERE p.state = 'published'
      AND COALESCE(p.moderation_status, 'active') IN ('active', 'under_review')
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_hidden_content uh
        WHERE uh.user_id = auth.uid()
          AND uh.content_type = 'place'
          AND uh.content_id = p.id::TEXT
      )
      AND (filter_place_category IS NULL OR p.category = filter_place_category)
  ),
  agg AS (
    SELECT uid, count(*) AS pub_count, sum(eng) AS eng_total, max(at) AS last_pub
    FROM contrib
    WHERE uid <> '00000000-0000-0000-0000-000000000001'
    GROUP BY uid
    HAVING count(*) >= 1
  )
  SELECT
    u.id, u.handle, u.display_name, u.avatar_url, u.accent_color,
    a.pub_count::int, a.eng_total::int, a.last_pub,
    ROUND((
        0.40 * explore_norm_log(a.pub_count, 10)
      + 0.35 * explore_norm_log(a.eng_total, 100)
      + 0.25 * explore_recency_decay(a.last_pub, 168, COALESCE(as_of, now()))
    )::numeric, 6)::float8 AS score
  FROM agg a
  JOIN users u ON u.id = a.uid
  WHERE u.is_deactivated = false AND u.is_ghost = false
  ORDER BY score DESC, u.id DESC
  OFFSET offset_param
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION public.explore_trending_creators_global(TEXT, place_category, INT, INT, TIMESTAMPTZ) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.routes_community_favorites(
  in_lat           FLOAT,
  in_lng           FLOAT,
  radius_m         FLOAT,
  filter_category  route_category DEFAULT NULL,
  max_results      INT            DEFAULT 10,
  cursor_score     FLOAT8         DEFAULT NULL,
  cursor_id        UUID           DEFAULT NULL,
  as_of            TIMESTAMPTZ    DEFAULT NULL
)
RETURNS TABLE (
  id                  UUID,
  name                TEXT,
  category            route_category,
  difficulty          route_difficulty,
  distance_m          DOUBLE PRECISION,
  distance_to_start_m DOUBLE PRECISION,
  path                JSONB,
  created_by          UUID,
  video_count         INT,
  score               FLOAT8
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH scored AS (
    SELECT
      r.id,
      r.name,
      r.category,
      r.difficulty,
      r.distance_m,
      ST_Distance(
        ST_StartPoint(r.path::geometry)::geography,
        ST_MakePoint(in_lng, in_lat)::geography
      ) AS distance_to_start_m,
      ST_AsGeoJSON(r.path)::jsonb AS path,
      r.created_by,
      (
        SELECT count(*)::int
        FROM videos v
        WHERE v.route_id = r.id
          AND v.state = 'published'
          AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review')
          AND NOT EXISTS (
            SELECT 1
            FROM public.user_hidden_content uh
            WHERE uh.user_id = auth.uid()
              AND uh.content_type = 'video'
              AND uh.content_id = v.id::TEXT
          )
      ) AS video_count,
      ROUND((
          0.60 * explore_norm_log((
            SELECT count(*)
            FROM videos v
            WHERE v.route_id = r.id
              AND v.state = 'published'
              AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review')
              AND NOT EXISTS (
                SELECT 1
                FROM public.user_hidden_content uh
                WHERE uh.user_id = auth.uid()
                  AND uh.content_type = 'video'
                  AND uh.content_id = v.id::TEXT
              )
          ), 10)
        + 0.40 * explore_recency_decay(r.created_at, 720, COALESCE(as_of, now()))
      )::numeric, 6)::float8 AS score
    FROM routes r
    WHERE r.state = 'published'
      AND r.is_public = true
      AND r.path IS NOT NULL
      AND ST_DWithin(
        ST_StartPoint(r.path::geometry)::geography,
        ST_MakePoint(in_lng, in_lat)::geography,
        radius_m
      )
      AND (filter_category IS NULL OR r.category = filter_category)
  )
  SELECT
    scored.id,
    scored.name,
    scored.category,
    scored.difficulty,
    scored.distance_m,
    scored.distance_to_start_m,
    scored.path,
    scored.created_by,
    scored.video_count,
    scored.score
  FROM scored
  WHERE cursor_score IS NULL OR (scored.score, scored.id) < (cursor_score, cursor_id)
  ORDER BY scored.score DESC, scored.id DESC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION public.routes_community_favorites(
  FLOAT, FLOAT, FLOAT, route_category, INT, FLOAT8, UUID, TIMESTAMPTZ
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.routes_trending_weekly(
  in_lat           FLOAT,
  in_lng           FLOAT,
  radius_m         FLOAT,
  filter_category  route_category DEFAULT NULL,
  max_results      INT            DEFAULT 12,
  as_of            TIMESTAMPTZ    DEFAULT NULL
)
RETURNS TABLE (
  id                  UUID,
  name                TEXT,
  category            route_category,
  difficulty          route_difficulty,
  distance_m          DOUBLE PRECISION,
  distance_to_start_m DOUBLE PRECISION,
  path                JSONB,
  created_by          UUID,
  score               FLOAT8
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH win AS (SELECT (COALESCE(as_of, now()) - interval '7 days') AS since),
  scored AS (
    SELECT
      r.id, r.name, r.category, r.difficulty, r.distance_m,
      ST_Distance(
        ST_StartPoint(r.path::geometry)::geography,
        ST_MakePoint(in_lng, in_lat)::geography
      ) AS distance_to_start_m,
      ST_AsGeoJSON(r.path)::jsonb AS path,
      r.created_by,
      (
        SELECT count(*)
        FROM videos v
        WHERE v.route_id = r.id
          AND v.state = 'published'
          AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review')
          AND NOT EXISTS (
            SELECT 1
            FROM public.user_hidden_content uh
            WHERE uh.user_id = auth.uid()
              AND uh.content_type = 'video'
              AND uh.content_id = v.id::TEXT
          )
          AND v.created_at >= (SELECT since FROM win)
      ) AS recent_videos_7d
    FROM routes r
    WHERE r.state = 'published'
      AND r.is_public = true
      AND r.path IS NOT NULL
      AND ST_DWithin(
        ST_StartPoint(r.path::geometry)::geography,
        ST_MakePoint(in_lng, in_lat)::geography,
        radius_m
      )
      AND (filter_category IS NULL OR r.category = filter_category)
  )
  SELECT
    s.id, s.name, s.category, s.difficulty, s.distance_m, s.distance_to_start_m,
    s.path, s.created_by,
    ROUND(explore_norm_log(s.recent_videos_7d, 5)::numeric, 6)::float8 AS score
  FROM scored s
  WHERE s.recent_videos_7d > 0
  ORDER BY score DESC, s.id DESC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION public.routes_trending_weekly(FLOAT, FLOAT, FLOAT, route_category, INT, TIMESTAMPTZ) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Legacy global report-state paths
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS videos_update_report ON public.videos;
DROP POLICY IF EXISTS places_update_report ON public.places;

DO $$
BEGIN
  IF to_regprocedure('public.mark_video_reported(uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.mark_video_reported(UUID) FROM PUBLIC';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.mark_video_reported(UUID) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.mark_video_reported(UUID) FROM authenticated';
    EXECUTE 'COMMENT ON FUNCTION public.mark_video_reported(UUID) IS '
      || quote_literal('Deprecated: do not use for user reporting. User reports must go through /api/reports and user_hidden_content.');
  END IF;

  IF to_regprocedure('public.mark_place_reported(uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.mark_place_reported(UUID) FROM PUBLIC';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.mark_place_reported(UUID) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.mark_place_reported(UUID) FROM authenticated';
    EXECUTE 'COMMENT ON FUNCTION public.mark_place_reported(UUID) IS '
      || quote_literal('Deprecated: do not use for user reporting. User reports must go through /api/reports and user_hidden_content.');
  END IF;
END $$;
