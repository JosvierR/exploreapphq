-- Preserve proven destination geography whenever the legacy dimension loader
-- refreshes mutable Place/Route attributes. The original loader remains a
-- private implementation detail and the service-only wrapper reapplies only
-- enrichment whose source coordinates still match the Place coordinates.

alter function public.backfill_business_dimensions()
  rename to backfill_business_dimensions_without_geo_enrichment;

revoke all on function public.backfill_business_dimensions_without_geo_enrichment()
  from public, anon, authenticated, service_role;

create or replace function public.backfill_business_dimensions()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_result jsonb;
  route_result jsonb;
  enriched_places bigint := 0;
  enriched_locations bigint := 0;
begin
  base_result := public.backfill_business_dimensions_without_geo_enrichment();

  update public.dim_places place
  set
    geo_id = enrichment.resolved_geo_id,
    metadata = coalesce(place.metadata, '{}'::jsonb) || jsonb_build_object(
      'destination_geo_source', enrichment.source,
      'destination_geo_confidence', enrichment.confidence,
      'destination_geo_enriched_at', enrichment.updated_at
    ),
    updated_at = now()
  from public.business_place_geo_enrichment enrichment
  where enrichment.place_id::text = place.place_id
    and enrichment.status = 'applied'
    and enrichment.resolved_geo_id is not null
    and place.latitude is not null
    and place.longitude is not null
    and abs(place.latitude - enrichment.latitude) <= 0.0000005
    and abs(place.longitude - enrichment.longitude) <= 0.0000005;
  get diagnostics enriched_places = row_count;

  update public.business_locations location
  set
    geo_id = place.geo_id,
    updated_at = now()
  from public.dim_places place
  where location.place_id = place.place_id
    and place.geo_id is not null
    and location.geo_id is distinct from place.geo_id;
  get diagnostics enriched_locations = row_count;

  route_result := public.refresh_business_route_geography();

  return coalesce(base_result, '{}'::jsonb) || jsonb_build_object(
    'enriched_places_preserved', enriched_places,
    'business_locations_refreshed', enriched_locations,
    'route_geography', route_result
  );
end;
$$;

alter function public.backfill_business_dimensions() owner to postgres;
revoke all on function public.backfill_business_dimensions() from public, anon, authenticated;
grant execute on function public.backfill_business_dimensions() to service_role;

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
      ('function.business_destination_geography_quality_report', to_regprocedure('public.business_destination_geography_quality_report()') is not null),
      ('function.backfill_geo_wrapper', to_regprocedure('public.backfill_business_dimensions()') is not null),
      ('function.backfill_geo_base_private', to_regprocedure('public.backfill_business_dimensions_without_geo_enrichment()') is not null),
      ('permission.backfill_geo_wrapper_service_role', coalesce(has_function_privilege(
        'service_role', to_regprocedure('public.backfill_business_dimensions()'), 'execute'
      ), false)),
      ('permission.backfill_geo_base_not_service_role', not coalesce(has_function_privilege(
        'service_role', to_regprocedure('public.backfill_business_dimensions_without_geo_enrichment()'), 'execute'
      ), false))
  )
  select jsonb_build_object(
    'ok', bool_and(present),
    'checks', jsonb_object_agg(name, present),
    'missing', coalesce(jsonb_agg(name) filter (where not present), '[]'::jsonb)
  )
  from checks;
$$;

alter function public.verify_business_geo_enrichment_schema() owner to postgres;
revoke all on function public.verify_business_geo_enrichment_schema() from public, anon, authenticated;
grant execute on function public.verify_business_geo_enrichment_schema() to service_role;
