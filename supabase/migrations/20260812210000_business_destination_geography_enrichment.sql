-- Business Intelligence v2 final closure: destination geography enrichment.
--
-- Place coordinates describe destinations, never traveler origin. Raw events
-- remain immutable. This migration adds a restartable enrichment audit, safe
-- service-role RPCs, canonical hierarchy projections, and explicit origin vs
-- destination semantics for normalized analytics.

create table if not exists public.business_place_geo_enrichment (
  place_id uuid primary key references public.places(id) on delete cascade,
  coordinate_hash text not null,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  status text not null check (status in ('applied', 'unknown', 'review_required')),
  source text not null check (source in ('catalog', 'provider', 'manual')),
  provider text,
  provider_ref text,
  country_code text check (country_code is null or char_length(country_code) = 2),
  country_name text,
  admin_level_1 text,
  admin_level_1_code text,
  admin_level_2 text,
  admin_level_2_code text,
  locality text,
  locality_type text check (locality_type is null or locality_type in ('city', 'municipality')),
  sub_locality text,
  resolved_geo_id uuid references public.geo_entities(id) on delete set null,
  confidence numeric(4, 3) not null default 0 check (confidence between 0 and 1),
  evidence jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_place_geo_enrichment_status_idx
  on public.business_place_geo_enrichment(status, updated_at desc);
create index if not exists business_place_geo_enrichment_geo_idx
  on public.business_place_geo_enrichment(resolved_geo_id)
  where resolved_geo_id is not null;

alter table public.business_place_geo_enrichment enable row level security;
revoke all on table public.business_place_geo_enrichment from public, anon, authenticated;
grant select, insert, update, delete on table public.business_place_geo_enrichment to service_role;

create or replace view public.business_destination_geo_hierarchy
with (security_invoker = true)
as
with recursive ancestry as (
  select
    geo.id as leaf_geo_id,
    geo.id,
    geo.name,
    geo.type,
    geo.country_code,
    geo.parent_geo_id,
    geo.metadata,
    0 as depth
  from public.geo_entities geo
  where geo.is_analytics_eligible
  union all
  select
    child.leaf_geo_id,
    parent.id,
    parent.name,
    parent.type,
    parent.country_code,
    parent.parent_geo_id,
    parent.metadata,
    child.depth + 1
  from ancestry child
  join public.geo_entities parent on parent.id = child.parent_geo_id
  where child.depth < 8 and parent.is_analytics_eligible
)
select
  leaf_geo_id,
  max(country_code) as country_code,
  (max(id::text) filter (where type = 'country'))::uuid as country_geo_id,
  max(name) filter (where type = 'country') as country_name,
  (max(id::text) filter (where type = 'admin_level_1'))::uuid as admin_level_1_geo_id,
  max(name) filter (where type = 'admin_level_1') as admin_level_1,
  max(metadata ->> 'iso_code') filter (where type = 'admin_level_1') as admin_level_1_code,
  (max(id::text) filter (where type = 'admin_level_2'))::uuid as admin_level_2_geo_id,
  max(name) filter (where type = 'admin_level_2') as admin_level_2,
  max(metadata ->> 'iso_code') filter (where type = 'admin_level_2') as admin_level_2_code,
  (max(id::text) filter (where type in ('city', 'municipality')))::uuid as locality_geo_id,
  max(name) filter (where type in ('city', 'municipality')) as locality,
  max(type) filter (where type in ('city', 'municipality')) as locality_type,
  (max(id::text) filter (where type in ('neighborhood', 'area')))::uuid as sub_locality_geo_id,
  max(name) filter (where type in ('neighborhood', 'area')) as sub_locality
from ancestry
group by leaf_geo_id;

create or replace view public.business_place_destination_geography
with (security_invoker = true)
as
select
  place.place_id,
  place.geo_id,
  hierarchy.country_code,
  hierarchy.country_name,
  hierarchy.admin_level_1,
  hierarchy.admin_level_1_code,
  hierarchy.admin_level_2,
  hierarchy.admin_level_2_code,
  hierarchy.locality,
  hierarchy.locality_type,
  hierarchy.sub_locality,
  enrichment.source as resolution_source,
  enrichment.provider,
  enrichment.confidence,
  place.latitude,
  place.longitude
from public.dim_places place
left join public.business_destination_geo_hierarchy hierarchy on hierarchy.leaf_geo_id = place.geo_id
left join public.business_place_geo_enrichment enrichment on enrichment.place_id::text = place.place_id;

create or replace view public.business_route_destination_geography
with (security_invoker = true)
as
select
  route.route_id,
  route.geo_id,
  hierarchy.country_code,
  hierarchy.country_name,
  hierarchy.admin_level_1,
  hierarchy.admin_level_1_code,
  hierarchy.admin_level_2,
  hierarchy.admin_level_2_code,
  hierarchy.locality,
  hierarchy.locality_type,
  hierarchy.sub_locality,
  route.metadata ->> 'geo_scope' as geo_scope,
  route.metadata ->> 'geo_source' as resolution_source
from public.dim_routes route
left join public.business_destination_geo_hierarchy hierarchy on hierarchy.leaf_geo_id = route.geo_id;

revoke all on table public.business_destination_geo_hierarchy from public, anon, authenticated;
revoke all on table public.business_place_destination_geography from public, anon, authenticated;
revoke all on table public.business_route_destination_geography from public, anon, authenticated;
grant select on table public.business_destination_geo_hierarchy to service_role;
grant select on table public.business_place_destination_geography to service_role;
grant select on table public.business_route_destination_geography to service_role;

create or replace function public.apply_business_place_geo_enrichment(
  target_place_id uuid,
  target_latitude numeric,
  target_longitude numeric,
  target_source text,
  target_provider text default null,
  target_provider_ref text default null,
  target_country_code text default null,
  target_country_name text default null,
  target_admin_level_1 text default null,
  target_admin_level_1_code text default null,
  target_admin_level_2 text default null,
  target_admin_level_2_code text default null,
  target_locality text default null,
  target_locality_type text default 'city',
  target_sub_locality text default null,
  target_confidence numeric default 0,
  target_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actual_latitude numeric;
  actual_longitude numeric;
  normalized_country_code text := upper(nullif(trim(target_country_code), ''));
  coordinate_fingerprint text;
  existing_record public.business_place_geo_enrichment%rowtype;
  country_id uuid;
  admin_level_1_id uuid;
  admin_level_2_id uuid;
  locality_id uuid;
  sub_locality_id uuid;
  result_geo_id uuid;
  result_status text;
begin
  if target_place_id is null or target_latitude is null or target_longitude is null then
    raise exception 'place_id and coordinates are required';
  end if;
  if target_source not in ('catalog', 'provider', 'manual') then
    raise exception 'invalid geography source';
  end if;
  if target_locality_type is not null and target_locality_type not in ('city', 'municipality') then
    raise exception 'invalid locality type';
  end if;
  if normalized_country_code is not null and char_length(normalized_country_code) <> 2 then
    raise exception 'country code must contain two letters';
  end if;
  if target_confidence < 0 or target_confidence > 1 then
    raise exception 'confidence must be between zero and one';
  end if;

  select st_y(place.location::geometry), st_x(place.location::geometry)
  into actual_latitude, actual_longitude
  from public.places place
  where place.id = target_place_id;

  if actual_latitude is null or actual_longitude is null then
    raise exception 'place or place coordinates not found';
  end if;
  if abs(actual_latitude - target_latitude) > 0.000010
    or abs(actual_longitude - target_longitude) > 0.000010 then
    raise exception 'place coordinates changed; refusing stale geography';
  end if;

  coordinate_fingerprint := encode(
    digest(round(target_latitude, 6)::text || ',' || round(target_longitude, 6)::text, 'sha256'),
    'hex'
  );

  select * into existing_record
  from public.business_place_geo_enrichment
  where place_id = target_place_id;

  if existing_record.place_id is not null
    and existing_record.coordinate_hash = coordinate_fingerprint
    and existing_record.source = 'manual'
    and target_source <> 'manual' then
    return jsonb_build_object('ok', true, 'status', 'preserved_manual', 'place_id', target_place_id);
  end if;
  if existing_record.place_id is not null
    and existing_record.coordinate_hash = coordinate_fingerprint
    and existing_record.status = 'applied'
    and existing_record.confidence > target_confidence then
    return jsonb_build_object('ok', true, 'status', 'preserved_higher_confidence', 'place_id', target_place_id);
  end if;

  if normalized_country_code is not null and nullif(trim(target_country_name), '') is not null then
    country_id := public.ensure_business_geo_entity(
      trim(target_country_name), 'country', normalized_country_code, null, null
    );
  end if;
  if country_id is not null and nullif(trim(target_admin_level_1), '') is not null then
    admin_level_1_id := public.ensure_business_geo_entity(
      trim(target_admin_level_1), 'admin_level_1', normalized_country_code, country_id, null
    );
    update public.geo_entities
    set metadata = metadata || jsonb_strip_nulls(jsonb_build_object(
      'iso_code', nullif(trim(target_admin_level_1_code), ''),
      'resolution_source', target_source,
      'provider', target_provider
    )), updated_at = now()
    where id = admin_level_1_id;
  end if;
  if coalesce(admin_level_1_id, country_id) is not null
    and nullif(trim(target_admin_level_2), '') is not null then
    admin_level_2_id := public.ensure_business_geo_entity(
      trim(target_admin_level_2), 'admin_level_2', normalized_country_code,
      coalesce(admin_level_1_id, country_id), null
    );
    update public.geo_entities
    set metadata = metadata || jsonb_strip_nulls(jsonb_build_object(
      'iso_code', nullif(trim(target_admin_level_2_code), ''),
      'resolution_source', target_source,
      'provider', target_provider
    )), updated_at = now()
    where id = admin_level_2_id;
  end if;
  if coalesce(admin_level_2_id, admin_level_1_id, country_id) is not null
    and nullif(trim(target_locality), '') is not null then
    locality_id := public.ensure_business_geo_entity(
      trim(target_locality), coalesce(target_locality_type, 'city'), normalized_country_code,
      coalesce(admin_level_2_id, admin_level_1_id, country_id), null
    );
    update public.geo_entities
    set metadata = metadata || jsonb_strip_nulls(jsonb_build_object(
      'resolution_source', target_source,
      'provider', target_provider
    )), updated_at = now()
    where id = locality_id;
  end if;
  if locality_id is not null and nullif(trim(target_sub_locality), '') is not null then
    sub_locality_id := public.ensure_business_geo_entity(
      trim(target_sub_locality), 'area', normalized_country_code, locality_id, null
    );
  end if;

  result_geo_id := coalesce(sub_locality_id, locality_id, admin_level_2_id, admin_level_1_id, country_id);
  result_status := case when result_geo_id is null then 'unknown' else 'applied' end;

  insert into public.business_place_geo_enrichment(
    place_id, coordinate_hash, latitude, longitude, status, source, provider, provider_ref,
    country_code, country_name, admin_level_1, admin_level_1_code,
    admin_level_2, admin_level_2_code, locality, locality_type, sub_locality,
    resolved_geo_id, confidence, evidence, resolved_at, updated_at
  ) values (
    target_place_id, coordinate_fingerprint, target_latitude, target_longitude,
    result_status, target_source, nullif(trim(target_provider), ''), nullif(trim(target_provider_ref), ''),
    normalized_country_code, nullif(trim(target_country_name), ''),
    nullif(trim(target_admin_level_1), ''), nullif(trim(target_admin_level_1_code), ''),
    nullif(trim(target_admin_level_2), ''), nullif(trim(target_admin_level_2_code), ''),
    nullif(trim(target_locality), ''), target_locality_type, nullif(trim(target_sub_locality), ''),
    result_geo_id, target_confidence, coalesce(target_evidence, '{}'::jsonb),
    case when result_geo_id is null then null else now() end, now()
  )
  on conflict (place_id) do update set
    coordinate_hash = excluded.coordinate_hash,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    status = excluded.status,
    source = excluded.source,
    provider = excluded.provider,
    provider_ref = excluded.provider_ref,
    country_code = excluded.country_code,
    country_name = excluded.country_name,
    admin_level_1 = excluded.admin_level_1,
    admin_level_1_code = excluded.admin_level_1_code,
    admin_level_2 = excluded.admin_level_2,
    admin_level_2_code = excluded.admin_level_2_code,
    locality = excluded.locality,
    locality_type = excluded.locality_type,
    sub_locality = excluded.sub_locality,
    resolved_geo_id = excluded.resolved_geo_id,
    confidence = excluded.confidence,
    evidence = excluded.evidence,
    resolved_at = excluded.resolved_at,
    updated_at = now();

  if result_geo_id is not null then
    update public.dim_places
    set geo_id = result_geo_id,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'destination_geo', jsonb_strip_nulls(jsonb_build_object(
            'country_code', normalized_country_code,
            'country', nullif(trim(target_country_name), ''),
            'admin_level_1', nullif(trim(target_admin_level_1), ''),
            'admin_level_1_code', nullif(trim(target_admin_level_1_code), ''),
            'admin_level_2', nullif(trim(target_admin_level_2), ''),
            'admin_level_2_code', nullif(trim(target_admin_level_2_code), ''),
            'locality', nullif(trim(target_locality), ''),
            'locality_type', target_locality_type,
            'sub_locality', nullif(trim(target_sub_locality), ''),
            'source', target_source,
            'provider', nullif(trim(target_provider), ''),
            'confidence', target_confidence
          ))
        ),
        updated_at = now()
    where place_id = target_place_id::text;

    update public.business_locations
    set geo_id = result_geo_id, updated_at = now()
    where place_id = target_place_id::text;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', result_status,
    'place_id', target_place_id,
    'geo_id', result_geo_id,
    'country_code', normalized_country_code,
    'admin_level_1', nullif(trim(target_admin_level_1), ''),
    'locality', nullif(trim(target_locality), '')
  );
end;
$$;

alter function public.apply_business_place_geo_enrichment(
  uuid, numeric, numeric, text, text, text, text, text, text, text,
  text, text, text, text, text, numeric, jsonb
) owner to postgres;
revoke all on function public.apply_business_place_geo_enrichment(
  uuid, numeric, numeric, text, text, text, text, text, text, text,
  text, text, text, text, text, numeric, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_business_place_geo_enrichment(
  uuid, numeric, numeric, text, text, text, text, text, text, text,
  text, text, text, text, text, numeric, jsonb
) to service_role;

create or replace function public.refresh_business_route_geography()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  route_record record;
  selected_geo_id uuid;
  geo_scope text;
  routes_processed bigint := 0;
  single_market_routes bigint := 0;
  multi_market_routes bigint := 0;
  unknown_routes bigint := 0;
begin
  for route_record in
    select
      route.route_id,
      route.geo_id as existing_geo_id,
      count(link.place_id) as stop_count,
      count(place.geo_id) as resolved_stop_count,
      count(hierarchy.locality_geo_id) as locality_stop_count,
      count(distinct hierarchy.locality_geo_id) filter (where hierarchy.locality_geo_id is not null) as locality_count,
      count(distinct hierarchy.admin_level_1_geo_id) filter (where hierarchy.admin_level_1_geo_id is not null) as admin_level_1_count,
      count(distinct hierarchy.country_geo_id) filter (where hierarchy.country_geo_id is not null) as country_count,
      (array_agg(distinct hierarchy.locality_geo_id) filter (where hierarchy.locality_geo_id is not null))[1] as locality_geo_id,
      (array_agg(distinct hierarchy.admin_level_1_geo_id) filter (where hierarchy.admin_level_1_geo_id is not null))[1] as admin_level_1_geo_id,
      (array_agg(distinct hierarchy.country_geo_id) filter (where hierarchy.country_geo_id is not null))[1] as country_geo_id
    from public.dim_routes route
    left join public.route_places link on link.route_id::text = route.route_id
    left join public.dim_places place on place.place_id = link.place_id::text
    left join public.business_destination_geo_hierarchy hierarchy on hierarchy.leaf_geo_id = place.geo_id
    group by route.route_id, route.geo_id
  loop
    selected_geo_id := null;
    if route_record.stop_count = 0 then
      geo_scope := case when route_record.existing_geo_id is null then 'unknown' else 'existing' end;
      selected_geo_id := route_record.existing_geo_id;
    elsif route_record.resolved_stop_count < route_record.stop_count then
      geo_scope := 'partial_unknown';
    elsif route_record.locality_count = 1
      and route_record.locality_stop_count = route_record.stop_count then
      geo_scope := 'single_market';
      selected_geo_id := route_record.locality_geo_id;
    elsif route_record.country_count > 1 then
      geo_scope := 'multi_market';
    elsif route_record.admin_level_1_count = 1 then
      geo_scope := 'multi_market';
      selected_geo_id := route_record.admin_level_1_geo_id;
    elsif route_record.country_count = 1 then
      geo_scope := 'multi_market';
      selected_geo_id := route_record.country_geo_id;
    else
      geo_scope := 'unknown';
    end if;

    update public.dim_routes
    set geo_id = selected_geo_id,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'geo_scope', geo_scope,
          'geo_source', case when route_record.stop_count > 0 then 'route_stops' else 'existing' end,
          'stop_count', route_record.stop_count,
          'resolved_stop_count', route_record.resolved_stop_count
        ),
        updated_at = now()
    where route_id = route_record.route_id;

    routes_processed := routes_processed + 1;
    if geo_scope = 'single_market' then single_market_routes := single_market_routes + 1;
    elsif geo_scope = 'multi_market' then multi_market_routes := multi_market_routes + 1;
    else unknown_routes := unknown_routes + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'routes_processed', routes_processed,
    'single_market', single_market_routes,
    'multi_market', multi_market_routes,
    'unknown_or_partial', unknown_routes
  );
end;
$$;

alter function public.refresh_business_route_geography() owner to postgres;
revoke all on function public.refresh_business_route_geography() from public, anon, authenticated;
grant execute on function public.refresh_business_route_geography() to service_role;

-- Prefer canonical Place/Route destination geography. Request country/region
-- describes coarse traveler origin unless the event explicitly marks its geo
-- semantics as destination.
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
  explicit_destination boolean := lower(coalesce(event_properties ->> 'geo_semantics', '')) = 'destination';
  destination_country text := coalesce(
    public.business_json_text(event_properties, array['destination_country', 'target_country']),
    case when explicit_destination then event_country else null end
  );
  destination_region text := coalesce(
    public.business_json_text(event_properties, array['destination_region', 'target_region']),
    case when explicit_destination then event_region else null end
  );
  destination_city text := coalesce(
    public.business_json_text(event_properties, array['destination_city', 'target_city']),
    case when explicit_destination then event_city else null end
  );
  code text := public.business_country_code(destination_country);
  area_name text := public.business_json_text(
    event_properties,
    array['destination_neighborhood', 'destination_area', 'target_neighborhood', 'target_area']
  );
begin
  if event_entity_type = 'place' and event_entity_id is not null then
    select geo_id into result_id from public.dim_places
    where place_id = event_entity_id and is_analytics_eligible;
  elsif event_entity_type = 'route' and event_entity_id is not null then
    select geo_id into result_id from public.dim_routes
    where route_id = event_entity_id and is_analytics_eligible;
  end if;
  if result_id is not null then return result_id; end if;
  if direct_geo_id is not null then return direct_geo_id; end if;

  if area_name is not null then
    select area.id into result_id
    from public.geo_entities area
    left join public.geo_entities locality on locality.id = area.parent_geo_id
    where area.country_code = code
      and area.type in ('area', 'neighborhood')
      and area.canonical_name = public.business_canonical_label(area_name)
      and (destination_city is null or locality.canonical_name = public.business_canonical_label(destination_city))
    limit 1;
  end if;
  if result_id is not null then return result_id; end if;

  if destination_city is not null then
    select locality.id into result_id
    from public.geo_entities locality
    left join public.geo_entities parent on parent.id = locality.parent_geo_id
    where locality.country_code = code
      and locality.type in ('city', 'municipality')
      and locality.canonical_name = public.business_canonical_label(destination_city)
      and (
        destination_region is null
        or parent.canonical_name = public.business_canonical_label(destination_region)
        or exists (
          select 1 from public.geo_entities ancestor
          where ancestor.id = parent.parent_geo_id
            and ancestor.canonical_name = public.business_canonical_label(destination_region)
        )
      )
    limit 1;
  end if;
  if result_id is not null then return result_id; end if;

  if destination_region is not null then
    select id into result_id
    from public.geo_entities
    where country_code = code
      and type in ('admin_level_1', 'admin_level_2')
      and canonical_name = public.business_canonical_label(destination_region)
    order by case when type = 'admin_level_2' then 0 else 1 end
    limit 1;
  end if;
  if result_id is not null then return result_id; end if;

  if code is not null then
    select id into result_id from public.geo_entities
    where country_code = code and type = 'country'
    limit 1;
  end if;
  return result_id;
end;
$$;

alter function public.resolve_business_event_geo_id(uuid, text, text, text, text, text, jsonb) owner to postgres;
revoke all on function public.resolve_business_event_geo_id(uuid, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.resolve_business_event_geo_id(uuid, text, text, text, text, text, jsonb)
  to service_role;

create or replace view public.analytics_normalized_events
with (security_invoker = true)
as
select
  event.event_id,
  coalesce(mapping.canonical_event_name, event.event_name) as event_name,
  event.event_name as original_event_name,
  coalesce(mapping.canonical_version, event.event_version, 1) as event_version,
  event.entity_type,
  event.entity_id,
  event.user_id,
  event.anonymous_id,
  event.session_id,
  event.source,
  event.platform,
  event.locale,
  event.timezone,
  event.country,
  event.region,
  event.city,
  event.received_at,
  event.occurred_at,
  event.properties,
  event.context,
  event.source_type,
  event.source_id,
  public.resolve_business_event_geo_id(
    event.geo_id, event.entity_type, event.entity_id,
    event.country, event.region, event.city, event.properties
  ) as geo_id,
  event.country as origin_country,
  event.region as origin_region,
  event.city as origin_city,
  event.geo_id as explicit_event_geo_id
from public.analytics_valid_events event
left join public.analytics_event_name_mappings mapping
  on mapping.original_event_name = event.event_name and mapping.status = 'active';

revoke all on table public.analytics_normalized_events from public, anon, authenticated;
grant select on table public.analytics_normalized_events to service_role;

create or replace function public.business_destination_geography_quality_report()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'places_total', (select count(*) from public.business_place_destination_geography),
    'places_with_country_pct', (
      select case when count(*) = 0 then 100 else round(100.0 * count(*) filter (where country_geo_id is not null) / count(*), 1) end
      from public.dim_places place
      left join public.business_destination_geo_hierarchy hierarchy on hierarchy.leaf_geo_id = place.geo_id
    ),
    'places_with_region_pct', (
      select case when count(*) = 0 then 100 else round(100.0 * count(*) filter (where admin_level_1_geo_id is not null) / count(*), 1) end
      from public.dim_places place
      left join public.business_destination_geo_hierarchy hierarchy on hierarchy.leaf_geo_id = place.geo_id
    ),
    'places_with_city_pct', (
      select case when count(*) = 0 then 100 else round(100.0 * count(*) filter (where locality_geo_id is not null) / count(*), 1) end
      from public.dim_places place
      left join public.business_destination_geo_hierarchy hierarchy on hierarchy.leaf_geo_id = place.geo_id
    ),
    'routes_total', (select count(*) from public.dim_routes),
    'routes_with_market_pct', (
      select case when count(*) = 0 then 100 else round(100.0 * count(*) filter (where geo_id is not null) / count(*), 1) end
      from public.dim_routes
    ),
    'destination_events_total', (
      select count(*) from public.analytics_normalized_events where entity_type in ('place', 'route')
    ),
    'destination_events_with_geo_pct', (
      select case when count(*) = 0 then 100 else round(100.0 * count(*) filter (where geo_id is not null) / count(*), 1) end
      from public.analytics_normalized_events where entity_type in ('place', 'route')
    ),
    'destination_events_unknown', (
      select count(*) from public.analytics_normalized_events
      where entity_type in ('place', 'route') and geo_id is null
    ),
    'traveler_origin_country_pct', (
      select case when count(*) = 0 then 100 else round(100.0 * count(*) filter (where nullif(country, '') is not null) / count(*), 1) end
      from public.analytics_normalized_events
    ),
    'enrichment_applied', (select count(*) from public.business_place_geo_enrichment where status = 'applied'),
    'enrichment_unknown', (select count(*) from public.business_place_geo_enrichment where status = 'unknown'),
    'enrichment_review_required', (select count(*) from public.business_place_geo_enrichment where status = 'review_required'),
    'route_scopes', (
      select coalesce(jsonb_object_agg(scope, amount), '{}'::jsonb)
      from (
        select coalesce(metadata ->> 'geo_scope', 'unknown') as scope, count(*) as amount
        from public.dim_routes group by 1
      ) scopes
    ),
    'last_attempted_aggregation', (
      select jsonb_build_object(
        'started_at', job_started_at,
        'finished_at', job_finished_at,
        'status', status,
        'duration_ms', case when job_finished_at is null then null
          else round(extract(epoch from (job_finished_at - job_started_at)) * 1000) end,
        'trigger', trigger,
        'events_processed', events_processed,
        'records_generated', records_generated,
        'error_code', error_code
      )
      from public.business_aggregation_runs
      order by job_started_at desc limit 1
    ),
    'last_successful_aggregation', (
      select job_finished_at from public.business_aggregation_runs
      where status = 'succeeded' order by job_finished_at desc nulls last limit 1
    )
  );
$$;

create or replace function public.verify_business_geo_enrichment_schema()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  with checks(name, present) as (
    values
      ('relation.business_place_geo_enrichment', to_regclass('public.business_place_geo_enrichment') is not null),
      ('view.business_destination_geo_hierarchy', to_regclass('public.business_destination_geo_hierarchy') is not null),
      ('view.business_place_destination_geography', to_regclass('public.business_place_destination_geography') is not null),
      ('view.business_route_destination_geography', to_regclass('public.business_route_destination_geography') is not null),
      ('column.analytics_normalized_events.origin_country', exists(
        select 1 from information_schema.columns where table_schema = 'public'
          and table_name = 'analytics_normalized_events' and column_name = 'origin_country'
      )),
      ('index.business_place_geo_enrichment_status_idx', to_regclass('public.business_place_geo_enrichment_status_idx') is not null),
      ('rls.business_place_geo_enrichment', coalesce((
        select relrowsecurity from pg_class where oid = 'public.business_place_geo_enrichment'::regclass
      ), false)),
      ('permission.enrichment_not_authenticated', not coalesce(has_table_privilege('authenticated', 'public.business_place_geo_enrichment', 'select'), false)),
      ('permission.apply_service_role', coalesce(has_function_privilege(
        'service_role',
        to_regprocedure('public.apply_business_place_geo_enrichment(uuid,numeric,numeric,text,text,text,text,text,text,text,text,text,text,text,text,numeric,jsonb)'),
        'execute'
      ), false)),
      ('permission.apply_not_authenticated', not coalesce(has_function_privilege(
        'authenticated',
        to_regprocedure('public.apply_business_place_geo_enrichment(uuid,numeric,numeric,text,text,text,text,text,text,text,text,text,text,text,text,numeric,jsonb)'),
        'execute'
      ), false)),
      ('function.refresh_business_route_geography', to_regprocedure('public.refresh_business_route_geography()') is not null),
      ('function.business_destination_geography_quality_report', to_regprocedure('public.business_destination_geography_quality_report()') is not null)
  )
  select jsonb_build_object(
    'ok', bool_and(present),
    'checks', jsonb_object_agg(name, present),
    'missing', coalesce(jsonb_agg(name) filter (where not present), '[]'::jsonb)
  )
  from checks;
$$;

alter function public.business_destination_geography_quality_report() owner to postgres;
alter function public.verify_business_geo_enrichment_schema() owner to postgres;
revoke all on function public.business_destination_geography_quality_report() from public, anon, authenticated;
revoke all on function public.verify_business_geo_enrichment_schema() from public, anon, authenticated;
grant execute on function public.business_destination_geography_quality_report() to service_role;
grant execute on function public.verify_business_geo_enrichment_schema() to service_role;
