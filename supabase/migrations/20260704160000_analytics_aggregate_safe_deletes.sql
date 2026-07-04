-- DATA-005: fix bare DELETEs that fail under service_role / pg_safeupdate.
-- Even with SECURITY DEFINER, unqualified DELETE FROM table is blocked.
-- Affinity tables are full rebuilds, so WHERE TRUE is intentional and safe.

create or replace function public.aggregate_analytics_events_for_day(target_day date)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  day_start timestamptz;
  day_end   timestamptz;
begin
  if target_day is null then
    raise exception 'target_day must not be null';
  end if;

  day_start := target_day::timestamp at time zone 'UTC';
  day_end := (target_day + 1)::timestamp at time zone 'UTC';

  delete from public.analytics_user_daily where day = target_day;
  delete from public.analytics_content_daily where day = target_day;
  delete from public.analytics_search_daily where day = target_day;
  delete from public.analytics_session_daily where day = target_day;
  delete from public.admin_metrics_daily where day = target_day;

  insert into public.analytics_user_daily (
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
  select
    target_day,
    e.user_id,
    count(distinct e.session_id)::int,
    count(*)::int,
    (count(*) filter (where e.event_name = 'screen_view'))::int,
    (
      count(*) filter (
        where e.event_name in ('video_view', 'video_view_start')
      )
    )::int,
    (
      count(*) filter (
        where e.event_name = 'place_view'
          or (e.entity_type = 'place' and e.event_name = 'content_view')
      )
    )::int,
    (
      count(*) filter (
        where e.event_name = 'route_view'
          or (e.entity_type = 'route' and e.event_name = 'content_view')
      )
    )::int,
    (
      count(*) filter (
        where e.event_name in ('search_performed', 'search_submitted', 'search_no_results')
      )
    )::int,
    (count(*) filter (where e.event_name = 'follow_user'))::int,
    (
      count(*) filter (
        where e.event_name in ('content_like', 'video_like', 'place_like', 'route_like', 'place_photo_like')
      )
    )::int,
    (
      count(*) filter (
        where e.event_name in ('content_save', 'video_save', 'place_save', 'route_save', 'place_photo_save')
      )
    )::int,
    (count(*) filter (where e.event_name = 'report_submitted'))::int,
    min(e.occurred_at),
    max(e.occurred_at)
  from public.analytics_events e
  where e.user_id is not null
    and e.occurred_at >= day_start
    and e.occurred_at < day_end
  group by e.user_id;

  insert into public.analytics_session_daily (
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
  select
    target_day,
    e.session_id,
    (array_agg(e.user_id order by e.occurred_at) filter (where e.user_id is not null))[1],
    (array_agg(e.anonymous_id order by e.occurred_at) filter (where e.anonymous_id is not null))[1],
    (array_agg(e.source order by e.occurred_at) filter (where e.source is not null))[1],
    (array_agg(e.platform order by e.occurred_at) filter (where e.platform is not null))[1],
    count(*)::int,
    (count(*) filter (where e.event_name = 'screen_view'))::int,
    min(e.occurred_at),
    max(e.occurred_at),
    greatest(extract(epoch from (max(e.occurred_at) - min(e.occurred_at))), 0)::numeric,
    now()
  from public.analytics_events e
  where e.occurred_at >= day_start
    and e.occurred_at < day_end
  group by e.session_id;

  with content_events as (
    select
      e.entity_type,
      e.entity_id,
      e.user_id,
      e.anonymous_id,
      e.event_name,
      case
        when e.properties ? 'watch_seconds'
          and (e.properties->>'watch_seconds') ~ '^[0-9]+(\.[0-9]+)?$'
          then least((e.properties->>'watch_seconds')::numeric, 86400)
        when e.properties ? 'duration_seconds'
          and (e.properties->>'duration_seconds') ~ '^[0-9]+(\.[0-9]+)?$'
          then least((e.properties->>'duration_seconds')::numeric, 86400)
        else 0
      end as watch_seconds
    from public.analytics_events e
    where e.occurred_at >= day_start
      and e.occurred_at < day_end
      and e.entity_type in ('video', 'place', 'route', 'user', 'place_photo')
      and nullif(btrim(e.entity_id), '') is not null
  )
  insert into public.analytics_content_daily (
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
  select
    target_day,
    entity_type,
    entity_id,
    (
      count(*) filter (
        where event_name in (
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
      count(*) filter (
        where event_name in (
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
      count(*) filter (
        where event_name in (
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
      count(*) filter (
        where event_name in ('content_like', 'video_like', 'place_like', 'route_like', 'place_photo_like')
      )
    )::int,
    (
      count(*) filter (
        where event_name in ('content_comment', 'video_comment', 'place_comment', 'route_comment', 'place_photo_comment')
      )
    )::int,
    (
      count(*) filter (
        where event_name in ('content_share', 'video_share', 'place_share', 'route_share', 'place_photo_share')
      )
    )::int,
    (
      count(*) filter (
        where event_name in ('content_save', 'video_save', 'place_save', 'route_save', 'place_photo_save')
      )
    )::int,
    (count(*) filter (where event_name = 'route_start'))::int,
    (count(*) filter (where event_name = 'route_complete'))::int,
    (count(*) filter (where event_name = 'report_submitted'))::int,
    (count(*) filter (where event_name = 'content_hidden'))::int,
    count(distinct coalesce(user_id::text, nullif(anonymous_id, '')))::int,
    coalesce(sum(watch_seconds), 0),
    coalesce(avg(watch_seconds) filter (where watch_seconds > 0), 0),
    now()
  from content_events
  group by entity_type, entity_id;

  with search_events as (
    select
      e.event_name,
      nullif(lower(btrim(e.properties->>'query_hash')), '') as provided_query_hash,
      nullif(lower(btrim(e.properties->>'query')), '') as normalized_candidate,
      nullif(btrim(e.entity_id), '') as fallback_search_id,
      case
        when e.event_name = 'search_result_clicked' then
          coalesce(
            nullif(btrim(e.properties->>'clicked_entity_type'), ''),
            case when e.entity_type <> 'search' then e.entity_type end
          )
        else null
      end as clicked_entity_type,
      case
        when e.event_name = 'search_result_clicked' then
          coalesce(
            nullif(btrim(e.properties->>'clicked_entity_id'), ''),
            case when e.entity_type <> 'search' then e.entity_id end
          )
        else null
      end as clicked_entity_id
    from public.analytics_events e
    where e.occurred_at >= day_start
      and e.occurred_at < day_end
      and (
        e.event_name in ('search_performed', 'search_submitted', 'search_result_clicked', 'search_no_results')
        or e.entity_type = 'search'
      )
  ),
  keyed_search_events as (
    select
      event_name,
      coalesce(
        provided_query_hash,
        case
          when normalized_candidate is not null
            then encode(digest(normalized_candidate, 'sha256'), 'hex')
        end,
        case
          when fallback_search_id is not null
            then encode(digest(fallback_search_id, 'sha256'), 'hex')
        end
      ) as query_hash,
      clicked_entity_type,
      clicked_entity_id
    from search_events
  ),
  grouped_searches as (
    select
      query_hash,
      (count(*) filter (where event_name in ('search_performed', 'search_submitted')))::int as searches_count,
      (count(*) filter (where event_name = 'search_result_clicked'))::int as result_clicks_count,
      (count(*) filter (where event_name = 'search_no_results'))::int as no_results_count
    from keyed_search_events
    where query_hash is not null
    group by query_hash
  ),
  top_clicked as (
    select
      query_hash,
      clicked_entity_type,
      clicked_entity_id,
      row_number() over (
        partition by query_hash
        order by count(*) desc, clicked_entity_type asc, clicked_entity_id asc
      ) as click_rank
    from keyed_search_events
    where query_hash is not null
      and clicked_entity_type in ('video', 'place', 'route', 'user', 'place_photo')
      and nullif(btrim(clicked_entity_id), '') is not null
    group by query_hash, clicked_entity_type, clicked_entity_id
  )
  insert into public.analytics_search_daily (
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
  select
    target_day,
    null::text,
    g.query_hash,
    g.searches_count,
    g.result_clicks_count,
    g.no_results_count,
    tc.clicked_entity_type,
    tc.clicked_entity_id,
    now()
  from grouped_searches g
  left join top_clicked tc
    on tc.query_hash = g.query_hash
   and tc.click_rank = 1;

  with first_user_days as (
    select
      user_id,
      min((occurred_at at time zone 'UTC')::date) as first_day
    from public.analytics_events
    where user_id is not null
    group by user_id
  ),
  day_events as (
    select *
    from public.analytics_events
    where occurred_at >= day_start
      and occurred_at < day_end
  )
  insert into public.admin_metrics_daily (
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
  select
    target_day,
    (count(distinct d.user_id) filter (where d.user_id is not null))::int,
    (
      count(distinct d.anonymous_id) filter (
        where d.user_id is null and nullif(d.anonymous_id, '') is not null
      )
    )::int,
    count(distinct d.session_id)::int,
    count(*)::int,
    (count(*) filter (where d.event_name = 'screen_view'))::int,
    (
      count(*) filter (
        where d.event_name in (
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
      count(*) filter (
        where d.event_name in ('search_performed', 'search_submitted', 'search_no_results')
      )
    )::int,
    (count(*) filter (where d.event_name = 'report_submitted'))::int,
    (count(distinct f.user_id) filter (where f.first_day = target_day))::int,
    now()
  from day_events d
  left join first_user_days f on f.user_id = d.user_id;

  -- Full rebuild of affinity tables (must include WHERE for pg_safeupdate).
  delete from public.user_content_affinity where true;

  with scored_events as (
    select
      e.user_id,
      e.entity_type,
      e.entity_id,
      e.occurred_at,
      case e.event_name
        when 'video_view_start' then 1
        when 'video_view_3s' then 2
        when 'video_view_50' then 4
        when 'video_view_complete' then 6
        when 'video_like' then 5
        when 'place_click' then 2
        when 'place_save' then 5
        when 'route_start' then 6
        when 'route_complete' then 10
        when 'follow_user' then 8
        when 'search_result_clicked' then 3
        when 'content_hidden' then -8
        when 'report_submitted' then -10
        when 'video_skip_fast' then -1
        else 0
      end::numeric as signal_score
    from public.analytics_events e
    where e.user_id is not null
      and e.entity_type in ('video', 'place', 'route', 'user', 'place_photo')
      and nullif(btrim(e.entity_id), '') is not null
  )
  insert into public.user_content_affinity (
    user_id,
    entity_type,
    entity_id,
    score,
    positive_score,
    negative_score,
    last_event_at,
    updated_at
  )
  select
    user_id,
    entity_type,
    entity_id,
    sum(signal_score),
    sum(greatest(signal_score, 0)),
    sum(greatest(-signal_score, 0)),
    max(occurred_at),
    now()
  from scored_events
  where signal_score <> 0
  group by user_id, entity_type, entity_id;

  delete from public.user_category_affinity where true;

  with scored_events as (
    select
      e.user_id,
      coalesce(
        nullif(btrim(e.properties->>'category_key'), ''),
        nullif(btrim(e.properties->>'category'), ''),
        nullif(btrim(e.context->>'category_key'), ''),
        nullif(btrim(e.context->>'category'), '')
      ) as category_key,
      e.occurred_at,
      case e.event_name
        when 'video_view_start' then 1
        when 'video_view_3s' then 2
        when 'video_view_50' then 4
        when 'video_view_complete' then 6
        when 'video_like' then 5
        when 'place_click' then 2
        when 'place_save' then 5
        when 'route_start' then 6
        when 'route_complete' then 10
        when 'follow_user' then 8
        when 'search_result_clicked' then 3
        when 'content_hidden' then -8
        when 'report_submitted' then -10
        when 'video_skip_fast' then -1
        else 0
      end::numeric as signal_score
    from public.analytics_events e
    where e.user_id is not null
  )
  insert into public.user_category_affinity (
    user_id,
    category_key,
    score,
    positive_score,
    negative_score,
    last_event_at,
    updated_at
  )
  select
    user_id,
    category_key,
    sum(signal_score),
    sum(greatest(signal_score, 0)),
    sum(greatest(-signal_score, 0)),
    max(occurred_at),
    now()
  from scored_events
  where signal_score <> 0
    and category_key is not null
  group by user_id, category_key;
end;
$function$;

alter function public.aggregate_analytics_events_for_day(date) owner to postgres;
alter function public.aggregate_analytics_events_for_day(date) security definer;
alter function public.aggregate_analytics_events_for_day(date) set search_path to public, extensions;
grant execute on function public.aggregate_analytics_events_for_day(date) to service_role;
grant execute on function public.aggregate_analytics_events_for_day(date) to authenticated;
