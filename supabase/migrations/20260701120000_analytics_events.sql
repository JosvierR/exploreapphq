-- DATA-002: analytics event ingestion (server-side insert via /api/events)

create table if not exists public.analytics_events (
  event_id text primary key,
  event_name text not null,
  event_version integer not null default 1,
  user_id uuid references auth.users (id) on delete set null,
  anonymous_id text,
  session_id text not null,
  entity_type text,
  entity_id text,
  occurred_at timestamptz not null,
  received_at timestamptz not null,
  batch_id text,
  request_id text,
  platform text,
  app_version text,
  build_number text,
  locale text,
  timezone text,
  country text,
  region text,
  city text,
  properties jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb
);

create table if not exists public.analytics_event_dead_letters (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  batch_id text,
  event_id text,
  event_name text,
  reason text,
  received_at timestamptz not null default now()
);

create index if not exists analytics_events_received_at_idx
  on public.analytics_events (received_at desc);

create index if not exists analytics_events_event_name_received_at_idx
  on public.analytics_events (event_name, received_at desc);

create index if not exists analytics_events_user_id_received_at_idx
  on public.analytics_events (user_id, received_at desc)
  where user_id is not null;

create index if not exists analytics_events_anonymous_id_received_at_idx
  on public.analytics_events (anonymous_id, received_at desc)
  where anonymous_id is not null;

create index if not exists analytics_event_dead_letters_received_at_idx
  on public.analytics_event_dead_letters (received_at desc);

alter table public.analytics_events enable row level security;
alter table public.analytics_event_dead_letters enable row level security;

drop policy if exists "admins can read analytics events" on public.analytics_events;
create policy "admins can read analytics events"
  on public.analytics_events
  for select
  to authenticated
  using (public.is_explore_admin());

drop policy if exists "admins can read analytics dead letters" on public.analytics_event_dead_letters;
create policy "admins can read analytics dead letters"
  on public.analytics_event_dead_letters
  for select
  to authenticated
  using (public.is_explore_admin());
