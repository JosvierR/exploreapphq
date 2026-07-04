-- DATA-005: grant service_role execute on existing aggregation RPC overloads.
-- Does NOT replace function bodies (DATA-001 owns the implementation).

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
    execute format('grant execute on function %s to service_role', fn.signature);
    execute format('grant execute on function %s to authenticated', fn.signature);
  end loop;
end $$;
