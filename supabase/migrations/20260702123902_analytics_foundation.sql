-- ============================================================================
-- DATA-001: Analytics foundation schema
-- Creates raw analytics storage, daily aggregates, affinity tables, admin views,
-- and a server-side aggregation function. This migration does not instrument
-- mobile events and does not expose direct client analytics access.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================================
-- Raw analytics events
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      TEXT        NOT NULL UNIQUE,
  user_id       UUID        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id  TEXT        NULL,
  session_id    TEXT        NOT NULL,
  event_name    TEXT        NOT NULL,
  event_version INT         NOT NULL DEFAULT 1,
  entity_type   TEXT        NULL,
  entity_id     TEXT        NULL,
  source        TEXT        NOT NULL DEFAULT 'mobile',
  platform      TEXT        NULL,
  app_version   TEXT        NULL,
  build_number  TEXT        NULL,
  device_os     TEXT        NULL,
  locale        TEXT        NULL,
  timezone      TEXT        NULL,
  country       TEXT        NULL,
  region        TEXT        NULL,
  city          TEXT        NULL,
  properties    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  context       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   TIMESTAMPTZ NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT analytics_events_event_id_not_empty
    CHECK (length(btrim(event_id)) > 0),
  CONSTRAINT analytics_events_session_id_not_empty
    CHECK (length(btrim(session_id)) > 0),
  CONSTRAINT analytics_events_event_name_not_empty
    CHECK (length(btrim(event_name)) > 0),
  CONSTRAINT analytics_events_event_version_positive
    CHECK (event_version > 0),
  CONSTRAINT analytics_events_source_check
    CHECK (source IN ('mobile', 'web', 'backend', 'admin')),
  CONSTRAINT analytics_events_entity_type_check
    CHECK (
      entity_type IS NULL
      OR entity_type IN (
        'video',
        'place',
        'route',
        'user',
        'place_photo',
        'search',
        'session',
        'screen',
        'system'
      )
    ),
  CONSTRAINT analytics_events_platform_check
    CHECK (platform IS NULL OR platform IN ('ios', 'android', 'web')),
  CONSTRAINT analytics_events_properties_object_check
    CHECK (jsonb_typeof(properties) = 'object'),
  CONSTRAINT analytics_events_context_object_check
    CHECK (jsonb_typeof(context) = 'object'),
  CONSTRAINT analytics_events_properties_no_sensitive_top_level_keys
    CHECK (
      NOT (
        properties ?| ARRAY[
          'lat',
          'lng',
          'latitude',
          'longitude',
          'coordinates',
          'gps',
          'gps_coordinates',
          'precise_location',
          'raw_location',
          'geolocation',
          'access_token',
          'refresh_token',
          'id_token',
          'authorization',
          'cookie',
          'session_token',
          'password',
          'secret',
          'api_key',
          'service_role_key'
        ]
      )
    ),
  CONSTRAINT analytics_events_context_no_sensitive_top_level_keys
    CHECK (
      NOT (
        context ?| ARRAY[
          'lat',
          'lng',
          'latitude',
          'longitude',
          'coordinates',
          'gps',
          'gps_coordinates',
          'precise_location',
          'raw_location',
          'geolocation',
          'access_token',
          'refresh_token',
          'id_token',
          'authorization',
          'cookie',
          'session_token',
          'password',
          'secret',
          'api_key',
          'service_role_key'
        ]
      )
    )
);

CREATE INDEX IF NOT EXISTS analytics_events_event_name_created_at_idx
  ON public.analytics_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_user_id_created_at_idx
  ON public.analytics_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_anonymous_id_created_at_idx
  ON public.analytics_events (anonymous_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_session_id_created_at_idx
  ON public.analytics_events (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_entity_idx
  ON public.analytics_events (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_occurred_at_idx
  ON public.analytics_events (occurred_at);

CREATE INDEX IF NOT EXISTS analytics_events_received_at_idx
  ON public.analytics_events (received_at);

CREATE INDEX IF NOT EXISTS analytics_events_properties_gin_idx
  ON public.analytics_events USING gin (properties);

CREATE INDEX IF NOT EXISTS analytics_events_context_gin_idx
  ON public.analytics_events USING gin (context);

-- ============================================================================
-- Invalid/rejected analytics payloads
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_event_dead_letters (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      TEXT        NULL,
  user_id       UUID        NULL,
  anonymous_id  TEXT        NULL,
  reason        TEXT        NOT NULL,
  payload       JSONB       NOT NULL,
  source        TEXT        NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT analytics_event_dead_letters_reason_not_empty
    CHECK (length(btrim(reason)) > 0),
  CONSTRAINT analytics_event_dead_letters_payload_object_check
    CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT analytics_event_dead_letters_source_check
    CHECK (source IS NULL OR source IN ('mobile', 'web', 'backend', 'admin')),
  CONSTRAINT analytics_event_dead_letters_payload_no_sensitive_top_level_keys
    CHECK (
      NOT (
        payload ?| ARRAY[
          'access_token',
          'refresh_token',
          'id_token',
          'authorization',
          'cookie',
          'session_token',
          'password',
          'secret',
          'api_key',
          'service_role_key'
        ]
      )
    )
);

CREATE INDEX IF NOT EXISTS analytics_event_dead_letters_created_at_idx
  ON public.analytics_event_dead_letters (created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_event_dead_letters_event_id_idx
  ON public.analytics_event_dead_letters (event_id);

-- ============================================================================
-- Daily aggregates
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_user_daily (
  day                DATE        NOT NULL,
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sessions_count     INT         NOT NULL DEFAULT 0,
  events_count       INT         NOT NULL DEFAULT 0,
  screen_views_count INT         NOT NULL DEFAULT 0,
  video_views_count  INT         NOT NULL DEFAULT 0,
  place_views_count  INT         NOT NULL DEFAULT 0,
  route_views_count  INT         NOT NULL DEFAULT 0,
  searches_count     INT         NOT NULL DEFAULT 0,
  follows_count      INT         NOT NULL DEFAULT 0,
  likes_count        INT         NOT NULL DEFAULT 0,
  saves_count        INT         NOT NULL DEFAULT 0,
  reports_count      INT         NOT NULL DEFAULT 0,
  first_seen_at      TIMESTAMPTZ NULL,
  last_seen_at       TIMESTAMPTZ NULL,
  PRIMARY KEY (day, user_id),

  CONSTRAINT analytics_user_daily_counts_nonnegative
    CHECK (
      sessions_count >= 0
      AND events_count >= 0
      AND screen_views_count >= 0
      AND video_views_count >= 0
      AND place_views_count >= 0
      AND route_views_count >= 0
      AND searches_count >= 0
      AND follows_count >= 0
      AND likes_count >= 0
      AND saves_count >= 0
      AND reports_count >= 0
    )
);

CREATE INDEX IF NOT EXISTS analytics_user_daily_user_id_day_idx
  ON public.analytics_user_daily (user_id, day DESC);

CREATE INDEX IF NOT EXISTS analytics_user_daily_day_idx
  ON public.analytics_user_daily (day);

CREATE TABLE IF NOT EXISTS public.analytics_content_daily (
  day                     DATE        NOT NULL,
  entity_type             TEXT        NOT NULL,
  entity_id               TEXT        NOT NULL,
  impressions_count       INT         NOT NULL DEFAULT 0,
  views_count             INT         NOT NULL DEFAULT 0,
  clicks_count            INT         NOT NULL DEFAULT 0,
  likes_count             INT         NOT NULL DEFAULT 0,
  comments_count          INT         NOT NULL DEFAULT 0,
  shares_count            INT         NOT NULL DEFAULT 0,
  saves_count             INT         NOT NULL DEFAULT 0,
  route_starts_count      INT         NOT NULL DEFAULT 0,
  route_completions_count INT         NOT NULL DEFAULT 0,
  reports_count           INT         NOT NULL DEFAULT 0,
  hides_count             INT         NOT NULL DEFAULT 0,
  unique_users_count      INT         NOT NULL DEFAULT 0,
  total_watch_seconds     NUMERIC     NOT NULL DEFAULT 0,
  avg_watch_seconds       NUMERIC     NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (day, entity_type, entity_id),

  CONSTRAINT analytics_content_daily_entity_type_check
    CHECK (entity_type IN ('video', 'place', 'route', 'user', 'place_photo')),
  CONSTRAINT analytics_content_daily_entity_id_not_empty
    CHECK (length(btrim(entity_id)) > 0),
  CONSTRAINT analytics_content_daily_counts_nonnegative
    CHECK (
      impressions_count >= 0
      AND views_count >= 0
      AND clicks_count >= 0
      AND likes_count >= 0
      AND comments_count >= 0
      AND shares_count >= 0
      AND saves_count >= 0
      AND route_starts_count >= 0
      AND route_completions_count >= 0
      AND reports_count >= 0
      AND hides_count >= 0
      AND unique_users_count >= 0
      AND total_watch_seconds >= 0
      AND avg_watch_seconds >= 0
    )
);

CREATE INDEX IF NOT EXISTS analytics_content_daily_day_idx
  ON public.analytics_content_daily (day);

CREATE INDEX IF NOT EXISTS analytics_content_daily_entity_idx
  ON public.analytics_content_daily (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS analytics_content_daily_views_count_idx
  ON public.analytics_content_daily (views_count DESC);

CREATE INDEX IF NOT EXISTS analytics_content_daily_reports_count_idx
  ON public.analytics_content_daily (reports_count DESC);

CREATE INDEX IF NOT EXISTS analytics_content_daily_likes_count_idx
  ON public.analytics_content_daily (likes_count DESC);

CREATE TABLE IF NOT EXISTS public.analytics_search_daily (
  day                     DATE        NOT NULL,
  normalized_query        TEXT        NULL,
  query_hash              TEXT        NOT NULL,
  searches_count          INT         NOT NULL DEFAULT 0,
  result_clicks_count     INT         NOT NULL DEFAULT 0,
  no_results_count        INT         NOT NULL DEFAULT 0,
  top_clicked_entity_type TEXT        NULL,
  top_clicked_entity_id   TEXT        NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (day, query_hash),

  CONSTRAINT analytics_search_daily_query_hash_not_empty
    CHECK (length(btrim(query_hash)) > 0),
  CONSTRAINT analytics_search_daily_normalized_query_not_empty
    CHECK (normalized_query IS NULL OR length(btrim(normalized_query)) > 0),
  CONSTRAINT analytics_search_daily_top_clicked_entity_type_check
    CHECK (
      top_clicked_entity_type IS NULL
      OR top_clicked_entity_type IN ('video', 'place', 'route', 'user', 'place_photo')
    ),
  CONSTRAINT analytics_search_daily_counts_nonnegative
    CHECK (
      searches_count >= 0
      AND result_clicks_count >= 0
      AND no_results_count >= 0
    )
);

CREATE INDEX IF NOT EXISTS analytics_search_daily_day_idx
  ON public.analytics_search_daily (day);

CREATE INDEX IF NOT EXISTS analytics_search_daily_searches_count_idx
  ON public.analytics_search_daily (searches_count DESC);

CREATE INDEX IF NOT EXISTS analytics_search_daily_no_results_count_idx
  ON public.analytics_search_daily (no_results_count DESC);

CREATE TABLE IF NOT EXISTS public.analytics_session_daily (
  day                DATE        NOT NULL,
  session_id         TEXT        NOT NULL,
  user_id            UUID        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id       TEXT        NULL,
  source             TEXT        NULL,
  platform           TEXT        NULL,
  events_count       INT         NOT NULL DEFAULT 0,
  screen_views_count INT         NOT NULL DEFAULT 0,
  started_at         TIMESTAMPTZ NULL,
  ended_at           TIMESTAMPTZ NULL,
  duration_seconds   NUMERIC     NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (day, session_id),

  CONSTRAINT analytics_session_daily_session_id_not_empty
    CHECK (length(btrim(session_id)) > 0),
  CONSTRAINT analytics_session_daily_source_check
    CHECK (source IS NULL OR source IN ('mobile', 'web', 'backend', 'admin')),
  CONSTRAINT analytics_session_daily_platform_check
    CHECK (platform IS NULL OR platform IN ('ios', 'android', 'web')),
  CONSTRAINT analytics_session_daily_counts_nonnegative
    CHECK (
      events_count >= 0
      AND screen_views_count >= 0
      AND duration_seconds >= 0
    )
);

CREATE INDEX IF NOT EXISTS analytics_session_daily_user_id_day_idx
  ON public.analytics_session_daily (user_id, day DESC);

CREATE INDEX IF NOT EXISTS analytics_session_daily_anonymous_id_day_idx
  ON public.analytics_session_daily (anonymous_id, day DESC);

CREATE TABLE IF NOT EXISTS public.admin_metrics_daily (
  day                     DATE        PRIMARY KEY,
  active_users_count      INT         NOT NULL DEFAULT 0,
  anonymous_users_count   INT         NOT NULL DEFAULT 0,
  sessions_count          INT         NOT NULL DEFAULT 0,
  events_count            INT         NOT NULL DEFAULT 0,
  screen_views_count      INT         NOT NULL DEFAULT 0,
  content_views_count     INT         NOT NULL DEFAULT 0,
  searches_count          INT         NOT NULL DEFAULT 0,
  reports_count           INT         NOT NULL DEFAULT 0,
  new_users_count         INT         NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT admin_metrics_daily_counts_nonnegative
    CHECK (
      active_users_count >= 0
      AND anonymous_users_count >= 0
      AND sessions_count >= 0
      AND events_count >= 0
      AND screen_views_count >= 0
      AND content_views_count >= 0
      AND searches_count >= 0
      AND reports_count >= 0
      AND new_users_count >= 0
    )
);

-- ============================================================================
-- User affinity tables for future recommendations and ranking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_content_affinity (
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type    TEXT        NOT NULL,
  entity_id      TEXT        NOT NULL,
  score          NUMERIC     NOT NULL DEFAULT 0,
  positive_score NUMERIC     NOT NULL DEFAULT 0,
  negative_score NUMERIC     NOT NULL DEFAULT 0,
  last_event_at  TIMESTAMPTZ NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entity_type, entity_id),

  CONSTRAINT user_content_affinity_entity_type_check
    CHECK (entity_type IN ('video', 'place', 'route', 'user', 'place_photo')),
  CONSTRAINT user_content_affinity_entity_id_not_empty
    CHECK (length(btrim(entity_id)) > 0),
  CONSTRAINT user_content_affinity_score_components_nonnegative
    CHECK (positive_score >= 0 AND negative_score >= 0)
);

CREATE INDEX IF NOT EXISTS user_content_affinity_entity_idx
  ON public.user_content_affinity (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS user_content_affinity_user_score_idx
  ON public.user_content_affinity (user_id, score DESC);

CREATE TABLE IF NOT EXISTS public.user_category_affinity (
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_key   TEXT        NOT NULL,
  score          NUMERIC     NOT NULL DEFAULT 0,
  positive_score NUMERIC     NOT NULL DEFAULT 0,
  negative_score NUMERIC     NOT NULL DEFAULT 0,
  last_event_at  TIMESTAMPTZ NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category_key),

  CONSTRAINT user_category_affinity_category_key_not_empty
    CHECK (length(btrim(category_key)) > 0),
  CONSTRAINT user_category_affinity_score_components_nonnegative
    CHECK (positive_score >= 0 AND negative_score >= 0)
);

CREATE INDEX IF NOT EXISTS user_category_affinity_user_score_idx
  ON public.user_category_affinity (user_id, score DESC);

-- ============================================================================
-- RLS and privileges
-- No client-facing policies are created. Service-side APIs must use service_role.
-- ============================================================================

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_event_dead_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_user_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_content_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_search_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_session_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_content_affinity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_category_affinity ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.analytics_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.analytics_event_dead_letters FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.analytics_user_daily FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.analytics_content_daily FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.analytics_search_daily FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.analytics_session_daily FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.admin_metrics_daily FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_content_affinity FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_category_affinity FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.analytics_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.analytics_event_dead_letters TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.analytics_user_daily TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.analytics_content_daily TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.analytics_search_daily TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.analytics_session_daily TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_metrics_daily TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_content_affinity TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_category_affinity TO service_role;

-- ============================================================================
-- Aggregation function
-- Recomputes target-day aggregates idempotently. Affinity tables are cumulative
-- and are rebuilt from all raw events each run so repeated calls are stable.
-- Scoring model:
--   video_view_start +1, video_view_3s +2, video_view_50 +4,
--   video_view_complete +6, video_like +5, place_click +2,
--   place_save +5, route_start +6, route_complete +10,
--   follow_user +8, search_result_clicked +3,
--   content_hidden -8, report_submitted -10, video_skip_fast -1.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.aggregate_analytics_events_for_day(target_day DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  day_start TIMESTAMPTZ;
  day_end   TIMESTAMPTZ;
BEGIN
  IF target_day IS NULL THEN
    RAISE EXCEPTION 'target_day must not be null';
  END IF;

  day_start := target_day::timestamp AT TIME ZONE 'UTC';
  day_end := (target_day + 1)::timestamp AT TIME ZONE 'UTC';

  DELETE FROM public.analytics_user_daily WHERE day = target_day;
  DELETE FROM public.analytics_content_daily WHERE day = target_day;
  DELETE FROM public.analytics_search_daily WHERE day = target_day;
  DELETE FROM public.analytics_session_daily WHERE day = target_day;
  DELETE FROM public.admin_metrics_daily WHERE day = target_day;

  INSERT INTO public.analytics_user_daily (
    day,
    user_id,
    sessions_count,
    events_count,
    screen_views_count,
    video_views_count,
    place_views_count,
    route_views_count,
    searches_count,
    follows_count,
    likes_count,
    saves_count,
    reports_count,
    first_seen_at,
    last_seen_at
  )
  SELECT
    target_day,
    e.user_id,
    COUNT(DISTINCT e.session_id)::int,
    COUNT(*)::int,
    (COUNT(*) FILTER (WHERE e.event_name = 'screen_view'))::int,
    (
      COUNT(*) FILTER (
        WHERE e.event_name IN ('video_view', 'video_view_start')
      )
    )::int,
    (
      COUNT(*) FILTER (
        WHERE e.event_name = 'place_view'
          OR (e.entity_type = 'place' AND e.event_name = 'content_view')
      )
    )::int,
    (
      COUNT(*) FILTER (
        WHERE e.event_name = 'route_view'
          OR (e.entity_type = 'route' AND e.event_name = 'content_view')
      )
    )::int,
    (
      COUNT(*) FILTER (
        WHERE e.event_name IN ('search_performed', 'search_submitted', 'search_no_results')
      )
    )::int,
    (COUNT(*) FILTER (WHERE e.event_name = 'follow_user'))::int,
    (
      COUNT(*) FILTER (
        WHERE e.event_name IN ('content_like', 'video_like', 'place_like', 'route_like', 'place_photo_like')
      )
    )::int,
    (
      COUNT(*) FILTER (
        WHERE e.event_name IN ('content_save', 'video_save', 'place_save', 'route_save', 'place_photo_save')
      )
    )::int,
    (COUNT(*) FILTER (WHERE e.event_name = 'report_submitted'))::int,
    MIN(e.occurred_at),
    MAX(e.occurred_at)
  FROM public.analytics_events e
  WHERE e.user_id IS NOT NULL
    AND e.occurred_at >= day_start
    AND e.occurred_at < day_end
  GROUP BY e.user_id;

  INSERT INTO public.analytics_session_daily (
    day,
    session_id,
    user_id,
    anonymous_id,
    source,
    platform,
    events_count,
    screen_views_count,
    started_at,
    ended_at,
    duration_seconds,
    updated_at
  )
  SELECT
    target_day,
    e.session_id,
    (array_agg(e.user_id ORDER BY e.occurred_at) FILTER (WHERE e.user_id IS NOT NULL))[1],
    (array_agg(e.anonymous_id ORDER BY e.occurred_at) FILTER (WHERE e.anonymous_id IS NOT NULL))[1],
    (array_agg(e.source ORDER BY e.occurred_at) FILTER (WHERE e.source IS NOT NULL))[1],
    (array_agg(e.platform ORDER BY e.occurred_at) FILTER (WHERE e.platform IS NOT NULL))[1],
    COUNT(*)::int,
    (COUNT(*) FILTER (WHERE e.event_name = 'screen_view'))::int,
    MIN(e.occurred_at),
    MAX(e.occurred_at),
    GREATEST(EXTRACT(EPOCH FROM (MAX(e.occurred_at) - MIN(e.occurred_at))), 0)::numeric,
    now()
  FROM public.analytics_events e
  WHERE e.occurred_at >= day_start
    AND e.occurred_at < day_end
  GROUP BY e.session_id;

  WITH content_events AS (
    SELECT
      e.entity_type,
      e.entity_id,
      e.user_id,
      e.anonymous_id,
      e.event_name,
      CASE
        WHEN e.properties ? 'watch_seconds'
          AND (e.properties->>'watch_seconds') ~ '^[0-9]+(\.[0-9]+)?$'
          THEN LEAST((e.properties->>'watch_seconds')::numeric, 86400)
        WHEN e.properties ? 'duration_seconds'
          AND (e.properties->>'duration_seconds') ~ '^[0-9]+(\.[0-9]+)?$'
          THEN LEAST((e.properties->>'duration_seconds')::numeric, 86400)
        ELSE 0
      END AS watch_seconds
    FROM public.analytics_events e
    WHERE e.occurred_at >= day_start
      AND e.occurred_at < day_end
      AND e.entity_type IN ('video', 'place', 'route', 'user', 'place_photo')
      AND NULLIF(btrim(e.entity_id), '') IS NOT NULL
  )
  INSERT INTO public.analytics_content_daily (
    day,
    entity_type,
    entity_id,
    impressions_count,
    views_count,
    clicks_count,
    likes_count,
    comments_count,
    shares_count,
    saves_count,
    route_starts_count,
    route_completions_count,
    reports_count,
    hides_count,
    unique_users_count,
    total_watch_seconds,
    avg_watch_seconds,
    updated_at
  )
  SELECT
    target_day,
    entity_type,
    entity_id,
    (
      COUNT(*) FILTER (
        WHERE event_name IN (
          'content_impression',
          'video_impression',
          'place_impression',
          'route_impression',
          'user_impression',
          'place_photo_impression'
        )
      )
    )::int,
    (
      COUNT(*) FILTER (
        WHERE event_name IN (
          'content_view',
          'video_view',
          'video_view_start',
          'place_view',
          'route_view',
          'user_profile_view',
          'place_photo_view'
        )
      )
    )::int,
    (
      COUNT(*) FILTER (
        WHERE event_name IN (
          'content_click',
          'place_click',
          'route_click',
          'user_click',
          'place_photo_click',
          'search_result_clicked'
        )
      )
    )::int,
    (
      COUNT(*) FILTER (
        WHERE event_name IN ('content_like', 'video_like', 'place_like', 'route_like', 'place_photo_like')
      )
    )::int,
    (
      COUNT(*) FILTER (
        WHERE event_name IN ('content_comment', 'video_comment', 'place_comment', 'route_comment', 'place_photo_comment')
      )
    )::int,
    (
      COUNT(*) FILTER (
        WHERE event_name IN ('content_share', 'video_share', 'place_share', 'route_share', 'place_photo_share')
      )
    )::int,
    (
      COUNT(*) FILTER (
        WHERE event_name IN ('content_save', 'video_save', 'place_save', 'route_save', 'place_photo_save')
      )
    )::int,
    (COUNT(*) FILTER (WHERE event_name = 'route_start'))::int,
    (COUNT(*) FILTER (WHERE event_name = 'route_complete'))::int,
    (COUNT(*) FILTER (WHERE event_name = 'report_submitted'))::int,
    (COUNT(*) FILTER (WHERE event_name = 'content_hidden'))::int,
    COUNT(DISTINCT COALESCE(user_id::text, NULLIF(anonymous_id, '')))::int,
    COALESCE(SUM(watch_seconds), 0),
    COALESCE(AVG(watch_seconds) FILTER (WHERE watch_seconds > 0), 0),
    now()
  FROM content_events
  GROUP BY entity_type, entity_id;

  WITH search_events AS (
    SELECT
      e.event_name,
      NULLIF(lower(btrim(e.properties->>'query_hash')), '') AS provided_query_hash,
      NULLIF(lower(btrim(e.properties->>'query')), '') AS normalized_candidate,
      NULLIF(btrim(e.entity_id), '') AS fallback_search_id,
      CASE
        WHEN e.event_name = 'search_result_clicked' THEN
          COALESCE(
            NULLIF(btrim(e.properties->>'clicked_entity_type'), ''),
            CASE WHEN e.entity_type <> 'search' THEN e.entity_type END
          )
        ELSE NULL
      END AS clicked_entity_type,
      CASE
        WHEN e.event_name = 'search_result_clicked' THEN
          COALESCE(
            NULLIF(btrim(e.properties->>'clicked_entity_id'), ''),
            CASE WHEN e.entity_type <> 'search' THEN e.entity_id END
          )
        ELSE NULL
      END AS clicked_entity_id
    FROM public.analytics_events e
    WHERE e.occurred_at >= day_start
      AND e.occurred_at < day_end
      AND (
        e.event_name IN ('search_performed', 'search_submitted', 'search_result_clicked', 'search_no_results')
        OR e.entity_type = 'search'
      )
  ),
  keyed_search_events AS (
    SELECT
      event_name,
      COALESCE(
        provided_query_hash,
        CASE
          WHEN normalized_candidate IS NOT NULL
            THEN encode(digest(normalized_candidate, 'sha256'), 'hex')
        END,
        CASE
          WHEN fallback_search_id IS NOT NULL
            THEN encode(digest(fallback_search_id, 'sha256'), 'hex')
        END
      ) AS query_hash,
      clicked_entity_type,
      clicked_entity_id
    FROM search_events
  ),
  grouped_searches AS (
    SELECT
      query_hash,
      (COUNT(*) FILTER (WHERE event_name IN ('search_performed', 'search_submitted')))::int AS searches_count,
      (COUNT(*) FILTER (WHERE event_name = 'search_result_clicked'))::int AS result_clicks_count,
      (COUNT(*) FILTER (WHERE event_name = 'search_no_results'))::int AS no_results_count
    FROM keyed_search_events
    WHERE query_hash IS NOT NULL
    GROUP BY query_hash
  ),
  top_clicked AS (
    SELECT
      query_hash,
      clicked_entity_type,
      clicked_entity_id,
      ROW_NUMBER() OVER (
        PARTITION BY query_hash
        ORDER BY COUNT(*) DESC, clicked_entity_type ASC, clicked_entity_id ASC
      ) AS click_rank
    FROM keyed_search_events
    WHERE query_hash IS NOT NULL
      AND clicked_entity_type IN ('video', 'place', 'route', 'user', 'place_photo')
      AND NULLIF(btrim(clicked_entity_id), '') IS NOT NULL
    GROUP BY query_hash, clicked_entity_type, clicked_entity_id
  )
  INSERT INTO public.analytics_search_daily (
    day,
    normalized_query,
    query_hash,
    searches_count,
    result_clicks_count,
    no_results_count,
    top_clicked_entity_type,
    top_clicked_entity_id,
    updated_at
  )
  SELECT
    target_day,
    NULL::text,
    g.query_hash,
    g.searches_count,
    g.result_clicks_count,
    g.no_results_count,
    tc.clicked_entity_type,
    tc.clicked_entity_id,
    now()
  FROM grouped_searches g
  LEFT JOIN top_clicked tc
    ON tc.query_hash = g.query_hash
   AND tc.click_rank = 1;

  WITH first_user_days AS (
    SELECT
      user_id,
      MIN((occurred_at AT TIME ZONE 'UTC')::date) AS first_day
    FROM public.analytics_events
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  ),
  day_events AS (
    SELECT *
    FROM public.analytics_events
    WHERE occurred_at >= day_start
      AND occurred_at < day_end
  )
  INSERT INTO public.admin_metrics_daily (
    day,
    active_users_count,
    anonymous_users_count,
    sessions_count,
    events_count,
    screen_views_count,
    content_views_count,
    searches_count,
    reports_count,
    new_users_count,
    updated_at
  )
  SELECT
    target_day,
    (COUNT(DISTINCT d.user_id) FILTER (WHERE d.user_id IS NOT NULL))::int,
    (
      COUNT(DISTINCT d.anonymous_id) FILTER (
        WHERE d.user_id IS NULL AND NULLIF(d.anonymous_id, '') IS NOT NULL
      )
    )::int,
    COUNT(DISTINCT d.session_id)::int,
    COUNT(*)::int,
    (COUNT(*) FILTER (WHERE d.event_name = 'screen_view'))::int,
    (
      COUNT(*) FILTER (
        WHERE d.event_name IN (
          'content_view',
          'video_view',
          'video_view_start',
          'place_view',
          'route_view',
          'user_profile_view',
          'place_photo_view'
        )
      )
    )::int,
    (
      COUNT(*) FILTER (
        WHERE d.event_name IN ('search_performed', 'search_submitted', 'search_no_results')
      )
    )::int,
    (COUNT(*) FILTER (WHERE d.event_name = 'report_submitted'))::int,
    (COUNT(DISTINCT f.user_id) FILTER (WHERE f.first_day = target_day))::int,
    now()
  FROM day_events d
  LEFT JOIN first_user_days f ON f.user_id = d.user_id;

  DELETE FROM public.user_content_affinity;

  WITH scored_events AS (
    SELECT
      e.user_id,
      e.entity_type,
      e.entity_id,
      e.occurred_at,
      CASE e.event_name
        WHEN 'video_view_start' THEN 1
        WHEN 'video_view_3s' THEN 2
        WHEN 'video_view_50' THEN 4
        WHEN 'video_view_complete' THEN 6
        WHEN 'video_like' THEN 5
        WHEN 'place_click' THEN 2
        WHEN 'place_save' THEN 5
        WHEN 'route_start' THEN 6
        WHEN 'route_complete' THEN 10
        WHEN 'follow_user' THEN 8
        WHEN 'search_result_clicked' THEN 3
        WHEN 'content_hidden' THEN -8
        WHEN 'report_submitted' THEN -10
        WHEN 'video_skip_fast' THEN -1
        ELSE 0
      END::numeric AS signal_score
    FROM public.analytics_events e
    WHERE e.user_id IS NOT NULL
      AND e.entity_type IN ('video', 'place', 'route', 'user', 'place_photo')
      AND NULLIF(btrim(e.entity_id), '') IS NOT NULL
  )
  INSERT INTO public.user_content_affinity (
    user_id,
    entity_type,
    entity_id,
    score,
    positive_score,
    negative_score,
    last_event_at,
    updated_at
  )
  SELECT
    user_id,
    entity_type,
    entity_id,
    SUM(signal_score),
    SUM(GREATEST(signal_score, 0)),
    SUM(GREATEST(-signal_score, 0)),
    MAX(occurred_at),
    now()
  FROM scored_events
  WHERE signal_score <> 0
  GROUP BY user_id, entity_type, entity_id;

  DELETE FROM public.user_category_affinity;

  WITH scored_events AS (
    SELECT
      e.user_id,
      COALESCE(
        NULLIF(btrim(e.properties->>'category_key'), ''),
        NULLIF(btrim(e.properties->>'category'), ''),
        NULLIF(btrim(e.context->>'category_key'), ''),
        NULLIF(btrim(e.context->>'category'), '')
      ) AS category_key,
      e.occurred_at,
      CASE e.event_name
        WHEN 'video_view_start' THEN 1
        WHEN 'video_view_3s' THEN 2
        WHEN 'video_view_50' THEN 4
        WHEN 'video_view_complete' THEN 6
        WHEN 'video_like' THEN 5
        WHEN 'place_click' THEN 2
        WHEN 'place_save' THEN 5
        WHEN 'route_start' THEN 6
        WHEN 'route_complete' THEN 10
        WHEN 'follow_user' THEN 8
        WHEN 'search_result_clicked' THEN 3
        WHEN 'content_hidden' THEN -8
        WHEN 'report_submitted' THEN -10
        WHEN 'video_skip_fast' THEN -1
        ELSE 0
      END::numeric AS signal_score
    FROM public.analytics_events e
    WHERE e.user_id IS NOT NULL
  )
  INSERT INTO public.user_category_affinity (
    user_id,
    category_key,
    score,
    positive_score,
    negative_score,
    last_event_at,
    updated_at
  )
  SELECT
    user_id,
    category_key,
    SUM(signal_score),
    SUM(GREATEST(signal_score, 0)),
    SUM(GREATEST(-signal_score, 0)),
    MAX(occurred_at),
    now()
  FROM scored_events
  WHERE signal_score <> 0
    AND category_key IS NOT NULL
  GROUP BY user_id, category_key;
END;
$$;

REVOKE ALL ON FUNCTION public.aggregate_analytics_events_for_day(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aggregate_analytics_events_for_day(DATE) TO service_role;

COMMENT ON FUNCTION public.aggregate_analytics_events_for_day(DATE)
  IS 'Server-side analytics aggregation for a UTC calendar day. Recomputes daily aggregates and cumulative affinity tables from raw events.';

-- ============================================================================
-- Admin read views
-- These are intended for server-side admin APIs only.
-- ============================================================================

CREATE OR REPLACE VIEW public.admin_analytics_overview_daily
WITH (security_invoker = true)
AS
SELECT
  m.day,
  m.active_users_count,
  m.anonymous_users_count,
  m.sessions_count,
  m.events_count,
  m.screen_views_count,
  m.content_views_count,
  m.searches_count,
  m.reports_count,
  m.new_users_count,
  COALESCE(SUM(c.impressions_count), 0)::bigint AS content_impressions_count,
  COALESCE(SUM(c.likes_count), 0)::bigint AS content_likes_count,
  COALESCE(SUM(c.saves_count), 0)::bigint AS content_saves_count,
  COALESCE(SUM(c.shares_count), 0)::bigint AS content_shares_count,
  COALESCE(SUM(c.hides_count), 0)::bigint AS content_hides_count
FROM public.admin_metrics_daily m
LEFT JOIN public.analytics_content_daily c ON c.day = m.day
GROUP BY
  m.day,
  m.active_users_count,
  m.anonymous_users_count,
  m.sessions_count,
  m.events_count,
  m.screen_views_count,
  m.content_views_count,
  m.searches_count,
  m.reports_count,
  m.new_users_count;

CREATE OR REPLACE VIEW public.admin_top_content_daily
WITH (security_invoker = true)
AS
SELECT
  day,
  entity_type,
  entity_id,
  impressions_count,
  views_count,
  clicks_count,
  likes_count,
  comments_count,
  shares_count,
  saves_count,
  route_starts_count,
  route_completions_count,
  reports_count,
  hides_count,
  unique_users_count,
  total_watch_seconds,
  avg_watch_seconds,
  (
    views_count
    + clicks_count
    + likes_count
    + comments_count
    + shares_count
    + saves_count
    + route_starts_count
    + route_completions_count
    - reports_count
    - hides_count
  ) AS engagement_score
FROM public.analytics_content_daily;

CREATE OR REPLACE VIEW public.admin_search_insights_daily
WITH (security_invoker = true)
AS
SELECT
  day,
  normalized_query,
  query_hash,
  searches_count,
  result_clicks_count,
  no_results_count,
  CASE
    WHEN searches_count > 0 THEN ROUND(result_clicks_count::numeric / searches_count, 4)
    ELSE 0
  END AS click_through_rate,
  CASE
    WHEN searches_count > 0 THEN ROUND(no_results_count::numeric / searches_count, 4)
    ELSE 0
  END AS no_results_rate,
  top_clicked_entity_type,
  top_clicked_entity_id
FROM public.analytics_search_daily;

CREATE OR REPLACE VIEW public.admin_user_growth_daily
WITH (security_invoker = true)
AS
WITH first_seen_users AS (
  SELECT
    user_id,
    MIN(day) AS first_day
  FROM public.analytics_user_daily
  GROUP BY user_id
)
SELECT
  u.day,
  COUNT(DISTINCT u.user_id)::int AS active_users_count,
  (COUNT(DISTINCT u.user_id) FILTER (WHERE f.first_day = u.day))::int AS new_users_count,
  COALESCE(SUM(u.sessions_count), 0)::bigint AS sessions_count,
  COALESCE(SUM(u.events_count), 0)::bigint AS events_count,
  COALESCE(SUM(u.screen_views_count), 0)::bigint AS screen_views_count,
  COALESCE(SUM(u.searches_count), 0)::bigint AS searches_count,
  MIN(u.first_seen_at) AS first_seen_at,
  MAX(u.last_seen_at) AS last_seen_at
FROM public.analytics_user_daily u
JOIN first_seen_users f ON f.user_id = u.user_id
GROUP BY u.day;

REVOKE ALL ON TABLE public.admin_analytics_overview_daily FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.admin_top_content_daily FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.admin_search_insights_daily FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.admin_user_growth_daily FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.admin_analytics_overview_daily TO service_role;
GRANT SELECT ON TABLE public.admin_top_content_daily TO service_role;
GRANT SELECT ON TABLE public.admin_search_insights_daily TO service_role;
GRANT SELECT ON TABLE public.admin_user_growth_daily TO service_role;

COMMENT ON TABLE public.analytics_events IS 'Raw analytics events. No direct client read/write access; ingestion must happen server-side.';
COMMENT ON TABLE public.analytics_event_dead_letters IS 'Rejected analytics payloads after server-side redaction.';
COMMENT ON TABLE public.analytics_search_daily IS 'Search aggregate keyed by hash. normalized_query remains nullable for privacy-sensitive searches.';
COMMENT ON TABLE public.user_content_affinity IS 'Cumulative per-user content affinity scores for future recommendation systems.';
COMMENT ON TABLE public.user_category_affinity IS 'Cumulative per-user category affinity scores for future recommendation systems.';
