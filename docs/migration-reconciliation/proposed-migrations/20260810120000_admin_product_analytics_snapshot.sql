-- Product analytics snapshot for admin console (DAU/WAU, impressions, CTR, route starts).
-- Prefer this RPC over sampled event rows so KPIs stay accurate as volume grows.

create or replace function public.admin_product_analytics_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path to public, extensions
as $function$
declare
  day_start timestamptz := date_trunc('day', timezone('utc', now()));
  week_start timestamptz := timezone('utc', now()) - interval '7 days';
  result jsonb;
begin
  if to_regclass('public.analytics_events') is null then
    return jsonb_build_object(
      'foundation_status', 'schema_missing',
      'dau', null,
      'wau', null,
      'impressions_7d', null,
      'clicks_7d', null,
      'content_ctr_7d', null,
      'route_starts_7d', null,
      'events_7d', null,
      'events_today', null,
      'latest_received_at', null,
      'source', 'rpc'
    );
  end if;

  with actors_today as (
    select count(distinct coalesce(e.user_id::text, nullif(e.anonymous_id, '')))::int as dau
    from public.analytics_events e
    where e.received_at >= day_start
      and coalesce(e.user_id::text, nullif(e.anonymous_id, '')) is not null
  ),
  actors_week as (
    select count(distinct coalesce(e.user_id::text, nullif(e.anonymous_id, '')))::int as wau
    from public.analytics_events e
    where e.received_at >= week_start
      and coalesce(e.user_id::text, nullif(e.anonymous_id, '')) is not null
  ),
  counts as (
    select
      count(*) filter (
        where e.event_name in ('video_impression', 'place_impression', 'route_impression')
      )::int as impressions_7d,
      count(*) filter (
        where e.event_name in ('place_click', 'route_click', 'video_view_start')
      )::int as clicks_7d,
      count(*) filter (where e.event_name = 'route_start')::int as route_starts_7d,
      count(*)::int as events_7d,
      count(*) filter (where e.received_at >= day_start)::int as events_today,
      max(e.received_at) as latest_received_at
    from public.analytics_events e
    where e.received_at >= week_start
  )
  select jsonb_build_object(
    'foundation_status',
      case
        when coalesce((select events_7d from counts), 0) > 0 then 'ready'
        else 'empty'
      end,
    'dau', (select dau from actors_today),
    'wau', (select wau from actors_week),
    'impressions_7d', (select impressions_7d from counts),
    'clicks_7d', (select clicks_7d from counts),
    'content_ctr_7d',
      case
        when coalesce((select impressions_7d from counts), 0) > 0
          then round(
            ((select clicks_7d from counts)::numeric / (select impressions_7d from counts)::numeric) * 1000
          ) / 1000
        else null
      end,
    'route_starts_7d', (select route_starts_7d from counts),
    'events_7d', (select events_7d from counts),
    'events_today', (select events_today from counts),
    'latest_received_at', (select latest_received_at from counts),
    'source', 'rpc'
  )
  into result;

  return result;
end;
$function$;

alter function public.admin_product_analytics_snapshot() owner to postgres;
alter function public.admin_product_analytics_snapshot() security definer;
revoke all on function public.admin_product_analytics_snapshot() from public, anon, authenticated;
grant execute on function public.admin_product_analytics_snapshot() to service_role;
