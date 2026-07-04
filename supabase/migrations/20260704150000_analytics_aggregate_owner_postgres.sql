-- DATA-005: force aggregation RPC to run as postgres SECURITY DEFINER.
-- service_role callers still hit pg_safeupdate ("DELETE requires a WHERE clause")
-- unless the function owner is a superuser and prosecdef = true.

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
    begin
      execute format('alter function %s owner to postgres', fn.signature);
    exception
      when insufficient_privilege then
        raise notice 'Could not change owner for %', fn.signature;
    end;
    execute format('alter function %s security definer', fn.signature);
    execute format('alter function %s set search_path = public, extensions', fn.signature);
    execute format('grant execute on function %s to service_role', fn.signature);
  end loop;
end $$;
