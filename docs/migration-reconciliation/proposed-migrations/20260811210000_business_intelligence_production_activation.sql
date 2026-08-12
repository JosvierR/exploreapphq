-- Explore Business Intelligence v2 production activation.
-- Idempotent dimensions/backfill helpers, schema verification, quality reports,
-- feature gating, and production job observability.

alter table public.business_accounts
  add column if not exists bi_v2_enabled boolean not null default false;

alter table public.geo_entities
  add column if not exists geo_type text generated always as (type) stored;

create unique index if not exists geo_entities_canonical_hierarchy_uidx
  on public.geo_entities(country_code, type, canonical_name, parent_geo_id) nulls not distinct;

alter table public.dim_places add column if not exists canonical_name text;
alter table public.dim_places add column if not exists latitude numeric(9, 6);
alter table public.dim_places add column if not exists longitude numeric(9, 6);
alter table public.dim_places add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.dim_places add column if not exists updated_at timestamptz not null default now();

alter table public.dim_routes add column if not exists canonical_name text;
alter table public.dim_routes add column if not exists creator_id text;
alter table public.dim_routes add column if not exists stop_count integer;
alter table public.dim_routes add column if not exists status text;
alter table public.dim_routes add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.dim_routes add column if not exists updated_at timestamptz not null default now();

create table if not exists public.business_category_mappings (
  legacy_key text primary key,
  category_id text not null,
  canonical_name text not null,
  parent_category_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.business_category_mappings(legacy_key, category_id, canonical_name, parent_category_id) values
  ('restaurant', 'restaurant', 'Restaurant', 'food-dining'),
  ('restaurants', 'restaurant', 'Restaurant', 'food-dining'),
  ('food', 'food-dining', 'Food & Dining', null),
  ('food places', 'food-dining', 'Food & Dining', null),
  ('food_places', 'food-dining', 'Food & Dining', null),
  ('cafe', 'cafe', 'Cafe', 'food-dining'),
  ('coffee', 'cafe', 'Cafe', 'food-dining'),
  ('bakery', 'bakery', 'Bakery', 'food-dining'),
  ('bar', 'bar', 'Bar', 'food-dining'),
  ('attraction', 'attractions', 'Attractions', null),
  ('attractions', 'attractions', 'Attractions', null),
  ('outdoor', 'outdoor', 'Outdoor', null),
  ('nightlife', 'nightlife', 'Nightlife', null),
  ('shopping', 'shopping', 'Shopping', null),
  ('sports', 'sports', 'Sports', null),
  ('hotel', 'lodging', 'Lodging', null),
  ('lodging', 'lodging', 'Lodging', null),
  ('experience', 'experiences', 'Experiences', null),
  ('tour', 'experiences', 'Experiences', null)
on conflict (legacy_key) do update set
  category_id = excluded.category_id,
  canonical_name = excluded.canonical_name,
  parent_category_id = excluded.parent_category_id,
  updated_at = now();

insert into public.dim_categories(category_id, name, parent_category_id) values
  ('food-dining', 'Food & Dining', null),
  ('attractions', 'Attractions', null),
  ('outdoor', 'Outdoor', null),
  ('nightlife', 'Nightlife', null),
  ('shopping', 'Shopping', null),
  ('sports', 'Sports', null),
  ('lodging', 'Lodging', null),
  ('experiences', 'Experiences', null),
  ('uncategorized', 'Uncategorized', null)
on conflict (category_id) do update set name = excluded.name;

insert into public.dim_categories(category_id, name, parent_category_id)
select distinct category_id, canonical_name, parent_category_id
from public.business_category_mappings
where parent_category_id is not null
on conflict (category_id) do update set
  name = excluded.name,
  parent_category_id = excluded.parent_category_id;

create table if not exists public.business_backfill_runs (
  id uuid primary key default gen_random_uuid(),
  from_day date not null,
  to_day date not null,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  current_day date,
  dates_processed integer not null default 0,
  events_processed bigint not null default 0,
  valid_events bigint not null default 0,
  rejected_events bigint not null default 0,
  places_mapped bigint not null default 0,
  routes_mapped bigint not null default 0,
  geo_entities_mapped bigint not null default 0,
  facts_generated bigint not null default 0,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  check (to_day >= from_day)
);

create index if not exists business_backfill_runs_started_idx
  on public.business_backfill_runs(started_at desc);

create or replace function public.business_canonical_label(input text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(trim(coalesce(input, ''))), '[^[:alnum:]]+', ' ', 'g'), '');
$$;

create or replace function public.business_json_text(payload jsonb, candidate_keys text[])
returns text
language plpgsql
immutable
as $$
declare
  candidate text;
  result text;
begin
  if payload is null then return null; end if;
  foreach candidate in array candidate_keys loop
    result := nullif(trim(payload ->> candidate), '');
    if result is not null then return result; end if;
  end loop;
  return null;
end;
$$;

create or replace function public.business_try_numeric(input text)
returns numeric
language plpgsql
immutable
as $$
begin
  return input::numeric;
exception when others then
  return null;
end;
$$;

create or replace function public.business_country_code(input text)
returns text
language sql
immutable
as $$
  select case public.business_canonical_label(input)
    when 'dominican republic' then 'DO'
    when 'republica dominicana' then 'DO'
    when 'dr' then 'DO'
    when 'do' then 'DO'
    when 'united states' then 'US'
    when 'united states of america' then 'US'
    when 'usa' then 'US'
    when 'us' then 'US'
    when 'spain' then 'ES'
    when 'espana' then 'ES'
    when 'es' then 'ES'
    when 'canada' then 'CA'
    when 'ca' then 'CA'
    when 'italy' then 'IT'
    when 'italia' then 'IT'
    when 'it' then 'IT'
    when 'united kingdom' then 'GB'
    when 'uk' then 'GB'
    when 'gb' then 'GB'
    else case when input ~* '^[a-z]{2}$' then upper(input) else 'ZZ' end
  end;
$$;

create or replace function public.business_country_name(input text, code text)
returns text
language sql
immutable
as $$
  select case code
    when 'DO' then 'Dominican Republic'
    when 'US' then 'United States'
    when 'ES' then 'Spain'
    when 'CA' then 'Canada'
    when 'IT' then 'Italy'
    when 'GB' then 'United Kingdom'
    else coalesce(nullif(trim(input), ''), 'Unknown')
  end;
$$;

create or replace function public.resolve_business_event_geo_id(
  direct_geo_id uuid,
  event_entity_type text,
  event_entity_id text,
  event_country text,
  event_region text,
  event_city text,
  event_properties jsonb
)
returns uuid
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  result_id uuid;
  code text := public.business_country_code(event_country);
  area_name text := public.business_json_text(event_properties, array['neighborhood', 'area', 'district', 'barrio']);
begin
  if direct_geo_id is not null then return direct_geo_id; end if;

  if event_entity_type = 'place' and event_entity_id is not null then
    select geo_id into result_id from public.dim_places where place_id = event_entity_id and is_analytics_eligible;
  elsif event_entity_type = 'route' and event_entity_id is not null then
    select geo_id into result_id from public.dim_routes where route_id = event_entity_id and is_analytics_eligible;
  end if;
  if result_id is not null then return result_id; end if;

  if area_name is not null then
    select area.id into result_id
    from public.geo_entities area
    left join public.geo_entities city on city.id = area.parent_geo_id
    where area.country_code = code
      and area.type in ('area', 'neighborhood')
      and area.canonical_name = public.business_canonical_label(area_name)
      and (event_city is null or city.canonical_name = public.business_canonical_label(event_city))
    limit 1;
  end if;
  if result_id is not null then return result_id; end if;

  if event_city is not null then
    select city.id into result_id
    from public.geo_entities city
    left join public.geo_entities region on region.id = city.parent_geo_id
    where city.country_code = code
      and city.type in ('city', 'municipality')
      and city.canonical_name = public.business_canonical_label(event_city)
      and (event_region is null or region.canonical_name = public.business_canonical_label(event_region))
    limit 1;
  end if;
  if result_id is not null then return result_id; end if;

  if event_region is not null then
    select id into result_id
    from public.geo_entities
    where country_code = code
      and type in ('admin_level_1', 'admin_level_2')
      and canonical_name = public.business_canonical_label(event_region)
    order by case when type = 'admin_level_2' then 0 else 1 end
    limit 1;
  end if;
  if result_id is not null then return result_id; end if;

  select id into result_id
  from public.geo_entities
  where country_code = code and type = 'country'
  limit 1;
  return result_id;
end;
$$;

create or replace function public.ensure_business_geo_entity(
  entity_name text,
  entity_type text,
  entity_country_code text,
  entity_parent_id uuid default null,
  entity_timezone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized_name text := public.business_canonical_label(entity_name);
  result_id uuid;
begin
  if normalized_name is null or entity_type is null then return null; end if;

  select id into result_id
  from public.geo_entities
  where country_code = entity_country_code
    and type = entity_type
    and canonical_name = normalized_name
    and parent_geo_id is not distinct from entity_parent_id
  limit 1;

  if result_id is not null then
    update public.geo_entities
    set name = coalesce(nullif(trim(entity_name), ''), name),
        timezone = coalesce(nullif(entity_timezone, ''), timezone),
        updated_at = now()
    where id = result_id;
    return result_id;
  end if;

  insert into public.geo_entities(name, canonical_name, type, country_code, parent_geo_id, timezone)
  values (trim(entity_name), normalized_name, entity_type, entity_country_code, entity_parent_id, nullif(entity_timezone, ''))
  returning id into result_id;
  return result_id;
exception when unique_violation then
  select id into result_id
  from public.geo_entities
  where country_code = entity_country_code
    and type = entity_type
    and canonical_name = normalized_name
    and parent_geo_id is not distinct from entity_parent_id
  limit 1;
  return result_id;
end;
$$;

create or replace function public.backfill_business_dimensions()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  source_row record;
  payload jsonb;
  source_id text;
  display_name text;
  canonical_name text;
  raw_category text;
  category_key text;
  resolved_category_id text;
  resolved_category_name text;
  raw_country text;
  country_code text;
  raw_region text;
  raw_city text;
  raw_area text;
  timezone_name text;
  country_id uuid;
  region_id uuid;
  city_id uuid;
  area_id uuid;
  resolved_geo_id uuid;
  eligible boolean;
  places_count bigint := 0;
  routes_count bigint := 0;
  geo_count bigint := 0;
begin
  if to_regclass('public.places') is not null then
    for source_row in execute 'select to_jsonb(p) as payload from public.places p' loop
      payload := source_row.payload;
      source_id := public.business_json_text(payload, array['id', 'place_id']);
      display_name := public.business_json_text(payload, array['place_name', 'name', 'title']);
      if source_id is null then continue; end if;

      canonical_name := public.business_canonical_label(display_name);
      raw_country := public.business_json_text(payload, array['country', 'country_code']);
      country_code := public.business_country_code(raw_country);
      raw_region := public.business_json_text(payload, array['region', 'state', 'province', 'department', 'departamento']);
      raw_city := public.business_json_text(payload, array['city', 'locality', 'municipality']);
      raw_area := public.business_json_text(payload, array['neighborhood', 'neighbourhood', 'area', 'district', 'barrio']);
      timezone_name := public.business_json_text(payload, array['timezone', 'time_zone']);

      country_id := case when raw_country is null then null else public.ensure_business_geo_entity(
        public.business_country_name(raw_country, country_code), 'country', country_code, null, timezone_name
      ) end;
      region_id := case when raw_region is null then null else public.ensure_business_geo_entity(
        raw_region, 'admin_level_1', country_code, country_id, timezone_name
      ) end;
      city_id := case when raw_city is null then null else public.ensure_business_geo_entity(
        raw_city, 'city', country_code, coalesce(region_id, country_id), timezone_name
      ) end;
      area_id := case when raw_area is null then null else public.ensure_business_geo_entity(
        raw_area, 'area', country_code, coalesce(city_id, region_id, country_id), timezone_name
      ) end;
      resolved_geo_id := coalesce(area_id, city_id, region_id, country_id);

      raw_category := public.business_json_text(payload, array['category', 'category_name', 'type']);
      category_key := public.business_canonical_label(raw_category);
      select mapping.category_id, mapping.canonical_name
      into resolved_category_id, resolved_category_name
      from public.business_category_mappings mapping
      where mapping.legacy_key = category_key;
      if resolved_category_id is null then
        resolved_category_id := 'uncategorized';
        resolved_category_name := 'Uncategorized';
      end if;

      eligible := display_name is not null and canonical_name is not null
        and canonical_name !~ '(^| )(test|qa|deleted|invalid)( |$)'
        and display_name !~* '^[0-9a-f]{8}-[0-9a-f-]{27,}$'
        and lower(coalesce(public.business_json_text(payload, array['status']), 'active')) not in ('deleted', 'test', 'qa', 'invalid');

      insert into public.dim_places(
        place_id, place_name, canonical_name, category_id, geo_id,
        is_analytics_eligible, latitude, longitude, metadata, valid_to, updated_at
      ) values (
        source_id, coalesce(display_name, 'Unknown place'), canonical_name, resolved_category_id, resolved_geo_id,
        eligible,
        public.business_try_numeric(public.business_json_text(payload, array['latitude', 'lat', 'geo_lat'])),
        public.business_try_numeric(public.business_json_text(payload, array['longitude', 'lng', 'lon', 'geo_lng'])),
        jsonb_build_object(
          'raw_category', raw_category,
          'raw_country', raw_country,
          'raw_region', raw_region,
          'raw_city', raw_city,
          'raw_area', raw_area,
          'google_place_id', public.business_json_text(payload, array['google_place_id', 'google_id']),
          'external_provider_id', public.business_json_text(payload, array['external_provider_id', 'provider_id']),
          'address', public.business_json_text(payload, array['address', 'formatted_address'])
        ),
        null,
        now()
      )
      on conflict (place_id) do update set
        place_name = excluded.place_name,
        canonical_name = excluded.canonical_name,
        category_id = excluded.category_id,
        geo_id = excluded.geo_id,
        is_analytics_eligible = excluded.is_analytics_eligible,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        metadata = excluded.metadata,
        valid_to = null,
        updated_at = now();
      places_count := places_count + 1;
    end loop;
  end if;

  if to_regclass('public.routes') is not null then
    for source_row in execute 'select to_jsonb(r) as payload from public.routes r' loop
      payload := source_row.payload;
      source_id := public.business_json_text(payload, array['id', 'route_id']);
      display_name := public.business_json_text(payload, array['route_name', 'name', 'title']);
      if source_id is null then continue; end if;

      canonical_name := public.business_canonical_label(display_name);
      raw_country := public.business_json_text(payload, array['country', 'country_code']);
      country_code := public.business_country_code(raw_country);
      raw_region := public.business_json_text(payload, array['region', 'state', 'province']);
      raw_city := public.business_json_text(payload, array['city', 'locality', 'municipality']);
      timezone_name := public.business_json_text(payload, array['timezone', 'time_zone']);
      country_id := case when raw_country is null then null else public.ensure_business_geo_entity(
        public.business_country_name(raw_country, country_code), 'country', country_code, null, timezone_name
      ) end;
      region_id := case when raw_region is null then null else public.ensure_business_geo_entity(
        raw_region, 'admin_level_1', country_code, country_id, timezone_name
      ) end;
      city_id := case when raw_city is null then null else public.ensure_business_geo_entity(
        raw_city, 'city', country_code, coalesce(region_id, country_id), timezone_name
      ) end;
      resolved_geo_id := coalesce(city_id, region_id, country_id);

      raw_category := public.business_json_text(payload, array['category', 'category_name', 'type']);
      category_key := public.business_canonical_label(raw_category);
      select mapping.category_id, mapping.canonical_name
      into resolved_category_id, resolved_category_name
      from public.business_category_mappings mapping
      where mapping.legacy_key = category_key;
      if resolved_category_id is null then resolved_category_id := 'uncategorized'; end if;

      eligible := display_name is not null and canonical_name is not null
        and canonical_name !~ '(^| )(test|qa|deleted|invalid)( |$)'
        and display_name !~* '^[0-9a-f]{8}-[0-9a-f-]{27,}$'
        and lower(coalesce(public.business_json_text(payload, array['status']), 'active')) not in ('deleted', 'test', 'qa', 'invalid');

      insert into public.dim_routes(
        route_id, route_name, canonical_name, category_id, geo_id, creator_id,
        stop_count, status, is_analytics_eligible, metadata, valid_to, updated_at
      ) values (
        source_id, coalesce(display_name, 'Unknown route'), canonical_name, resolved_category_id, resolved_geo_id,
        public.business_json_text(payload, array['creator_id', 'user_id', 'owner_id']),
        coalesce(
          public.business_try_numeric(public.business_json_text(payload, array['stop_count', 'stops_count', 'places_count']))::integer,
          case when jsonb_typeof(payload -> 'stops') = 'array' then jsonb_array_length(payload -> 'stops') else null end,
          case when jsonb_typeof(payload -> 'place_ids') = 'array' then jsonb_array_length(payload -> 'place_ids') else null end
        ),
        coalesce(public.business_json_text(payload, array['status']), 'active'),
        eligible,
        jsonb_build_object('raw_category', raw_category, 'raw_country', raw_country, 'raw_region', raw_region, 'raw_city', raw_city),
        null,
        now()
      )
      on conflict (route_id) do update set
        route_name = excluded.route_name,
        canonical_name = excluded.canonical_name,
        category_id = excluded.category_id,
        geo_id = excluded.geo_id,
        creator_id = excluded.creator_id,
        stop_count = excluded.stop_count,
        status = excluded.status,
        is_analytics_eligible = excluded.is_analytics_eligible,
        metadata = excluded.metadata,
        valid_to = null,
        updated_at = now();
      routes_count := routes_count + 1;
    end loop;
  end if;

  insert into public.dim_geo(geo_id, name, canonical_name, type, country_code, parent_geo_id, timezone, valid_to)
  select id, name, canonical_name, type, country_code, parent_geo_id, timezone, null
  from public.geo_entities
  on conflict (geo_id) do update set
    name = excluded.name,
    canonical_name = excluded.canonical_name,
    type = excluded.type,
    country_code = excluded.country_code,
    parent_geo_id = excluded.parent_geo_id,
    timezone = excluded.timezone,
    valid_to = null;

  select count(*) into geo_count from public.geo_entities;
  return jsonb_build_object('places_mapped', places_count, 'routes_mapped', routes_count, 'geo_entities_mapped', geo_count);
end;
$$;

-- Recreate the normalized layer after dimension helpers exist so historical
-- events can resolve geography without mutating analytics_events.
create or replace view public.analytics_normalized_events
with (security_invoker = true)
as
select
  e.event_id,
  coalesce(m.canonical_event_name, e.event_name) as event_name,
  e.event_name as original_event_name,
  coalesce(m.canonical_version, e.event_version, 1) as event_version,
  e.entity_type,
  e.entity_id,
  e.user_id,
  e.anonymous_id,
  e.session_id,
  e.source,
  e.platform,
  e.locale,
  e.timezone,
  e.country,
  e.region,
  e.city,
  e.received_at,
  e.occurred_at,
  e.properties,
  e.context,
  e.source_type,
  e.source_id,
  public.resolve_business_event_geo_id(
    e.geo_id, e.entity_type, e.entity_id, e.country, e.region, e.city, e.properties
  ) as geo_id
from public.analytics_valid_events e
left join public.analytics_event_name_mappings m
  on m.original_event_name = e.event_name and m.status = 'active';

create or replace view public.analytics_rejected_events
with (security_invoker = true)
as
select
  e.event_id,
  e.received_at,
  case upper(coalesce(e.analytics_exclusion_reason, ''))
    when 'BOT_TRAFFIC' then 'BOT_TRAFFIC'
    when 'TEST_TRAFFIC' then 'TEST_TRAFFIC'
    when 'IMPOSSIBLE_BATCH_FREQUENCY' then 'DUPLICATE_EVENT'
    else upper(coalesce(nullif(e.analytics_exclusion_reason, ''), 'INVALID_EVENT'))
  end as reason,
  'analytics_events'::text as source
from public.analytics_events e
where e.analytics_eligible = false
union all
select
  e.event_id,
  e.received_at,
  case
    when coalesce(e.source, '') = 'admin' then 'TEST_TRAFFIC'
    when coalesce(e.properties ->> 'is_test', 'false') = 'true'
      or coalesce(e.context ->> 'is_test', 'false') = 'true'
      or coalesce(e.context ->> 'qa_session', 'false') = 'true'
      or lower(coalesce(e.context ->> 'environment', 'production')) in ('test', 'testing', 'qa', 'development')
      then 'TEST_TRAFFIC'
    else 'BOT_TRAFFIC'
  end as reason,
  'validity_filter'::text as source
from public.analytics_events e
where e.analytics_eligible = true
  and (
    coalesce(e.source, '') = 'admin'
    or coalesce(e.properties ->> 'is_test', 'false') = 'true'
    or coalesce(e.context ->> 'is_test', 'false') = 'true'
    or coalesce(e.context ->> 'qa_session', 'false') = 'true'
    or lower(coalesce(e.context ->> 'environment', 'production')) in ('test', 'testing', 'qa', 'development')
    or lower(coalesce(e.context ->> 'traffic_type', 'human')) in ('bot', 'crawler', 'automated')
    or coalesce(e.context ->> 'user_agent', '') ~* '(bot|crawler|spider|headless|lighthouse)'
  )
union all
select
  d.event_id,
  d.received_at,
  upper(coalesce(nullif(d.reason, ''), 'INVALID_EVENT')) as reason,
  'dead_letter'::text as source
from public.analytics_event_dead_letters d;

create or replace view public.business_duplicate_place_candidates
with (security_invoker = true)
as
select
  a.place_id as place_id,
  b.place_id as candidate_place_id,
  a.place_name,
  b.place_name as candidate_place_name,
  case
    when nullif(a.metadata ->> 'google_place_id', '') is not null
      and a.metadata ->> 'google_place_id' = b.metadata ->> 'google_place_id' then 'high'
    when a.canonical_name = b.canonical_name
      and a.latitude is not null and b.latitude is not null
      and abs(a.latitude - b.latitude) <= 0.001
      and abs(a.longitude - b.longitude) <= 0.001 then 'medium'
    else 'low'
  end as confidence,
  jsonb_build_object(
    'same_normalized_name', a.canonical_name = b.canonical_name,
    'same_google_place_id', nullif(a.metadata ->> 'google_place_id', '') is not null
      and a.metadata ->> 'google_place_id' = b.metadata ->> 'google_place_id',
    'nearby_coordinates', a.latitude is not null and b.latitude is not null
      and abs(a.latitude - b.latitude) <= 0.001 and abs(a.longitude - b.longitude) <= 0.001
  ) as evidence
from public.dim_places a
join public.dim_places b on a.place_id < b.place_id
where (
  a.canonical_name is not null and a.canonical_name = b.canonical_name
) or (
  nullif(a.metadata ->> 'google_place_id', '') is not null
  and a.metadata ->> 'google_place_id' = b.metadata ->> 'google_place_id'
);

create or replace view public.business_alerts
with (security_invoker = true)
as select * from public.business_intelligence_signals;

create or replace function public.business_intelligence_quality_report()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'places_total', (select count(*) from public.dim_places),
    'places_with_country_pct', (select case when count(*) = 0 then 100 else round(100.0 * count(*) filter (where nullif(metadata ->> 'raw_country', '') is not null) / count(*), 1) end from public.dim_places),
    'places_with_region_pct', (select case when count(*) = 0 then 100 else round(100.0 * count(*) filter (where nullif(metadata ->> 'raw_region', '') is not null) / count(*), 1) end from public.dim_places),
    'places_with_city_pct', (select case when count(*) = 0 then 100 else round(100.0 * count(*) filter (where nullif(metadata ->> 'raw_city', '') is not null) / count(*), 1) end from public.dim_places),
    'place_resolution_pct', (select case when count(*) = 0 then 100 else round(100.0 * count(*) filter (where is_analytics_eligible and place_name <> 'Unknown place') / count(*), 1) end from public.dim_places),
    'route_resolution_pct', (select case when count(*) = 0 then 100 else round(100.0 * count(*) filter (where is_analytics_eligible and route_name <> 'Unknown route') / count(*), 1) end from public.dim_routes),
    'events_total', (select count(*) from public.analytics_events),
    'valid_events', (select count(*) from public.analytics_normalized_events),
    'rejected_events', (select count(*) from public.analytics_rejected_events),
    'events_with_geo_pct', (select case when count(*) = 0 then 100 else round(100.0 * count(*) filter (where geo_id is not null) / count(*), 1) end from public.analytics_normalized_events),
    'unknown_geo', (select count(*) from public.analytics_normalized_events where geo_id is null),
    'invalid_hierarchy', (select count(*) from public.geo_entities child left join public.geo_entities parent on parent.id = child.parent_geo_id where child.parent_geo_id is not null and (parent.id is null or parent.country_code <> child.country_code)),
    'duplicate_geo_entities', (select count(*) from (select country_code, type, canonical_name, parent_geo_id from public.geo_entities group by 1,2,3,4 having count(*) > 1) duplicate_groups),
    'possible_duplicate_places', (select count(*) from public.business_duplicate_place_candidates),
    'last_aggregation', (select job_finished_at from public.business_aggregation_runs where status = 'succeeded' order by job_finished_at desc nulls last limit 1),
    'aggregation_failures', (select count(*) from public.business_aggregation_runs where status = 'failed' and job_started_at >= now() - interval '7 days')
  );
$$;

create or replace function public.run_business_intelligence_aggregation(
  target_day date,
  run_trigger text default 'cron',
  run_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  run_id uuid;
  event_count bigint := 0;
  fact_count bigint := 0;
  failure_message text;
  failure_state text;
begin
  if target_day is null then raise exception 'target_day must not be null'; end if;
  if run_trigger not in ('cron', 'admin', 'backfill', 'recompute') then
    raise exception 'invalid aggregation trigger';
  end if;

  insert into public.business_aggregation_runs(period_start, period_end, trigger, status, request_id)
  values (target_day, target_day, run_trigger, 'running', run_request_id)
  returning id into run_id;

  begin
    select count(*) into event_count
    from public.analytics_normalized_events
    where (occurred_at at time zone coalesce(nullif(timezone, ''), 'UTC'))::date = target_day;

    perform public.aggregate_business_intelligence_for_day(target_day);

    select
      (select count(*) from public.fact_place_daily where day = target_day) +
      (select count(*) from public.fact_route_daily where day = target_day) +
      (select count(*) from public.fact_market_daily where day = target_day) +
      (select count(*) from public.fact_search_daily where day = target_day) +
      (select count(*) from public.fact_content_attribution where day = target_day) +
      (select count(*) from public.fact_business_daily where day = target_day)
    into fact_count;

    update public.business_aggregation_runs
    set status = 'succeeded',
        job_finished_at = now(),
        events_processed = event_count,
        records_generated = fact_count
    where id = run_id;

    return jsonb_build_object(
      'ok', true,
      'run_id', run_id,
      'day', target_day,
      'events_processed', event_count,
      'records_generated', fact_count
    );
  exception when others then
    get stacked diagnostics failure_message = message_text, failure_state = returned_sqlstate;
    update public.business_aggregation_runs
    set status = 'failed',
        job_finished_at = now(),
        error_code = failure_state,
        error_message = left(failure_message, 500)
    where id = run_id;
    return jsonb_build_object('ok', false, 'run_id', run_id, 'day', target_day, 'code', failure_state);
  end;
end;
$$;

create or replace function public.business_geo_descendant_ids(root_geo_id uuid)
returns table(geo_id uuid)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with recursive descendants as (
    select id from public.geo_entities where id = root_geo_id and is_analytics_eligible
    union all
    select child.id
    from public.geo_entities child
    join descendants parent on child.parent_geo_id = parent.id
    where child.is_analytics_eligible
  )
  select id from descendants;
$$;

create or replace function public.verify_business_intelligence_schema()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  with expected_relations(name) as (values
    ('business_accounts'), ('business_members'), ('business_locations'), ('business_claims'),
    ('business_entitlements'), ('business_market_access'), ('business_saved_views'), ('business_alerts'),
    ('geo_entities'), ('analytics_events'), ('analytics_raw_events'), ('analytics_valid_events'),
    ('analytics_normalized_events'), ('analytics_rejected_events'), ('dim_geo'), ('dim_places'),
    ('dim_routes'), ('dim_categories'), ('fact_market_daily'), ('fact_place_daily'),
    ('fact_route_daily'), ('fact_business_daily'), ('fact_search_daily'), ('business_aggregation_runs'),
    ('business_backfill_runs')
  ),
  relation_status as (
    select name, to_regclass('public.' || name) is not null as present from expected_relations
  ),
  expected_functions(name) as (values
    ('aggregate_business_intelligence_for_day'), ('backfill_business_dimensions'),
    ('run_business_intelligence_aggregation'), ('business_intelligence_quality_report'),
    ('business_geo_descendant_ids'), ('verify_business_intelligence_schema')
  ),
  function_status as (
    select expected.name, exists(select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = expected.name) as present
    from expected_functions expected
  ),
  required_indexes(name) as (values
    ('geo_entities_canonical_hierarchy_uidx'), ('analytics_events_geo_received_idx'),
    ('analytics_events_entity_received_eligible_idx'), ('fact_market_daily_geo_day_idx'),
    ('fact_place_daily_place_day_idx'), ('fact_route_daily_route_day_idx'),
    ('fact_business_daily_business_day_idx'), ('business_aggregation_runs_started_idx')
  ),
  index_status as (
    select required.name, to_regclass('public.' || required.name) is not null as present from required_indexes required
  ),
  rls_status as (
    select relname as name, relrowsecurity as enabled
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relname in ('business_accounts', 'business_members', 'business_locations', 'business_entitlements',
        'fact_market_daily', 'fact_place_daily', 'fact_route_daily', 'fact_business_daily', 'fact_search_daily')
  )
  select jsonb_build_object(
    'ok', not exists(select 1 from relation_status where not present)
      and not exists(select 1 from function_status where not present)
      and not exists(select 1 from index_status where not present)
      and not exists(select 1 from rls_status where not enabled),
    'relations', (select jsonb_object_agg(name, present) from relation_status),
    'functions', (select jsonb_object_agg(name, present) from function_status),
    'indexes', (select jsonb_object_agg(name, present) from index_status),
    'rls', (select jsonb_object_agg(name, enabled) from rls_status),
    'missing', (
      select coalesce(jsonb_agg(item), '[]'::jsonb) from (
        select 'relation:' || name as item from relation_status where not present
        union all select 'function:' || name from function_status where not present
        union all select 'index:' || name from index_status where not present
        union all select 'rls:' || name from rls_status where not enabled
      ) missing_items
    )
  );
$$;

insert into public.business_accounts(id, name, type, industry, status, plan, bi_v2_enabled)
values ('00000000-0000-4000-8000-00000000b102', 'Explore Internal Business', 'internal', 'technology', 'active', 'enterprise', true)
on conflict (id) do update set
  name = excluded.name,
  status = excluded.status,
  plan = excluded.plan,
  bi_v2_enabled = true,
  updated_at = now();

alter table public.business_category_mappings enable row level security;
alter table public.business_backfill_runs enable row level security;

grant execute on function public.backfill_business_dimensions() to service_role;
grant execute on function public.resolve_business_event_geo_id(uuid, text, text, text, text, text, jsonb) to authenticated, service_role;
grant execute on function public.run_business_intelligence_aggregation(date, text, text) to service_role;
grant execute on function public.business_geo_descendant_ids(uuid) to service_role;
grant execute on function public.business_intelligence_quality_report() to service_role;
grant execute on function public.verify_business_intelligence_schema() to service_role;
grant select on public.analytics_rejected_events, public.business_duplicate_place_candidates, public.business_alerts to service_role;

revoke all on function public.ensure_business_geo_entity(text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.backfill_business_dimensions() from public, anon, authenticated;
revoke all on function public.run_business_intelligence_aggregation(date, text, text) from public, anon, authenticated;
revoke all on function public.business_geo_descendant_ids(uuid) from public, anon, authenticated;
revoke all on function public.business_intelligence_quality_report() from public, anon, authenticated;
revoke all on function public.verify_business_intelligence_schema() from public, anon, authenticated;
