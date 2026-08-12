with analytics as (
  select
    count(*)::bigint as total,
    min(occurred_at) as first_occurred_at,
    max(occurred_at) as last_occurred_at,
    count(*) filter (where nullif(country, '') is not null)::bigint as with_country,
    count(*) filter (where nullif(region, '') is not null)::bigint as with_region,
    count(*) filter (where nullif(city, '') is not null)::bigint as with_city,
    count(*) filter (where nullif(timezone, '') is not null)::bigint as with_timezone,
    count(*) filter (
      where nullif(timezone, '') is not null
        and not exists (select 1 from pg_timezone_names tz where tz.name = analytics_events.timezone)
    )::bigint as invalid_timezone,
    count(*) filter (where entity_type = 'place')::bigint as place_events,
    count(*) filter (
      where entity_type = 'place'
        and exists (select 1 from public.places p where p.id::text = analytics_events.entity_id)
    )::bigint as resolvable_place_events,
    count(*) filter (where entity_type = 'route')::bigint as route_events,
    count(*) filter (
      where entity_type = 'route'
        and exists (select 1 from public.routes r where r.id::text = analytics_events.entity_id)
    )::bigint as resolvable_route_events
  from public.analytics_events
),
relation_counts as (
  select jsonb_object_agg(name, row_count) as value
  from (
    select 'analytics_event_dead_letters' as name, count(*)::bigint as row_count from public.analytics_event_dead_letters
    union all select 'places', count(*)::bigint from public.places
    union all select 'routes', count(*)::bigint from public.routes
    union all select 'videos', count(*)::bigint from public.videos
    union all select 'users', count(*)::bigint from public.users
  ) counts
),
relation_sizes as (
  select jsonb_object_agg(relname, pg_total_relation_size(format('public.%I', relname)::regclass)) as value
  from (values ('analytics_events'), ('places'), ('routes'), ('videos'), ('users')) relations(relname)
),
geo_cardinality as (
  select jsonb_build_object(
    'countries', count(distinct nullif(country, '')),
    'regions', count(distinct nullif(region, '')),
    'cities', count(distinct nullif(city, '')),
    'timezones', count(distinct nullif(timezone, ''))
  ) as value
  from public.analytics_events
)
select jsonb_build_object(
  'analytics', to_jsonb(analytics),
  'relation_counts', relation_counts.value,
  'relation_sizes_bytes', relation_sizes.value,
  'geo_cardinality', geo_cardinality.value,
  'security', jsonb_build_object(
    'authenticated_can_create_public_schema', has_schema_privilege('authenticated', 'public', 'create'),
    'anon_can_create_public_schema', has_schema_privilege('anon', 'public', 'create'),
    'aggregate_authenticated_execute', has_function_privilege('authenticated', 'public.aggregate_analytics_events_for_day(date)', 'execute'),
    'aggregate_service_role_execute', has_function_privilege('service_role', 'public.aggregate_analytics_events_for_day(date)', 'execute'),
    'analytics_events_rls', (select relrowsecurity from pg_class where oid = 'public.analytics_events'::regclass)
  )
) as production_preflight
from analytics, relation_counts, relation_sizes, geo_cardinality;
