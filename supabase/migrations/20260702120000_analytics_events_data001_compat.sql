-- DATA-002 compatibility: align analytics ingestion with the DATA-001 insert contract.
-- This is safe to run on environments that already have the DATA-001 columns.

alter table if exists public.analytics_events
  add column if not exists source text;

alter table if exists public.analytics_events
  add column if not exists device_os text;

create index if not exists analytics_events_occurred_at_idx
  on public.analytics_events (occurred_at desc);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'analytics_events'
      and column_name = 'received_at'
  ) then
    execute 'alter table public.analytics_events alter column received_at set default now()';
  end if;
end $$;

alter table if exists public.analytics_event_dead_letters
  add column if not exists user_id uuid;

alter table if exists public.analytics_event_dead_letters
  add column if not exists anonymous_id text;

alter table if exists public.analytics_event_dead_letters
  add column if not exists payload jsonb not null default '{}'::jsonb;

alter table if exists public.analytics_event_dead_letters
  add column if not exists source text;
