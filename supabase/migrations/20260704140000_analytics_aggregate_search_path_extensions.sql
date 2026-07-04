-- DATA-005: SECURITY DEFINER functions must include extensions in search_path.
-- Setting search_path = public alone breaks pgcrypto digest() used by DATA-001:
--   function digest(text, unknown) does not exist (42883)

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'aggregate_analytics_events_for_day'
  loop
    execute format('alter function %s security definer', fn.signature);
    execute format('alter function %s set search_path = public, extensions', fn.signature);
    execute format('grant execute on function %s to service_role', fn.signature);
  end loop;
end $$;
