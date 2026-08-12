-- Targeted read-only probes for local-only migration schema effects
select jsonb_build_object(
  'moderation_20260629170000', jsonb_build_object(
    'content_reports', to_regclass('public.content_reports') is not null,
    'admin_users', to_regclass('public.admin_users') is not null,
    'moderation_actions', to_regclass('public.moderation_actions') is not null,
    'content_report_notes', to_regclass('public.content_report_notes') is not null
  ),
  'moderation_20260630120000', jsonb_build_object(
    'videos_moderation_status', exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='videos' and column_name='moderation_status'
    ),
    'places_moderation_status', exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='places' and column_name='moderation_status'
    ),
    'reporter_hidden_content', to_regclass('public.reporter_hidden_content') is not null
  ),
  'analytics_20260701120000', jsonb_build_object(
    'analytics_events', to_regclass('public.analytics_events') is not null,
    'analytics_user_daily', to_regclass('public.analytics_user_daily') is not null,
    'analytics_content_daily', to_regclass('public.analytics_content_daily') is not null,
    'analytics_search_daily', to_regclass('public.analytics_search_daily') is not null,
    'analytics_session_daily', to_regclass('public.analytics_session_daily') is not null,
    'analytics_affinity', to_regclass('public.analytics_affinity') is not null
  ),
  'analytics_compat_20260702120000', jsonb_build_object(
    'source_col', exists (select 1 from information_schema.columns where table_schema='public' and table_name='analytics_events' and column_name='source'),
    'device_os_col', exists (select 1 from information_schema.columns where table_schema='public' and table_name='analytics_events' and column_name='device_os'),
    'occurred_at_idx', exists (select 1 from pg_indexes where schemaname='public' and indexname='analytics_events_occurred_at_idx')
  ),
  'aggregate_rpc', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'signature', p.oid::regprocedure::text,
      'security_definer', p.prosecdef,
      'owner', pg_get_userbyid(p.proowner),
      'search_path', (
        select coalesce(
          (select option_value from unnest(coalesce(p.proconfig, array[]::text[])) cfg(option_value)
           where option_value like 'search_path=%' limit 1),
          null
        )
      )
    )), '[]'::jsonb)
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='aggregate_analytics_events_for_day'
  ),
  'admin_snapshot_20260810120000', jsonb_build_object(
    'fn_exists', to_regprocedure('public.admin_product_analytics_snapshot()') is not null
  ),
  'bi_v2_core', jsonb_build_object(
    'geo_entities', to_regclass('public.geo_entities') is not null,
    'business_accounts', to_regclass('public.business_accounts') is not null,
    'business_members', to_regclass('public.business_members') is not null,
    'business_locations', to_regclass('public.business_locations') is not null,
    'fact_place_daily', to_regclass('public.fact_place_daily') is not null,
    'fn_aggregate_bi', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='aggregate_business_intelligence_for_day'
    ),
    'fn_verify_bi', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='verify_business_intelligence_schema'
    ),
    'analytics_events_geo_id', exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='analytics_events' and column_name='geo_id'
    ),
    'analytics_events_eligible_for_bi', exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='analytics_events' and column_name='eligible_for_bi'
    ),
    'bi_v2_enabled_col', exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='business_accounts' and column_name='bi_v2_enabled'
    )
  ),
  'remote_only_sample_objects', jsonb_build_object(
    'has_schema_migrations', to_regclass('supabase_migrations.schema_migrations') is not null,
    'remote_versions_sample', (
      select coalesce(jsonb_agg(version order by version), '[]'::jsonb)
      from (
        select version from supabase_migrations.schema_migrations
        where version in ('00001','20260525','20260527120000','20260625120001','20260702123902','20260704170000','20260802120000')
      ) s
    )
  )
) as probes;
