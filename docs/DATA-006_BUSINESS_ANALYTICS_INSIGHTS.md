# DATA-006: Business analytics insights layer

## Purpose

Turn operational analytics (DATA-001–DATA-005) into business-readable insights for:

- product decisions
- growth tracking
- content performance
- search quality
- creator/producer performance
- route/place/video engagement
- investor/business reporting
- future recommendations/ranking

## Pipeline

```
analytics_events (source of truth)
  → aggregate_analytics_events_for_day (DATA-005 cron)
  → optional daily tables/views
  → /api/admin/analytics/business/* (DATA-006)
  → /admin/analytics/business UI
```

Operations dashboard remains at `/admin/analytics`.

## Business questions

### Growth
- Active users (anonymous + authenticated estimates)
- Sessions and app opens
- New vs returning estimates

### Content
- Top videos/places/routes/profiles by views/saves/likes/shares/reports
- Engagement score

### Search
- Total searches and no-result rate
- Top `query_hash` values only (never raw query text)

### Engagement
- Funnel: app_open → screen_view → content_view → action → conversion

### Creators
- Performance by `creator_id` when present in properties/context
- Clear warning when missing

### Location/market
- Country/region/city aggregates only
- No precise lat/lng
- City rows require at least 3 events

## Metric dictionary

| Metric | Source |
|--------|--------|
| app_opens | `event_name = app_open` |
| content_views | view/impression-like events + entity_type video/place/route/user |
| likes/saves/shares | corresponding event names |
| searches | `search_submitted` / `search_performed` |
| no_results | `search_no_results` |
| engagement_score | `views + likes*3 + saves*5 + shares*6 + route_starts*4 - reports*10` |

## Endpoints

All admin-only:

| Method | Path |
|--------|------|
| GET | `/api/admin/analytics/business/overview` |
| GET | `/api/admin/analytics/business/growth` |
| GET | `/api/admin/analytics/business/funnel` |
| GET | `/api/admin/analytics/business/content` |
| GET | `/api/admin/analytics/business/search` |
| GET | `/api/admin/analytics/business/creators` |
| GET | `/api/admin/analytics/business/locations` |
| GET | `/api/admin/analytics/business/investor-snapshot` |

Query: `range=24h|7d|30d|90d` (default `7d`). Custom `start`/`end` allowed, max 90 days.

## Privacy rules

- no service role key in browser
- no cron secret in browser
- no raw search query (only `query_hash`)
- no precise lat/lng/coordinates
- no raw properties/context dumps
- creator/entity IDs shortened in UI tables
- empty data returns empty states, not 500

## UI

- Operations: `/admin/analytics`
- Business Insights: `/admin/analytics/business`
- Investor snapshot includes copy-to-clipboard text

## SQL verification

```sql
select event_name, entity_type, count(*) as count
from public.analytics_events
where received_at >= now() - interval '30 days'
group by event_name, entity_type
order by count desc;
```

```sql
select
  date_trunc('day', received_at)::date as day,
  count(*) as events,
  count(distinct session_id) as sessions,
  count(distinct anonymous_id) as anonymous_ids,
  count(distinct user_id) as authenticated_users
from public.analytics_events
where received_at >= now() - interval '30 days'
group by day
order by day;
```

```sql
select entity_type, entity_id, event_name, count(*) as count
from public.analytics_events
where received_at >= now() - interval '30 days'
  and entity_type in ('video', 'place', 'route', 'user')
group by entity_type, entity_id, event_name
order by count desc
limit 100;
```

```sql
select properties->>'query_hash' as query_hash, count(*) as searches
from public.analytics_events
where received_at >= now() - interval '30 days'
  and entity_type = 'search'
group by query_hash
order by searches desc
limit 50;
```

## QA checklist

1. Login as admin.
2. Open `/admin/analytics/business`.
3. Confirm overview cards load.
4. Change range 24h/7d/30d/90d.
5. Confirm growth/funnel/content/search sections render.
6. Confirm search shows hashes only.
7. Confirm creators warning if creator_id missing.
8. Confirm locations hide low-count cities.
9. Copy investor snapshot.
10. Confirm operations page still works.
11. Confirm unauthenticated business endpoints return 401.
12. Confirm no new files under `/api`.

## Rollback

Revert this branch/PR. Operations analytics (DATA-004/005) remain intact.
