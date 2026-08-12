-- Explore Business Intelligence v2
-- Shared, privacy-safe data model for Admin, Business Web/Mobile, and partner APIs.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.geo_entities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  canonical_name text not null,
  type text not null check (type in ('country', 'admin_level_1', 'admin_level_2', 'city', 'municipality', 'neighborhood', 'area')),
  country_code text not null check (char_length(country_code) = 2),
  parent_geo_id uuid references public.geo_entities(id) on delete restrict,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  timezone text,
  metadata jsonb not null default '{}'::jsonb,
  is_analytics_eligible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, type, canonical_name, parent_geo_id)
);

create index if not exists geo_entities_parent_idx on public.geo_entities(parent_geo_id);
create index if not exists geo_entities_country_type_idx on public.geo_entities(country_code, type);

create table if not exists public.business_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'business',
  industry text,
  country text check (country is null or char_length(country) = 2),
  status text not null default 'active' check (status in ('pending', 'active', 'suspended', 'closed')),
  plan text not null default 'basic' check (plan in ('basic', 'pro', 'market_intelligence', 'enterprise')),
  bi_v2_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_members (
  business_id uuid not null references public.business_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'admin', 'analyst', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table if not exists public.business_locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_accounts(id) on delete cascade,
  place_id text not null,
  geo_id uuid references public.geo_entities(id) on delete set null,
  name text not null,
  status text not null default 'active' check (status in ('pending', 'active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, place_id)
);

create index if not exists business_locations_business_idx on public.business_locations(business_id, status);
create index if not exists business_locations_place_idx on public.business_locations(place_id);

create table if not exists public.business_claims (
  id uuid primary key default gen_random_uuid(),
  place_id text not null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.business_accounts(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'verifying', 'approved', 'rejected', 'withdrawn')),
  verification_method text,
  evidence jsonb not null default '{}'::jsonb,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_plan_features (
  plan text not null,
  entitlement text not null,
  primary key (plan, entitlement)
);

insert into public.business_plan_features(plan, entitlement) values
  ('basic', 'VIEW_OWN_ANALYTICS'),
  ('pro', 'VIEW_OWN_ANALYTICS'),
  ('pro', 'VIEW_HISTORICAL_DATA'),
  ('pro', 'VIEW_COMPETITIVE_BENCHMARKS'),
  ('pro', 'VIEW_AUDIENCE'),
  ('pro', 'VIEW_ATTRIBUTION'),
  ('market_intelligence', 'VIEW_OWN_ANALYTICS'),
  ('market_intelligence', 'VIEW_MARKET_ANALYTICS'),
  ('market_intelligence', 'VIEW_SEARCH_INTELLIGENCE'),
  ('market_intelligence', 'VIEW_OPPORTUNITIES'),
  ('enterprise', 'VIEW_OWN_ANALYTICS'),
  ('enterprise', 'VIEW_HISTORICAL_DATA'),
  ('enterprise', 'VIEW_COMPETITIVE_BENCHMARKS'),
  ('enterprise', 'VIEW_AUDIENCE'),
  ('enterprise', 'VIEW_ATTRIBUTION'),
  ('enterprise', 'VIEW_MARKET_ANALYTICS'),
  ('enterprise', 'VIEW_SEARCH_INTELLIGENCE'),
  ('enterprise', 'VIEW_OPPORTUNITIES'),
  ('enterprise', 'EXPORT_REPORTS'),
  ('enterprise', 'USE_PARTNER_API')
on conflict do nothing;

create table if not exists public.business_entitlements (
  business_id uuid not null references public.business_accounts(id) on delete cascade,
  entitlement text not null,
  enabled boolean not null default true,
  source text not null default 'plan' check (source in ('plan', 'purchase', 'contract', 'admin')),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (business_id, entitlement)
);

create table if not exists public.business_saved_views (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Explicit geographic grants keep paid Market Intelligence scoped. A feature
-- entitlement enables the capability; these rows define which markets it may
-- read. A business location's own geo_id is also treated as an allowed market.
create table if not exists public.business_market_access (
  business_id uuid not null references public.business_accounts(id) on delete cascade,
  geo_id uuid not null references public.geo_entities(id) on delete cascade,
  access_type text not null default 'purchased' check (access_type in ('included', 'purchased', 'contract', 'enterprise')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (business_id, geo_id)
);

create index if not exists business_market_access_geo_idx
  on public.business_market_access(geo_id, business_id);

-- Internal, privacy-safe signals are persisted separately from delivery so a
-- future digest/push system can consume them without changing the Analytics Core.
create table if not exists public.business_intelligence_signals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.business_accounts(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete cascade,
  geo_id uuid references public.geo_entities(id) on delete cascade,
  signal_type text not null check (signal_type in (
    'demand_spike',
    'demand_drop',
    'ranking_change',
    'search_growth',
    'opportunity_detected',
    'traffic_anomaly'
  )),
  status text not null default 'new' check (status in ('new', 'acknowledged', 'dismissed', 'expired')),
  detected_at timestamptz not null default now(),
  period_start timestamptz not null,
  period_end timestamptz not null,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  sample_size integer not null default 0 check (sample_size >= 0),
  evidence jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  check (business_id is not null or geo_id is not null),
  check (period_end > period_start)
);

create index if not exists business_intelligence_signals_account_idx
  on public.business_intelligence_signals(business_id, detected_at desc);
create index if not exists business_intelligence_signals_geo_idx
  on public.business_intelligence_signals(geo_id, detected_at desc);

create or replace function public.sync_business_plan_entitlements(target_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  account_plan text;
begin
  select plan into account_plan from public.business_accounts where id = target_business_id;
  if account_plan is null then return; end if;

  delete from public.business_entitlements
  where business_id = target_business_id and source = 'plan';

  insert into public.business_entitlements(business_id, entitlement, enabled, source)
  select target_business_id, feature.entitlement, true, 'plan'
  from public.business_plan_features feature
  where feature.plan = account_plan
  on conflict (business_id, entitlement) do update
    set enabled = excluded.enabled, source = excluded.source, updated_at = now();
end;
$$;

revoke all on function public.sync_business_plan_entitlements(uuid) from public, anon, authenticated;
grant execute on function public.sync_business_plan_entitlements(uuid) to service_role;

create or replace function public.business_account_plan_entitlements_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_business_plan_entitlements(new.id);
  return new;
end;
$$;

revoke all on function public.business_account_plan_entitlements_trigger() from public, anon, authenticated;

drop trigger if exists business_account_plan_entitlements on public.business_accounts;
create trigger business_account_plan_entitlements
after insert or update of plan on public.business_accounts
for each row execute function public.business_account_plan_entitlements_trigger();

-- Backfill plan entitlements for accounts created before this migration.
do $$
declare account_row record;
begin
  for account_row in select id from public.business_accounts loop
    perform public.sync_business_plan_entitlements(account_row.id);
  end loop;
end $$;

create or replace function public.is_business_member(target_business_id uuid, allowed_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members member
    where member.business_id = target_business_id
      and member.user_id = auth.uid()
      and (allowed_roles is null or member.role = any(allowed_roles))
  );
$$;

revoke all on function public.is_business_member(uuid, text[]) from public, anon;
grant execute on function public.is_business_member(uuid, text[]) to authenticated;

alter table if exists public.analytics_events
  add column if not exists source_type text;
alter table if exists public.analytics_events
  add column if not exists source_id text;
alter table if exists public.analytics_events
  add column if not exists geo_id uuid references public.geo_entities(id) on delete set null;
alter table if exists public.analytics_events
  add column if not exists analytics_eligible boolean not null default true;
alter table if exists public.analytics_events
  add column if not exists analytics_exclusion_reason text;

create index if not exists analytics_events_geo_received_idx
  on public.analytics_events(geo_id, received_at desc) where analytics_eligible;
create index if not exists analytics_events_entity_received_eligible_idx
  on public.analytics_events(entity_type, entity_id, received_at desc) where analytics_eligible;
create index if not exists analytics_events_source_attribution_idx
  on public.analytics_events(source_type, source_id, received_at desc) where analytics_eligible;

-- Raw analytics_events remains immutable source-of-truth. Eligibility and
-- canonical naming are layered through views; historical rows are never rewritten.
create or replace view public.analytics_raw_events
with (security_invoker = true)
as
select * from public.analytics_events;

create or replace view public.analytics_valid_events
with (security_invoker = true)
as
select *
from public.analytics_events
where analytics_eligible = true
  and coalesce(source, '') <> 'admin'
  and coalesce(properties->>'is_test', 'false') <> 'true'
  and coalesce(context->>'is_test', 'false') <> 'true'
  and coalesce(context->>'qa_session', 'false') <> 'true'
  and lower(coalesce(context->>'environment', 'production')) not in ('test', 'testing', 'qa', 'development')
  and lower(coalesce(context->>'traffic_type', 'human')) not in ('bot', 'crawler', 'automated')
  and coalesce(context->>'user_agent', '') !~* '(bot|crawler|spider|headless|lighthouse)';

create table if not exists public.analytics_event_name_mappings (
  original_event_name text primary key,
  canonical_event_name text not null,
  canonical_version integer not null default 1,
  status text not null default 'active' check (status in ('active', 'deprecated', 'ignored')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.analytics_event_name_mappings(original_event_name, canonical_event_name, canonical_version, notes) values
  ('legacy_place_open', 'place_view', 1, 'Legacy place detail open.'),
  ('place_open', 'place_view', 1, 'Legacy place detail open.'),
  ('route_open', 'route_view', 1, 'Legacy route detail open.'),
  ('search_submitted', 'search_performed', 1, 'Legacy search submission.'),
  ('search_result_click', 'search_result_clicked', 1, 'Legacy search result selection.'),
  ('place_open_map', 'place_map_open', 1, 'Legacy map-open naming.'),
  ('route_step_view', 'route_stop_view', 1, 'Legacy route-stop naming.')
on conflict (original_event_name) do update set
  canonical_event_name = excluded.canonical_event_name,
  canonical_version = excluded.canonical_version,
  notes = excluded.notes,
  updated_at = now();

create or replace view public.analytics_normalized_events
with (security_invoker = true)
as
select
  e.event_id,
  coalesce(m.canonical_event_name, e.event_name) as event_name,
  e.event_name as original_event_name,
  coalesce(m.canonical_version, e.event_version, 1) as event_version,
  e.entity_type,
  e.entity_id,
  e.user_id,
  e.anonymous_id,
  e.session_id,
  e.source,
  e.platform,
  e.locale,
  e.timezone,
  e.country,
  e.region,
  e.city,
  e.received_at,
  e.occurred_at,
  e.properties,
  e.context,
  e.source_type,
  e.source_id,
  e.geo_id
from public.analytics_valid_events e
left join public.analytics_event_name_mappings m
  on m.original_event_name = e.event_name and m.status = 'active';

revoke all on public.analytics_raw_events, public.analytics_valid_events, public.analytics_normalized_events
  from public, anon, authenticated;
grant select on public.analytics_raw_events, public.analytics_valid_events, public.analytics_normalized_events
  to service_role;

create table if not exists public.business_metric_definitions (
  metric_key text not null,
  version text not null,
  label text not null,
  description text not null,
  formula text not null,
  format text not null default 'number',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  primary key (metric_key, version)
);

insert into public.business_metric_definitions(metric_key, version, label, description, formula, format) values
  ('active_travelers', 'v1', 'Active travelers', 'Distinct privacy-safe actors producing an eligible event.', 'count_distinct(coalesce(user_id, anonymous_id))', 'number'),
  ('place_views', 'v1', 'Place views', 'Eligible place_view events after event-id deduplication.', 'count(place_view)', 'number'),
  ('commercial_actions', 'v1', 'Commercial actions', 'Directions, calls, website clicks, and map opens.', 'directions + calls + website_clicks + map_opens', 'number'),
  ('route_completion_rate', 'v1', 'Route completion rate', 'Share of route starts reaching route_complete.', 'route_completions / route_starts', 'rate'),
  ('demand_index', 'v1', 'Explore Demand Index', 'Equal-weight normalized period-over-period demand signals.', 'mean(clamp(50 + 25 * log2((current + 1) / (previous + 1)), 0, 100))', 'index'),
  ('opportunity_score', 'v1', 'Explore Opportunity Score', 'Equal-weight category cohort percentiles for demand, growth, intent, conversion, and inverse supply.', 'mean(cohort_percentile(signals))', 'index'),
  ('business_score', 'v1', 'Explore Business Score', 'Equal-weight business cohort percentiles for discovery, engagement, intent, growth, and reputation.', 'mean(cohort_percentile(components))', 'index')
on conflict (metric_key, version) do update set
  label = excluded.label,
  description = excluded.description,
  formula = excluded.formula,
  format = excluded.format;

create table if not exists public.analytics_event_taxonomy (
  event_name text not null,
  version integer not null default 1,
  stage text not null check (stage in ('discovery', 'engagement', 'navigation', 'commercial', 'system')),
  owner text not null default 'Explore Data',
  description text not null,
  entity_type text,
  required_properties text[] not null default '{}',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  primary key (event_name, version)
);

insert into public.analytics_event_taxonomy(event_name, version, stage, description, entity_type, required_properties) values
  ('place_impression', 1, 'discovery', 'Place appeared in a discovery surface.', 'place', array['entity_id']),
  ('route_impression', 1, 'discovery', 'Route appeared in a discovery surface.', 'route', array['entity_id']),
  ('search_performed', 1, 'discovery', 'Traveler submitted a search.', 'search', array['query_hash', 'results_count']),
  ('place_view', 1, 'engagement', 'Traveler opened a place detail.', 'place', array['entity_id']),
  ('route_view', 1, 'engagement', 'Traveler opened a route detail.', 'route', array['entity_id']),
  ('place_save', 1, 'engagement', 'Traveler saved a place.', 'place', array['entity_id']),
  ('route_save', 1, 'engagement', 'Traveler saved a route.', 'route', array['entity_id']),
  ('route_start', 1, 'navigation', 'Traveler started a route.', 'route', array['entity_id']),
  ('route_stop_view', 1, 'navigation', 'Traveler reached or opened a route stop.', 'route', array['entity_id', 'stop_id', 'stop_index']),
  ('route_complete', 1, 'navigation', 'Traveler completed a route.', 'route', array['entity_id']),
  ('place_get_directions', 1, 'commercial', 'Traveler requested place directions.', 'place', array['entity_id']),
  ('place_call', 1, 'commercial', 'Traveler initiated a place call.', 'place', array['entity_id']),
  ('place_website_click', 1, 'commercial', 'Traveler opened the place website.', 'place', array['entity_id']),
  ('place_map_open', 1, 'commercial', 'Traveler opened the place on a map.', 'place', array['entity_id'])
on conflict (event_name, version) do update set
  stage = excluded.stage,
  description = excluded.description,
  entity_type = excluded.entity_type,
  required_properties = excluded.required_properties;

-- Slowly changing analytical dimensions preserve display names used by historical facts.
create table if not exists public.dim_geo (
  geo_id uuid primary key references public.geo_entities(id) on delete restrict,
  name text not null,
  canonical_name text not null,
  type text not null,
  country_code text not null,
  parent_geo_id uuid,
  timezone text,
  valid_from timestamptz not null default now(),
  valid_to timestamptz
);

create table if not exists public.dim_places (
  place_id text primary key,
  place_name text not null,
  category_id text,
  geo_id uuid references public.geo_entities(id) on delete set null,
  is_analytics_eligible boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_to timestamptz
);

create table if not exists public.dim_routes (
  route_id text primary key,
  route_name text not null,
  category_id text,
  geo_id uuid references public.geo_entities(id) on delete set null,
  is_analytics_eligible boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_to timestamptz
);

create table if not exists public.dim_categories (
  category_id text primary key,
  name text not null,
  parent_category_id text references public.dim_categories(category_id),
  is_analytics_eligible boolean not null default true
);

create table if not exists public.dim_businesses (
  business_id uuid primary key references public.business_accounts(id) on delete cascade,
  name text not null,
  industry text,
  plan text,
  valid_from timestamptz not null default now(),
  valid_to timestamptz
);

create table if not exists public.dim_content (
  content_id text primary key,
  content_type text not null,
  title text,
  creator_id text,
  is_analytics_eligible boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_to timestamptz
);

create table if not exists public.dim_sources (
  source_key text primary key,
  label text not null,
  source_group text not null
);

insert into public.dim_sources(source_key, label, source_group) values
  ('search', 'Search', 'discovery'), ('map', 'Map', 'discovery'), ('feed', 'Explore Feed', 'discovery'),
  ('video', 'Video', 'content'), ('route', 'Route', 'content'), ('recommendation', 'Recommendation', 'discovery'),
  ('profile', 'Profile', 'discovery'), ('direct_link', 'Direct link', 'direct'), ('other', 'Other', 'other')
on conflict (source_key) do nothing;

create table if not exists public.dim_date (
  day date primary key,
  year smallint not null,
  quarter smallint not null,
  month smallint not null,
  week smallint not null,
  day_of_week smallint not null,
  is_weekend boolean not null
);

create table if not exists public.fact_place_daily (
  day date not null,
  place_id text not null,
  geo_id uuid,
  impressions int not null default 0,
  views int not null default 0,
  unique_visitors int not null default 0,
  saves int not null default 0,
  shares int not null default 0,
  directions int not null default 0,
  calls int not null default 0,
  website_clicks int not null default 0,
  map_opens int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, place_id)
);

create table if not exists public.fact_route_daily (
  day date not null,
  route_id text not null,
  geo_id uuid,
  impressions int not null default 0,
  views int not null default 0,
  unique_visitors int not null default 0,
  saves int not null default 0,
  starts int not null default 0,
  stop_views int not null default 0,
  completes int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, route_id)
);

create table if not exists public.fact_market_daily (
  day date not null,
  geo_id uuid not null,
  active_travelers int not null default 0,
  sessions int not null default 0,
  searches int not null default 0,
  place_views int not null default 0,
  route_views int not null default 0,
  saves int not null default 0,
  commercial_actions int not null default 0,
  supply_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, geo_id)
);

create table if not exists public.fact_search_daily (
  id bigint generated always as identity primary key,
  day date not null,
  geo_id uuid,
  query_hash text not null,
  display_query text,
  searches int not null default 0,
  result_clicks int not null default 0,
  no_results int not null default 0,
  results_available numeric,
  place_conversions int not null default 0,
  intent_conversions int not null default 0,
  updated_at timestamptz not null default now()
);

create unique index if not exists fact_search_daily_day_geo_query_uidx
  on public.fact_search_daily(day, geo_id, query_hash) nulls not distinct;

create table if not exists public.fact_content_attribution (
  day date not null,
  content_id text not null,
  target_type text not null,
  target_id text not null,
  attribution_model text not null default 'explicit_source',
  views int not null default 0,
  saves int not null default 0,
  commercial_actions int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, content_id, target_type, target_id, attribution_model)
);

create table if not exists public.fact_business_daily (
  day date not null,
  business_id uuid not null references public.business_accounts(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete cascade,
  discovery int not null default 0,
  engagement int not null default 0,
  commercial_actions int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, business_id, location_id)
);

create table if not exists public.business_aggregation_runs (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  trigger text not null default 'cron' check (trigger in ('cron', 'admin', 'backfill', 'recompute')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  job_started_at timestamptz not null default now(),
  job_finished_at timestamptz,
  events_processed bigint not null default 0,
  records_generated bigint not null default 0,
  error_code text,
  error_message text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  check (period_end >= period_start)
);

create index if not exists business_aggregation_runs_started_idx
  on public.business_aggregation_runs(job_started_at desc);

create index if not exists fact_place_daily_place_day_idx on public.fact_place_daily(place_id, day desc);
create index if not exists fact_route_daily_route_day_idx on public.fact_route_daily(route_id, day desc);
create index if not exists fact_market_daily_geo_day_idx on public.fact_market_daily(geo_id, day desc);
create index if not exists fact_search_daily_geo_day_idx on public.fact_search_daily(geo_id, day desc);
create index if not exists fact_business_daily_business_day_idx on public.fact_business_daily(business_id, day desc);

create or replace function public.aggregate_business_intelligence_for_day(target_day date)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if target_day is null then raise exception 'target_day must not be null'; end if;

  delete from public.fact_place_daily where day = target_day;
  insert into public.fact_place_daily(
    day, place_id, geo_id, impressions, views, unique_visitors, saves, shares,
    directions, calls, website_clicks, map_opens
  )
  select
    target_day,
    entity_id,
    min(geo_id::text)::uuid,
    count(*) filter (where event_name = 'place_impression'),
    count(*) filter (where event_name in ('place_view', 'content_view')),
    count(distinct coalesce(user_id::text, nullif(anonymous_id, ''))) filter (where event_name in ('place_view', 'content_view')),
    count(*) filter (where event_name = 'place_save'),
    count(*) filter (where event_name in ('place_share', 'share')),
    count(*) filter (where event_name = 'place_get_directions'),
    count(*) filter (where event_name = 'place_call'),
    count(*) filter (where event_name = 'place_website_click'),
    count(*) filter (where event_name in ('place_map_open', 'place_open_map'))
  from public.analytics_normalized_events
  where (occurred_at at time zone coalesce(nullif(timezone, ''), 'UTC'))::date = target_day
    and entity_type = 'place' and nullif(entity_id, '') is not null
  group by entity_id;

  delete from public.fact_route_daily where day = target_day;
  insert into public.fact_route_daily(
    day, route_id, geo_id, impressions, views, unique_visitors, saves, starts, stop_views, completes
  )
  select
    target_day,
    entity_id,
    min(geo_id::text)::uuid,
    count(*) filter (where event_name = 'route_impression'),
    count(*) filter (where event_name in ('route_view', 'content_view')),
    count(distinct coalesce(user_id::text, nullif(anonymous_id, ''))) filter (where event_name in ('route_view', 'content_view')),
    count(*) filter (where event_name = 'route_save'),
    count(*) filter (where event_name = 'route_start'),
    count(*) filter (where event_name in ('route_stop_view', 'route_step_view')),
    count(*) filter (where event_name = 'route_complete')
  from public.analytics_normalized_events
  where (occurred_at at time zone coalesce(nullif(timezone, ''), 'UTC'))::date = target_day
    and entity_type = 'route' and nullif(entity_id, '') is not null
  group by entity_id;

  delete from public.fact_market_daily where day = target_day;
  insert into public.fact_market_daily(
    day, geo_id, active_travelers, sessions, searches, place_views, route_views, saves, commercial_actions, supply_count
  )
  select
    target_day,
    geo_id,
    count(distinct coalesce(user_id::text, nullif(anonymous_id, ''))),
    count(distinct session_id),
    count(*) filter (where event_name in ('search_performed', 'search_submitted')),
    count(*) filter (where event_name = 'place_view'),
    count(*) filter (where event_name = 'route_view'),
    count(*) filter (where event_name in ('place_save', 'route_save', 'video_save')),
    count(*) filter (where event_name in ('place_get_directions', 'place_call', 'place_website_click', 'place_map_open', 'place_open_map')),
    count(distinct concat_ws(':', entity_type, entity_id)) filter (where entity_type in ('place', 'route'))
  from public.analytics_normalized_events
  where (occurred_at at time zone coalesce(nullif(timezone, ''), 'UTC'))::date = target_day and geo_id is not null
  group by geo_id;

  delete from public.fact_search_daily where day = target_day;
  insert into public.fact_search_daily(day, geo_id, query_hash, display_query, searches, result_clicks, no_results, results_available)
  select
    target_day,
    (array_agg(geo_id) filter (where geo_id is not null))[1],
    lower(coalesce(nullif(properties->>'query_hash', ''), encode(digest(lower(properties->>'query_normalized'), 'sha256'), 'hex'))),
    case when count(*) >= 5 then max(nullif(properties->>'query_normalized', '')) else null end,
    count(*) filter (where event_name in ('search_performed', 'search_submitted')),
    count(*) filter (where event_name = 'search_result_clicked'),
    count(*) filter (where event_name = 'search_no_results'),
    avg(
      case
        when coalesce(properties->>'results_count', properties->>'result_count', '') ~ '^[0-9]+(\.[0-9]+)?$'
          then coalesce(properties->>'results_count', properties->>'result_count')::numeric
        else null
      end
    )
  from public.analytics_normalized_events
  where (occurred_at at time zone coalesce(nullif(timezone, ''), 'UTC'))::date = target_day
    and event_name in ('search_performed', 'search_submitted', 'search_result_clicked', 'search_no_results')
    and coalesce(nullif(properties->>'query_hash', ''), nullif(properties->>'query_normalized', '')) is not null
  group by geo_id, lower(coalesce(nullif(properties->>'query_hash', ''), encode(digest(lower(properties->>'query_normalized'), 'sha256'), 'hex')));

  delete from public.fact_content_attribution where day = target_day;
  insert into public.fact_content_attribution(day, content_id, target_type, target_id, attribution_model, views, saves, commercial_actions)
  select
    target_day,
    source_id,
    entity_type,
    entity_id,
    'explicit_source',
    count(*) filter (where event_name in ('place_view', 'route_view', 'content_view')),
    count(*) filter (where event_name in ('place_save', 'route_save')),
    count(*) filter (where event_name in ('place_get_directions', 'place_call', 'place_website_click', 'place_map_open', 'place_open_map'))
  from public.analytics_normalized_events
  where (occurred_at at time zone coalesce(nullif(timezone, ''), 'UTC'))::date = target_day
    and source_type in ('video', 'post', 'route', 'creator', 'content')
    and nullif(source_id, '') is not null and nullif(entity_id, '') is not null
  group by source_id, entity_type, entity_id;

  delete from public.fact_business_daily where day = target_day;
  insert into public.fact_business_daily(day, business_id, location_id, discovery, engagement, commercial_actions)
  select
    target_day,
    location.business_id,
    location.id,
    place.impressions + place.views,
    place.saves + place.shares,
    place.directions + place.calls + place.website_clicks + place.map_opens
  from public.business_locations location
  join public.fact_place_daily place on place.place_id = location.place_id and place.day = target_day
  where location.status = 'active';
end;
$$;

alter function public.aggregate_business_intelligence_for_day(date) owner to postgres;
revoke all on function public.aggregate_business_intelligence_for_day(date) from public, anon, authenticated;
grant execute on function public.aggregate_business_intelligence_for_day(date) to service_role;

alter table public.geo_entities enable row level security;
alter table public.business_accounts enable row level security;
alter table public.business_members enable row level security;
alter table public.business_locations enable row level security;
alter table public.business_claims enable row level security;
alter table public.business_entitlements enable row level security;
alter table public.business_saved_views enable row level security;
alter table public.business_market_access enable row level security;
alter table public.business_intelligence_signals enable row level security;
alter table public.business_plan_features enable row level security;
alter table public.analytics_event_name_mappings enable row level security;
alter table public.business_metric_definitions enable row level security;
alter table public.analytics_event_taxonomy enable row level security;
alter table public.dim_geo enable row level security;
alter table public.dim_places enable row level security;
alter table public.dim_routes enable row level security;
alter table public.dim_categories enable row level security;
alter table public.dim_businesses enable row level security;
alter table public.dim_content enable row level security;
alter table public.dim_sources enable row level security;
alter table public.dim_date enable row level security;
alter table public.fact_place_daily enable row level security;
alter table public.fact_route_daily enable row level security;
alter table public.fact_market_daily enable row level security;
alter table public.fact_search_daily enable row level security;
alter table public.fact_content_attribution enable row level security;
alter table public.fact_business_daily enable row level security;
alter table public.business_aggregation_runs enable row level security;

drop policy if exists "business members read accounts" on public.business_accounts;
create policy "business members read accounts" on public.business_accounts for select to authenticated
using (public.is_business_member(id));

drop policy if exists "members read own memberships" on public.business_members;
create policy "members read own memberships" on public.business_members for select to authenticated
using (user_id = auth.uid());

drop policy if exists "business members read locations" on public.business_locations;
create policy "business members read locations" on public.business_locations for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "business members read entitlements" on public.business_entitlements;
create policy "business members read entitlements" on public.business_entitlements for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "users manage own saved views" on public.business_saved_views;
create policy "users manage own saved views" on public.business_saved_views for all to authenticated
using (user_id = auth.uid() and public.is_business_member(business_id))
with check (user_id = auth.uid() and public.is_business_member(business_id));

drop policy if exists "business members read market access" on public.business_market_access;
create policy "business members read market access" on public.business_market_access for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "business members read intelligence signals" on public.business_intelligence_signals;
create policy "business members read intelligence signals" on public.business_intelligence_signals for select to authenticated
using (business_id is not null and public.is_business_member(business_id));

drop policy if exists "users read own claims" on public.business_claims;
create policy "users read own claims" on public.business_claims for select to authenticated
using (requested_by = auth.uid());

drop policy if exists "users create own claims" on public.business_claims;
create policy "users create own claims" on public.business_claims for insert to authenticated
with check (requested_by = auth.uid());

-- Geo rows are public reference data; analytics facts remain server/API only.
drop policy if exists "authenticated read eligible geo" on public.geo_entities;
create policy "authenticated read eligible geo" on public.geo_entities for select to authenticated
using (is_analytics_eligible = true);

-- Explicit table grants make the RLS boundary auditable instead of relying on
-- project-wide default privileges. Analytical facts remain server-only.
revoke all on table
  public.geo_entities, public.business_accounts, public.business_members,
  public.business_locations, public.business_claims, public.business_plan_features,
  public.business_entitlements, public.business_saved_views, public.business_market_access,
  public.business_intelligence_signals, public.analytics_event_name_mappings,
  public.business_metric_definitions, public.analytics_event_taxonomy,
  public.dim_geo, public.dim_places, public.dim_routes, public.dim_categories,
  public.dim_businesses, public.dim_content, public.dim_sources, public.dim_date,
  public.fact_place_daily, public.fact_route_daily, public.fact_market_daily,
  public.fact_search_daily, public.fact_content_attribution, public.fact_business_daily,
  public.business_aggregation_runs
from public, anon, authenticated;

grant select on table
  public.geo_entities, public.business_accounts, public.business_members,
  public.business_locations, public.business_entitlements, public.business_market_access,
  public.business_intelligence_signals
to authenticated;
grant select, insert, update, delete on table public.business_saved_views to authenticated;
grant select, insert on table public.business_claims to authenticated;

grant select, insert, update, delete on table
  public.geo_entities, public.business_accounts, public.business_members,
  public.business_locations, public.business_claims, public.business_plan_features,
  public.business_entitlements, public.business_saved_views, public.business_market_access,
  public.business_intelligence_signals, public.analytics_event_name_mappings,
  public.business_metric_definitions, public.analytics_event_taxonomy,
  public.dim_geo, public.dim_places, public.dim_routes, public.dim_categories,
  public.dim_businesses, public.dim_content, public.dim_sources, public.dim_date,
  public.fact_place_daily, public.fact_route_daily, public.fact_market_daily,
  public.fact_search_daily, public.fact_content_attribution, public.fact_business_daily,
  public.business_aggregation_runs
to service_role;
grant usage, select on sequence public.fact_search_daily_id_seq to service_role;
