select jsonb_build_object(
  'event_geography', (
    select coalesce(jsonb_agg(to_jsonb(grouped) order by grouped.events desc), '[]'::jsonb)
    from (
      select country, region, city, count(*)::bigint as events
      from public.analytics_events
      where country is not null or region is not null or city is not null
      group by country, region, city
    ) grouped
  ),
  'event_names', (
    select coalesce(jsonb_agg(to_jsonb(grouped) order by grouped.events desc), '[]'::jsonb)
    from (
      select event_name, count(*)::bigint as events
      from public.analytics_events
      group by event_name
    ) grouped
  ),
  'top_places', (
    select coalesce(jsonb_agg(to_jsonb(grouped) order by grouped.events desc), '[]'::jsonb)
    from (
      select p.id, p.name, p.category::text as category, count(*)::bigint as events
      from public.analytics_events e
      join public.places p on p.id::text = e.entity_id
      where e.entity_type = 'place'
      group by p.id, p.name, p.category
      order by events desc
      limit 10
    ) grouped
  ),
  'top_routes', (
    select coalesce(jsonb_agg(to_jsonb(grouped) order by grouped.events desc), '[]'::jsonb)
    from (
      select r.id, r.name, r.category::text as category, count(*)::bigint as events
      from public.analytics_events e
      join public.routes r on r.id::text = e.entity_id
      where e.entity_type = 'route'
      group by r.id, r.name, r.category
      order by events desc
      limit 10
    ) grouped
  ),
  'place_categories', (
    select coalesce(jsonb_agg(to_jsonb(grouped) order by grouped.entities desc), '[]'::jsonb)
    from (
      select category::text as category, count(*)::bigint as entities
      from public.places
      group by category
    ) grouped
  ),
  'route_categories', (
    select coalesce(jsonb_agg(to_jsonb(grouped) order by grouped.entities desc), '[]'::jsonb)
    from (
      select category::text as category, count(*)::bigint as entities
      from public.routes
      group by category
    ) grouped
  ),
  'catalog_geography', (
    select jsonb_build_object(
      'places_with_location', count(*) filter (where location is not null),
      'places_without_location', count(*) filter (where location is null),
      'location_types', array_agg(distinct geometrytype(location::geometry)) filter (where location is not null),
      'location_srids', array_agg(distinct st_srid(location::geometry)) filter (where location is not null)
    )
    from public.places
  )
) as production_distribution;
