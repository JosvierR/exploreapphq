-- Read-only production schema inventory (no DDL/DML mutations).
select jsonb_build_object(
  'tables', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', c.relname,
      'rls', c.relrowsecurity,
      'kind', case c.relkind when 'r' then 'table' when 'v' then 'view' when 'm' then 'materialized_view' else c.relkind::text end
    ) order by c.relname), '[]'::jsonb)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm') and not c.relispartition
  ),
  'columns', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', table_name,
      'column', column_name,
      'type', data_type,
      'udt', udt_name,
      'nullable', is_nullable,
      'default', column_default
    ) order by table_name, ordinal_position), '[]'::jsonb)
    from information_schema.columns
    where table_schema = 'public'
  ),
  'constraints', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', tc.table_name,
      'name', tc.constraint_name,
      'type', tc.constraint_type
    ) order by tc.table_name, tc.constraint_name), '[]'::jsonb)
    from information_schema.table_constraints tc
    where tc.table_schema = 'public'
  ),
  'indexes', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', tablename,
      'name', indexname,
      'def', indexdef
    ) order by tablename, indexname), '[]'::jsonb)
    from pg_indexes
    where schemaname = 'public'
  ),
  'functions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'args', pg_get_function_identity_arguments(p.oid),
      'language', l.lanname,
      'volatile', case p.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end,
      'security_definer', p.prosecdef
    ) order by p.proname), '[]'::jsonb)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public' and p.prokind = 'f'
  ),
  'triggers', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', event_object_table,
      'name', trigger_name,
      'timing', action_timing,
      'events', event_manipulation,
      'statement', action_statement
    ) order by event_object_table, trigger_name), '[]'::jsonb)
    from information_schema.triggers
    where trigger_schema = 'public'
  ),
  'policies', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', tablename,
      'name', policyname,
      'cmd', cmd,
      'roles', roles,
      'permissive', permissive,
      'qual', qual,
      'with_check', with_check
    ) order by tablename, policyname), '[]'::jsonb)
    from pg_policies
    where schemaname = 'public'
  ),
  'extensions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', e.extname,
      'version', e.extversion,
      'schema', n.nspname
    ) order by e.extname), '[]'::jsonb)
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
  ),
  'bi_probe', (
    select jsonb_build_object(
      'analytics_events', to_regclass('public.analytics_events') is not null,
      'geo_entities', to_regclass('public.geo_entities') is not null,
      'business_accounts', to_regclass('public.business_accounts') is not null,
      'business_members', to_regclass('public.business_members') is not null,
      'business_locations', to_regclass('public.business_locations') is not null,
      'business_claims', to_regclass('public.business_claims') is not null,
      'business_plan_features', to_regclass('public.business_plan_features') is not null,
      'business_entitlements', to_regclass('public.business_entitlements') is not null,
      'business_saved_views', to_regclass('public.business_saved_views') is not null,
      'business_market_access', to_regclass('public.business_market_access') is not null,
      'business_intelligence_signals', to_regclass('public.business_intelligence_signals') is not null,
      'analytics_event_name_mappings', to_regclass('public.analytics_event_name_mappings') is not null,
      'business_metric_definitions', to_regclass('public.business_metric_definitions') is not null,
      'analytics_event_taxonomy', to_regclass('public.analytics_event_taxonomy') is not null,
      'dim_geo', to_regclass('public.dim_geo') is not null,
      'dim_places', to_regclass('public.dim_places') is not null,
      'dim_routes', to_regclass('public.dim_routes') is not null,
      'dim_categories', to_regclass('public.dim_categories') is not null,
      'dim_businesses', to_regclass('public.dim_businesses') is not null,
      'dim_content', to_regclass('public.dim_content') is not null,
      'dim_sources', to_regclass('public.dim_sources') is not null,
      'dim_date', to_regclass('public.dim_date') is not null,
      'fact_place_daily', to_regclass('public.fact_place_daily') is not null,
      'fact_route_daily', to_regclass('public.fact_route_daily') is not null,
      'fact_market_daily', to_regclass('public.fact_market_daily') is not null,
      'fact_search_daily', to_regclass('public.fact_search_daily') is not null,
      'fact_content_attribution', to_regclass('public.fact_content_attribution') is not null,
      'fact_business_daily', to_regclass('public.fact_business_daily') is not null,
      'business_aggregation_runs', to_regclass('public.business_aggregation_runs') is not null,
      'places', to_regclass('public.places') is not null,
      'routes', to_regclass('public.routes') is not null,
      'videos', to_regclass('public.videos') is not null,
      'moderation_reports', to_regclass('public.moderation_reports') is not null,
      'moderation_actions', to_regclass('public.moderation_actions') is not null,
      'admin_audit_log', to_regclass('public.admin_audit_log') is not null,
      'analytics_daily_aggregates', to_regclass('public.analytics_daily_aggregates') is not null,
      'analytics_content_daily', to_regclass('public.analytics_content_daily') is not null,
      'fn_admin_product_analytics_snapshot', to_regprocedure('public.admin_product_analytics_snapshot()') is not null,
      'fn_aggregate_business_intelligence_for_day', exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'aggregate_business_intelligence_for_day'
      ),
      'fn_verify_business_intelligence_schema', exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'verify_business_intelligence_schema'
      ),
      'fn_is_business_member', exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'is_business_member'
      )
    )
  ),
  'analytics_events_columns', (
    select coalesce(jsonb_agg(column_name order by ordinal_position), '[]'::jsonb)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'analytics_events'
  ),
  'schema_migrations', (
    select coalesce(jsonb_agg(version order by version), '[]'::jsonb)
    from supabase_migrations.schema_migrations
  )
) as inventory;
