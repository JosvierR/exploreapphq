-- Keep ambiguous event geography out of destination-market analytics. A raw
-- event geo_id is a destination only when the producer explicitly declares
-- geo_semantics=destination. Place/Route catalog geography remains preferred.

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

  -- geo_id is ambiguous in the legacy event contract. Prefer unknown over
  -- relabeling request/traveler origin as a destination market.
  if direct_geo_id is not null and explicit_destination then return direct_geo_id; end if;

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
  case
    when lower(coalesce(event.properties ->> 'geo_semantics', '')) = 'destination' then event.geo_id
    else null
  end as explicit_event_geo_id,
  case
    when lower(coalesce(event.properties ->> 'geo_semantics', '')) = 'destination' then null
    else event.geo_id
  end as origin_geo_id
from public.analytics_valid_events event
left join public.analytics_event_name_mappings mapping
  on mapping.original_event_name = event.event_name and mapping.status = 'active';

revoke all on table public.analytics_normalized_events from public, anon, authenticated;
grant select on table public.analytics_normalized_events to service_role;

create or replace function public.verify_business_geo_semantics()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  with checks(name, present) as (
    values
      ('column.analytics_normalized_events.origin_geo_id', exists(
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'analytics_normalized_events' and column_name = 'origin_geo_id'
      )),
      ('ambiguous_event_geo_not_destination', not exists(
        select 1
        from public.analytics_normalized_events normalized
        join public.analytics_valid_events source on source.event_id = normalized.event_id
        where source.geo_id is not null
          and lower(coalesce(source.properties ->> 'geo_semantics', '')) <> 'destination'
          and normalized.entity_type not in ('place', 'route')
          and normalized.geo_id = source.geo_id
      )),
      ('destination_event_geo_preserved', not exists(
        select 1
        from public.analytics_normalized_events normalized
        join public.analytics_valid_events source on source.event_id = normalized.event_id
        where source.geo_id is not null
          and lower(coalesce(source.properties ->> 'geo_semantics', '')) = 'destination'
          and normalized.geo_id is distinct from source.geo_id
          and not (
            normalized.entity_type in ('place', 'route')
            and normalized.geo_id is not null
          )
      ))
  )
  select jsonb_build_object(
    'ok', bool_and(present),
    'checks', jsonb_object_agg(name, present),
    'missing', coalesce(jsonb_agg(name) filter (where not present), '[]'::jsonb)
  )
  from checks;
$$;

alter function public.verify_business_geo_semantics() owner to postgres;
revoke all on function public.verify_business_geo_semantics() from public, anon, authenticated;
grant execute on function public.verify_business_geo_semantics() to service_role;
