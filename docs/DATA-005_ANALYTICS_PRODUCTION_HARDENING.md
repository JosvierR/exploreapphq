# DATA-005: Analytics production hardening

## Overview

Hardens the analytics platform after DATA-001–DATA-004:

- safer aggregation (today / yesterday / last 7 days)
- cron-protected daily aggregation
- richer ingestion health + data quality warnings
- dead-letter monitoring compatible with `created_at`
- safer event explorer pagination/filters
- dashboard ops controls without new Vercel functions

## Pipeline

```
Mobile/Web clients
  → POST /api/events (DATA-002)
  → public.analytics_events
  → public.aggregate_analytics_events_for_day(day)
  → optional daily views / admin_metrics_daily
  → GET /api/admin/analytics/* (DATA-004/005)
  → /admin/analytics UI
```

Optional daily views are preferred but not required. Raw `analytics_events` fallback remains intentional.

## Aggregation strategy

Approved RPC only:

```sql
select public.aggregate_analytics_events_for_day(current_date);
```

Rules:

- max window: 7 days
- `YYYY-MM-DD` only
- future days rejected
- null/void RPC response counts as success when Supabase returns no error

### Manual admin endpoint

`POST /api/admin/analytics/aggregate` (admin session required)

Bodies:

```json
{ "day": "2026-07-03" }
```

```json
{ "preset": "today" }
```

```json
{ "preset": "yesterday" }
```

```json
{ "preset": "last_7_days" }
```

### Cron endpoint

`POST /api/cron/analytics/aggregate`

Protected by:

- `X-Cron-Secret: $ANALYTICS_CRON_SECRET`, or
- `Authorization: Bearer $ANALYTICS_CRON_SECRET` (Vercel Cron style)

Also accepts `CRON_SECRET` as fallback env name.

Default action when body is empty: aggregate **yesterday + today**.

If secret is not configured:

```json
{
  "ok": false,
  "error": "Analytics cron is not configured.",
  "code": "analytics_cron_not_configured"
}
```

## Required env vars

| Variable | Purpose |
|----------|---------|
| `ANALYTICS_CRON_SECRET` | Protects cron aggregation endpoint |
| `CRON_SECRET` | Optional fallback used by Vercel Cron bearer auth |
| `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Server-side inserts/reads |
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | Project URL |

Never put cron/service secrets in `VITE_*` variables.

## Vercel single-function constraint

- Only `api/index.js` is a serverless entrypoint
- Cron path is rewritten to `api/index.js`
- No `/api/lib`
- No new files under `/api`

`vercel.json` includes:

```json
{
  "crons": [
    {
      "path": "/api/cron/analytics/aggregate",
      "schedule": "15 5 * * *"
    }
  ]
}
```

If the Vercel plan rejects cron config, remove the `crons` block and keep the protected endpoint for external schedulers.

## Health status rules

`GET /api/admin/analytics/health`

Healthy:

- `analytics_events` selectable
- dead letters selectable
- dead-letter rate 24h < 5%
- no critical quality warnings

Warning:

- no events in last 24h
- aggregation stale
- dead-letter rate 5–20%
- optional views unavailable but raw fallback works
- no mobile events yet (DATA-003 pending)

Critical:

- `analytics_events` not selectable
- dead-letter rate > 20%
- critical quality warnings

Dead letters use `created_at` when `received_at` is absent.

## Quality warning codes

| Code | Severity |
|------|----------|
| `no_events_last_24h` | warning |
| `no_mobile_events_last_24h` | warning |
| `missing_platform` | warning |
| `missing_session_id` | warning |
| `missing_anonymous_id_for_anonymous_events` | warning |
| `search_events_without_query_hash` | info |
| `high_dead_letter_rate` | warning/critical |
| `aggregation_stale` | warning |
| `optional_views_unavailable` | warning |
| `event_source_distribution_unusual` | info |

## Dead-letter monitoring

`GET /api/admin/analytics/dead-letters`

Returns:

- paginated items (payload collapsed)
- summary last 24h / 7d
- grouped counts by reason/source

## Event explorer safety

`GET /api/admin/analytics/events`

- default limit 50
- max limit 100
- filters: event_name, source, platform, entity_type, has_user_id, event_id, entity_id, range
- no unbounded queries
- no full properties/context in list responses
- detail endpoint returns sanitized properties/context

## Privacy / security

- no service role key in browser
- no cron secret in browser
- no auth tokens/cookies in responses
- no raw search queries
- no exact GPS
- shortened IDs in UI tables
- request_id on errors

## Manual QA checklist

1. Login as admin.
2. Open `/admin/analytics`.
3. Confirm overview loads.
4. Confirm health section loads.
5. Confirm status badge shows healthy/warning/critical.
6. Confirm last event timestamp appears.
7. Confirm events last 5m/1h/24h appear.
8. Confirm dead-letter rate appears.
9. Confirm dead-letter summary works.
10. Run Aggregate today.
11. Run Aggregate yesterday.
12. Run Aggregate last 7 days.
13. Confirm request_id appears on failure.
14. Confirm dashboard does not crash on partial failure.
15. Confirm unauthenticated admin analytics endpoints return Authentication required.
16. Call cron endpoint without secret and confirm 401/503.
17. Call cron endpoint with valid secret in local/staging and confirm success.
18. Confirm no cron secret appears in browser bundle.
19. Confirm no service role key appears in browser bundle.
20. Confirm Vercel still only has `api/index.js` under `/api`.
21. Confirm no `/api/lib` directory exists.
22. Confirm production build succeeds.
23. Confirm Vercel logs do not contain secrets.
24. Confirm no new 500s after loading dashboard.
25. Confirm dashboard works even if daily views are empty.

## SQL verification

```sql
select
  event_name,
  source,
  platform,
  entity_type,
  count(*) as count
from public.analytics_events
where received_at >= now() - interval '7 days'
group by event_name, source, platform, entity_type
order by count desc
limit 50;
```

```sql
select
  reason,
  source,
  count(*) as count
from public.analytics_event_dead_letters
where created_at >= now() - interval '7 days'
group by reason, source
order by count desc;
```

```sql
select public.aggregate_analytics_events_for_day(current_date);
select public.aggregate_analytics_events_for_day(current_date - interval '1 day');
```

```sql
select *
from public.admin_metrics_daily
order by day desc
limit 10;
```

## Troubleshooting aggregation failures

### `DELETE requires a WHERE clause` (code `21000` / `analytics_rpc_unsafe_mutation`)

This means the RPC parameter and service role are fine, but the function body runs a
`DELETE`/`UPDATE` without `WHERE` under `service_role` (blocked by safe-update rules).
SQL Editor still works because it uses a privileged role.

Run in Supabase SQL Editor:

```sql
alter function public.aggregate_analytics_events_for_day(date) security definer;
-- Must include extensions so pgcrypto digest() resolves.
alter function public.aggregate_analytics_events_for_day(date) set search_path = public, extensions;
grant execute on function public.aggregate_analytics_events_for_day(date) to service_role;
```

If you previously set `search_path = public` only, you will see:
`function digest(text, unknown) does not exist` — fix by including `extensions` as above.

Then retry the cron endpoint. No redeploy is required for this SQL fix.

If cron/admin aggregate returns `analytics_aggregation_failed` or `analytics_rpc_not_found`:

1. Confirm the function exists and note argument names:

```sql
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'aggregate_analytics_events_for_day';
```

2. Grant execute to the service role (SQL editor):

```sql
grant execute on function public.aggregate_analytics_events_for_day(date) to service_role;
```

If the argument name is not `date` alone, use the exact signature from step 1.

3. Re-test from SQL:

```sql
select public.aggregate_analytics_events_for_day(current_date);
```

4. Re-test cron:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "https://www.exploreapphq.com/api/cron/analytics/aggregate" `
  -Headers @{ "X-Cron-Secret" = $secret }
```

The API tries parameter names `target_day`, `day`, `p_day`, `p_target_day`, and `d`.
Vercel logs include safe failure codes and redacted Supabase error fields for `request_id`.

## Rollback plan

1. Revert this branch/PR.
2. Keep DATA-004 dashboard endpoints intact.
3. Remove `ANALYTICS_CRON_SECRET` if unused.
4. Remove `crons` from `vercel.json` if needed.
5. Redeploy.

## Implementation map

| Area | Path |
|------|------|
| Operations service | `server/api-lib/analytics/analyticsOperationsService.mjs` |
| Admin/cron handlers | `server/api-lib/analytics/analyticsAdminApi.mjs` |
| Router | `server/api-lib/router.mjs` |
| Client API | `src/lib/adminAnalyticsApi.ts` |
| Dashboard UI | `src/pages/admin/AdminAnalyticsPage.tsx` |
