CREATE OR REPLACE FUNCTION public.aggregate_analytics_events_for_day(target_day date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
$function$
