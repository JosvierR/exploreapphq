-- DATA-005: allow service_role to run aggregation without pg_safeupdate blocking
-- unqualified DELETE/UPDATE inside the function body.
--
-- SQL Editor works because it runs as a privileged role.
-- PostgREST/service_role hits: ERROR 21000 "DELETE requires a WHERE clause"
-- unless the function is SECURITY DEFINER (owner privileges).
--
-- This does NOT replace the DATA-001 function body.

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
    -- Include extensions so pgcrypto digest() resolves under SECURITY DEFINER.
    execute format('alter function %s set search_path = public, extensions', fn.signature);
    execute format('grant execute on function %s to service_role', fn.signature);
    execute format('grant execute on function %s to authenticated', fn.signature);
  end loop;
end $$;
