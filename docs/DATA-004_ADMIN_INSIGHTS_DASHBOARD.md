# DATA-004: Admin Insights Dashboard

Admin analytics dashboard for events collected by DATA-001 (schema), DATA-002 (`POST /api/events`), and DATA-003 (mobile instrumentation).

## Overview

- **UI route:** `/admin/analytics`
- **Auth:** Supabase admin session via `AdminAuthGate` + `requireAdmin` on every backend route
- **Data access:** Admin-only HTTP APIs under `/api/admin/analytics/*` using server-side Supabase service role
- **Vercel constraint:** Single function entrypoint `api/index.js` only; shared logic lives in `server/api-lib/`

## UI sections

1. Header with range selector (`24h`, `7d`, `30d`) and refresh
2. Overview metric cards
3. Timeseries (events by day)
4. Breakdowns (event name, source, platform)
5. Top content (videos, places, routes, profiles)
6. Search insights (hashed queries only)
7. Event explorer with filters + pagination
8. Ingestion health + aggregation actions
9. Dead letters table (payload collapsed by default)

## Backend endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/admin/analytics/overview` | Core cards + breakdowns |
| `GET` | `/api/admin/analytics/timeseries` | Daily events/sessions/users |
| `GET` | `/api/admin/analytics/top-content` | Top entities by type |
| `GET` | `/api/admin/analytics/search` | Search funnel (no raw query text) |
| `GET` | `/api/admin/analytics/events` | Paginated event explorer |
| `GET` | `/api/admin/analytics/events/:eventId` | Sanitized event detail |
| `GET` | `/api/admin/analytics/health` | Ingestion health + diagnostics |
| `GET` | `/api/admin/analytics/dead-letters` | Paginated dead letters |
| `POST` | `/api/admin/analytics/aggregate` | Run `aggregate_analytics_events_for_day(day)` |

Query param `range`: `24h` | `7d` | `30d` (default `7d`).

Pagination: `limit` (max 50), `offset` on events and dead letters.

## Data sources

Primary tables:

- `analytics_events`
- `analytics_event_dead_letters`

Optional daily views (preferred when present, but never required):

- `admin_analytics_overview_daily`
- `admin_top_content_daily`
- `admin_search_insights_daily`
- `analytics_session_daily`
- `analytics_user_daily`

RPC:

- `aggregate_analytics_events_for_day(target_day date)`

## Privacy rules

- No service role key in client bundle
- No raw Authorization tokens or cookies in API responses
- No raw search query text (only `query_hash`, length buckets, counts)
- No exact GPS coordinates
- Event explorer shortens `anonymous_id` and `session_id`
- `user_id` shown as present yes/no in tables
- Dead-letter payload shown as sanitized summary by default
- Event detail drawer sanitizes `properties` and `context`

## Aggregation trigger

`POST /api/admin/analytics/aggregate` body:

```json
{ "day": "2026-07-03" }
```

UI buttons:

- Run today aggregation
- Run yesterday aggregation

If RPC is unavailable, API returns a safe error with `request_id`.
If the RPC returns `null` / `void` without an error, the API still returns success:

```json
{
  "ok": true,
  "day": "2026-07-03",
  "message": "Aggregation completed"
}
```

## Manual QA checklist

1. Login as admin.
2. Open `/admin/analytics`.
3. Confirm overview loads.
4. Change range `24h` / `7d` / `30d`.
5. Refresh data.
6. Confirm event breakdowns.
7. Confirm top content sections.
8. Confirm search insights show no raw query text.
9. Open event explorer.
10. Filter by `event_name`.
11. Filter by source `mobile`.
12. Filter by platform `ios` / `android` / `web`.
13. Confirm pagination works.
14. Confirm dead-letter table loads.
15. Confirm payload is hidden/collapsed.
16. Confirm ingestion health status.
17. Run aggregation for today if RPC exists.
18. Confirm no service keys/tokens/PII in browser network responses.
19. Confirm unauthenticated request to admin analytics endpoint fails (`401`).
20. Confirm `npm run build` succeeds.

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
select *
from public.admin_analytics_overview_daily
order by day desc
limit 10;
```

```sql
select *
from public.admin_top_content_daily
order by day desc
limit 20;
```

```sql
select *
from public.admin_search_insights_daily
order by day desc
limit 20;
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
select
  count(*) as dead_letters_last_24h
from public.analytics_event_dead_letters
where created_at >= now() - interval '24 hours';
```

```sql
select public.aggregate_analytics_events_for_day(current_date);
```

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Overview empty, warnings mention schema | Apply DATA-001 migrations in Supabase |
| `503` on aggregate | RPC `aggregate_analytics_events_for_day` not installed |
| `401` on all endpoints | Admin session missing or expired |
| `403` | User not in `admin_users` or allowlist |
| Timeseries sparse | Low event volume or daily views not populated yet |
| Vercel deploy fails on function limit | Ensure no new files under `/api` except `api/index.js` |

### Overview / Timeseries / Health failures

- These sections now **prefer** daily views such as `admin_analytics_overview_daily`, `admin_top_content_daily`, `admin_search_insights_daily`, and `admin_metrics_daily`.
- If a view is missing, empty, has unexpected columns, or errors, the backend returns `200` with warnings and falls back to `analytics_events`.
- Raw fallback computes:
  - total events in range
  - app/source/platform/entity_type breakdowns
  - anonymous/authenticated/session counts
  - day/hour buckets for timeseries

### DATA-001 / DATA-004 schema compatibility

- Some production environments still expose `analytics_event_dead_letters.created_at` instead of `received_at`.
- Health and dead-letter endpoints detect the available timestamp column and use it automatically.
- Dead-letter payload/source fields are treated as optional; missing columns no longer crash the dashboard.

### How to verify fallback behavior

Run:

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

If only `analytics_events` has data, Overview and Timeseries should still render from that result set.

### Reading `request_id` from the UI

- Section error cards append the backend `request_id` when the API returns an error.
- Use that `request_id` to filter Vercel logs:

```bash
npx vercel logs https://www.exploreapphq.com --request-id <request_id> --expand
```

## Client module

`src/lib/adminAnalyticsApi.ts` — typed fetch helpers for all admin analytics endpoints.

## Tests

```bash
npm test
node --check server/api-lib/analytics/analyticsAdminApi.mjs
node --check server/api-lib/router.mjs
```
