-- Fix ambiguous canonical_name in backfill_business_dimensions.
-- PL/pgSQL variable collided with geo_entities.canonical_name.

CREATE OR REPLACE FUNCTION public.backfill_business_dimensions()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $$
declare
  source_row record;
  payload jsonb;
  source_entity_id text;
  display_name text;
  entity_canonical text;
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
  -- Seed the canonical hierarchy from coarse event geography before resolving
  -- catalog entities. This does not rewrite immutable analytics_events rows.
  if to_regclass('public.analytics_events') is not null then
    for source_row in
      select distinct
        nullif(trim(e.country), '') as country,
        nullif(trim(e.region), '') as region,
        nullif(trim(e.city), '') as city,
        public.business_json_text(e.properties || e.context, array['neighborhood', 'area', 'district', 'barrio']) as area,
        nullif(trim(e.timezone), '') as timezone
      from public.analytics_events e
      where nullif(trim(e.country), '') is not null
         or nullif(trim(e.region), '') is not null
         or nullif(trim(e.city), '') is not null
    loop
      raw_country := source_row.country;
      country_code := public.business_country_code(raw_country);
      raw_region := source_row.region;
      raw_city := source_row.city;
      raw_area := source_row.area;
      timezone_name := source_row.timezone;

      country_id := case when raw_country is null then null else public.ensure_business_geo_entity(
        public.business_country_name(raw_country, country_code), 'country', country_code, null, timezone_name
      ) end;
      region_id := case when raw_region is null then null else public.ensure_business_geo_entity(
        public.business_region_name(country_code, raw_region), 'admin_level_1', country_code, country_id, timezone_name
      ) end;
      city_id := case when raw_city is null then null else public.ensure_business_geo_entity(
        raw_city, 'city', country_code, coalesce(region_id, country_id), timezone_name
      ) end;
      area_id := case when raw_area is null then null else public.ensure_business_geo_entity(
        raw_area, 'area', country_code, coalesce(city_id, region_id, country_id), timezone_name
      ) end;
    end loop;
  end if;

  if to_regclass('public.places') is not null then
    for source_row in execute $query$
      select to_jsonb(p) || jsonb_build_object(
        'geo_lat', case when p.location is null then null else st_y(p.location::geometry) end,
        'geo_lng', case when p.location is null then null else st_x(p.location::geometry) end
      ) as payload
      from public.places p
    $query$ loop
      payload := source_row.payload;
      source_entity_id := public.business_json_text(payload, array['id', 'place_id']);
      display_name := public.business_json_text(payload, array['place_name', 'name', 'title']);
      if source_entity_id is null then continue; end if;

      entity_canonical := public.business_canonical_label(display_name);
      raw_country := public.business_json_text(payload, array['country', 'country_code']);
      country_code := public.business_country_code(raw_country);
      raw_region := public.business_json_text(payload, array['region', 'state', 'province', 'department', 'departamento']);
      raw_city := public.business_json_text(payload, array['city', 'locality', 'municipality']);
      raw_area := public.business_json_text(payload, array['neighborhood', 'neighbourhood', 'area', 'district', 'barrio']);
      timezone_name := public.business_json_text(payload, array['timezone', 'time_zone']);

      if raw_country is null then
        select e.country, e.region, e.city,
          public.business_json_text(e.properties || e.context, array['neighborhood', 'area', 'district', 'barrio']),
          e.timezone
        into raw_country, raw_region, raw_city, raw_area, timezone_name
        from public.analytics_events e
        where e.entity_type = 'place' and e.entity_id = source_entity_id
          and (e.country is not null or e.region is not null or e.city is not null)
        group by e.country, e.region, e.city,
          public.business_json_text(e.properties || e.context, array['neighborhood', 'area', 'district', 'barrio']),
          e.timezone
        order by count(*) desc, max(e.received_at) desc
        limit 1;
      end if;
      country_code := public.business_country_code(raw_country);

      country_id := case when raw_country is null then null else public.ensure_business_geo_entity(
        public.business_country_name(raw_country, country_code), 'country', country_code, null, timezone_name
      ) end;
      region_id := case when raw_region is null then null else public.ensure_business_geo_entity(
        public.business_region_name(country_code, raw_region), 'admin_level_1', country_code, country_id, timezone_name
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

      eligible := display_name is not null and entity_canonical is not null
        and entity_canonical !~ '(^| )(test|qa|deleted|invalid)( |$)'
        and display_name !~* '^[0-9a-f]{8}-[0-9a-f-]{27,}$'
        and lower(coalesce(public.business_json_text(payload, array['status']), 'active')) not in ('deleted', 'test', 'qa', 'invalid');

      insert into public.dim_places(
        place_id, place_name, canonical_name, category_id, geo_id,
        is_analytics_eligible, latitude, longitude, metadata, valid_to, updated_at
      ) values (
        source_entity_id, coalesce(display_name, 'Unknown place'), entity_canonical, resolved_category_id, resolved_geo_id,
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
      source_entity_id := public.business_json_text(payload, array['id', 'route_id']);
      display_name := public.business_json_text(payload, array['route_name', 'name', 'title']);
      if source_entity_id is null then continue; end if;

      entity_canonical := public.business_canonical_label(display_name);
      raw_country := public.business_json_text(payload, array['country', 'country_code']);
      country_code := public.business_country_code(raw_country);
      raw_region := public.business_json_text(payload, array['region', 'state', 'province']);
      raw_city := public.business_json_text(payload, array['city', 'locality', 'municipality']);
      timezone_name := public.business_json_text(payload, array['timezone', 'time_zone']);
      if raw_country is null then
        select e.country, e.region, e.city, e.timezone
        into raw_country, raw_region, raw_city, timezone_name
        from public.analytics_events e
        where e.entity_type = 'route' and e.entity_id = source_entity_id
          and (e.country is not null or e.region is not null or e.city is not null)
        group by e.country, e.region, e.city, e.timezone
        order by count(*) desc, max(e.received_at) desc
        limit 1;
      end if;
      country_code := public.business_country_code(raw_country);
      country_id := case when raw_country is null then null else public.ensure_business_geo_entity(
        public.business_country_name(raw_country, country_code), 'country', country_code, null, timezone_name
      ) end;
      region_id := case when raw_region is null then null else public.ensure_business_geo_entity(
        public.business_region_name(country_code, raw_region), 'admin_level_1', country_code, country_id, timezone_name
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

      eligible := display_name is not null and entity_canonical is not null
        and entity_canonical !~ '(^| )(test|qa|deleted|invalid)( |$)'
        and display_name !~* '^[0-9a-f]{8}-[0-9a-f-]{27,}$'
        and lower(coalesce(public.business_json_text(payload, array['status']), 'active')) not in ('deleted', 'test', 'qa', 'invalid');

      insert into public.dim_routes(
        route_id, route_name, canonical_name, category_id, geo_id, creator_id,
        stop_count, status, is_analytics_eligible, metadata, valid_to, updated_at
      ) values (
        source_entity_id, coalesce(display_name, 'Unknown route'), entity_canonical, resolved_category_id, resolved_geo_id,
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
  select g.id, g.name, g.canonical_name, g.type, g.country_code, g.parent_geo_id, g.timezone, null
  from public.geo_entities g
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

grant execute on function public.backfill_business_dimensions() to service_role;
revoke all on function public.backfill_business_dimensions() from public, anon, authenticated;
