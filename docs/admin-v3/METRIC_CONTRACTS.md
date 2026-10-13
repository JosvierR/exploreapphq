# Explore Admin 3.0 — metric contracts

The executable frontend registry is `src/features/admin/analytics/metricRegistry.ts`. Canonical formulas remain server-owned in `server/api-lib/analytics/businessAnalyticsCore.mjs`.

## Executive metrics

| Metric | Exact definition | Source | Comparison | Important limitation |
|---|---|---|---|---|
| Active users | Distinct `user_id` when present, otherwise distinct `anonymous_id`, across valid eligible events | `analytics_normalized_events` through `/api/admin/business/dashboard` | Preceding equivalent UTC window | Cross-device or anonymous-to-authenticated identity linkage is not inferred. This is observed identity activity, not registered accounts. |
| Sessions | Distinct emitted `session_id` values | Same | Preceding equivalent UTC window | This contract does not mix reconstructed inactivity-timeout sessions with emitted sessions. |
| Route starts | Total valid events where `event_name = route_start` | Same | Preceding equivalent UTC window | Event total, not distinct routes or distinct users. |
| Commercial actions | Total directions, call, website, and map-open events in the canonical taxonomy | Same | Preceding equivalent UTC window | Product intent only; never labeled revenue, sales, or completed conversion. |

## State semantics

| State | UI behavior |
|---|---|
| `available` | Complete canonical response; an explicit numeric zero is displayed as `0`. |
| `empty` | Valid query completed with no eligible events in the selected range. |
| `partial` | Normalized view degraded or server event bound reached; value remains visible with a partial badge. |
| `delayed` | Backend reports processing rather than a completed snapshot. |
| `unavailable` | Required instrumentation or contract is not verifiable; rendered as an em dash. |
| `error` | Canonical request failed; rendered as an em dash plus the page error state. |

## Period and timezone behavior

- Presets: Today (`24h`), 7 days, 30 days, and 90 days.
- Custom dates use inclusive `date_from` / `date_to` values and are validated server-side.
- Comparison uses the immediately preceding duration with matching boundaries.
- All reporting windows use UTC boundaries. The browser timezone is displayed for operator clarity; it does not silently change the query boundary.
- A zero previous denominator never produces infinity; the server returns a contextual label such as `New activity`.

## Data flow

```text
mobile/web analytics request
  -> server validation and redaction
  -> analytics_events / analytics_event_dead_letters
  -> analytics_valid_events
  -> analytics_normalized_events
  -> Business Analytics Core
  -> GET /api/admin/business/dashboard
  -> Executive Overview
```

All privileged reads remain server-side. The browser receives aggregated analytics and a normal Supabase user access token only.

## Live seven-day reconciliation

Read-only reconciliation at `2026-10-13T22:38:59.999Z` loaded all 2,209 rows in the selected rolling seven-day window and all 989 rows in the preceding window from `analytics_normalized_events`, then applied `calculateCanonicalKpis` directly.

| Metric | Current | Previous | Delta | Reliability flag |
|---|---:|---:|---:|---|
| Active users | 55 | 38 | +44.7% | Reliable |
| Sessions | 106 | 98 | +8.2% | Reliable |
| Route starts | 10 | 2 | +400% | Low baseline |
| Commercial actions | 1 | 2 | -50% | Low baseline |

The source was current through `2026-10-13T22:28:06.328808Z`. Run `npm run analytics:executive-reconcile` to repeat the same bounded, read-only calculation against the configured project.
