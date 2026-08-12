-- Read-only: orphan schema-effect probes + scale metrics
select jsonb_build_object(
  'orphan_20260719_effects', jsonb_build_object(
    'places_deleted_at', exists (select 1 from information_schema.columns where table_schema='public' and table_name='places' and column_name='deleted_at'),
    'routes_deleted_at', exists (select 1 from information_schema.columns where table_schema='public' and table_name='routes' and column_name='deleted_at'),
    'videos_deleted_at', exists (select 1 from information_schema.columns where table_schema='public' and table_name='videos' and column_name='deleted_at'),
    'videos_cloudflare_uid', exists (select 1 from information_schema.columns where table_schema='public' and table_name='videos' and column_name='cloudflare_uid'),
    'idx_videos_cloudflare_uid', exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_videos_cloudflare_uid'),
    'stamp_deleted_at_fn', exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='stamp_deleted_at'),
    'list_expired_deleted_videos', exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='list_expired_deleted_videos'),
    'list_expired_deleted_videos_args', (
      select coalesce(jsonb_agg(pg_get_function_identity_arguments(p.oid)), '[]'::jsonb)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='list_expired_deleted_videos'
    ),
    'hard_delete_expired_content', exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='hard_delete_expired_content')
  ),
  'unknown_orphan_candidates', jsonb_build_object(
    'schema_migrations_names', (
      select coalesce(jsonb_agg(jsonb_build_object('version', version, 'name', coalesce(name,'')) order by version), '[]'::jsonb)
      from supabase_migrations.schema_migrations
      where version in ('20260719140000','20260719150000','20260719160000','20260731120000','20260802120000','20260719120000')
    ),
    'recent_tables_after_jul19', (
      select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r'
        and c.relname ~* '(cleanup|cloudflare|cron|job|seed|analytics|admin|legal|deletion|privacy)'
    )
  ),
  'moderation_local_effects', jsonb_build_object(
    'content_reports_cols', (select coalesce(jsonb_agg(column_name order by ordinal_position),'[]'::jsonb) from information_schema.columns where table_schema='public' and table_name='content_reports'),
    'admin_users_cols', (select coalesce(jsonb_agg(column_name order by ordinal_position),'[]'::jsonb) from information_schema.columns where table_schema='public' and table_name='admin_users'),
    'moderation_actions_cols', (select coalesce(jsonb_agg(column_name order by ordinal_position),'[]'::jsonb) from information_schema.columns where table_schema='public' and table_name='moderation_actions'),
    'user_hidden_content_cols', (select coalesce(jsonb_agg(column_name order by ordinal_position),'[]'::jsonb) from information_schema.columns where table_schema='public' and table_name='user_hidden_content'),
    'videos_moderation_status_default', (select column_default from information_schema.columns where table_schema='public' and table_name='videos' and column_name='moderation_status'),
    'places_moderation_status_default', (select column_default from information_schema.columns where table_schema='public' and table_name='places' and column_name='moderation_status'),
    'content_reports_policies', (select coalesce(jsonb_agg(policyname order by policyname),'[]'::jsonb) from pg_policies where schemaname='public' and tablename='content_reports'),
    'user_hidden_content_policies', (select coalesce(jsonb_agg(policyname order by policyname),'[]'::jsonb) from pg_policies where schemaname='public' and tablename='user_hidden_content'),
    'is_admin_fn', exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='is_admin'),
    'is_moderator_fn', exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='is_moderator')
  ),
  'analytics_local_effects', jsonb_build_object(
    'analytics_events_cols', (select coalesce(jsonb_agg(column_name order by ordinal_position),'[]'::jsonb) from information_schema.columns where table_schema='public' and table_name='analytics_events'),
    'has_batch_id', exists (select 1 from information_schema.columns where table_schema='public' and table_name='analytics_events' and column_name='batch_id'),
    'has_request_id', exists (select 1 from information_schema.columns where table_schema='public' and table_name='analytics_events' and column_name='request_id'),
    'dead_letters', to_regclass('public.analytics_event_dead_letters') is not null,
    'analytics_events_rls', (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='analytics_events'),
    'analytics_events_policies', (select coalesce(jsonb_agg(policyname),'[]'::jsonb) from pg_policies where schemaname='public' and tablename='analytics_events'),
    'aggregate_owner', (select pg_get_userbyid(p.proowner) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='aggregate_analytics_events_for_day' limit 1),
    'aggregate_security_definer', (select p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='aggregate_analytics_events_for_day' limit 1),
    'aggregate_search_path', (select array_to_string(p.proconfig,',') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='aggregate_analytics_events_for_day' limit 1),
    'service_role_execute_aggregate', exists (
      select 1 from information_schema.routine_privileges
      where routine_schema='public' and routine_name='aggregate_analytics_events_for_day'
        and grantee='service_role' and privilege_type='EXECUTE'
    )
  ),
  'scale', jsonb_build_object(
    'analytics_events_est', (select reltuples::bigint from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='analytics_events'),
    'places_est', (select reltuples::bigint from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='places'),
    'videos_est', (select reltuples::bigint from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='videos'),
    'routes_est', (select reltuples::bigint from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='routes'),
    'users_est', (select reltuples::bigint from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='users')
  )
) as audit;
