# Analytics ingestion investigation

Read-only audit time: 2026-10-13 22:35 UTC
Command: `npm run analytics:ingestion-audit`
Scope: configured Supabase project; no write, delete, replay, migration, or backfill

## Verified counts

| Window | Accepted | Rejected | Rejection rate |
|---|---:|---:|---:|
| Cumulative | 29,756 | 9,285 | 23.78% |
| Last 24 hours | 398 | 222 | 35.81% |
| Last 7 days | 2,209 | 1,266 | 36.43% |
| Last 30 days | 10,775 | 4,899 | 31.26% |

The earlier dashboard screenshot's `1,244 rejected` was not current and did not state its window. The database value is cumulative from 2026-07-05 12:37 UTC through at least 2026-10-13 22:28 UTC. The operational dashboard therefore uses explicit 24-hour counts/rates from `/api/admin/analytics/health`, not the cumulative total without context.

## Root causes

| Reason | Count | Root cause |
|---|---:|---|
| `entity_type is invalid` | 6,493 | The API validator omitted `session`, although the database constraint already permits it. These rows are exactly `session_end` (3,372), `app_open` (1,828), and `session_start` (1,293) with `entity_type=session`. |
| `event_name is not allowed` | 2,792 | Mobile emits legitimate app lifecycle and route publishing/recording events that were absent from the API allowlist. |

The unsupported-name group is primarily `app_background` (1,560), `app_foreground` (1,110), and 122 route publishing/recording/correction events.

## Implemented forward fix

- Added `session` to the server event entity allowlist.
- Added the observed app lifecycle and route publishing/recording event names to the server allowlist.
- Added matching frontend event labels and regression coverage.
- Did not broaden payload limits, privacy rules, auth, rate limits, or Supabase privileges.

This fixes future ingestion after release. It does not cosmetically suppress the historical dead letters.

## Duplicate and replay assessment

- 586 event IDs occur more than once among dead letters, covering 1,320 rejected rows.
- Accepted events have a unique `analytics_events.event_id` constraint and the ingest service checks existing IDs.
- Historical replay was **not performed**. A replay tool must normalize the corrected contract, deduplicate rejected rows by event ID, prove accepted-table idempotency, and record the result. Until that tool is reviewed, replay is not production-safe.

## Other categories checked

- Timestamp parsing: no timestamp-specific rejection category was present in the audited rows.
- Authentication/authorization: invalid bearer tokens fail before event validation, so the dead-letter table cannot quantify auth failures; API/edge logs are required.
- Schema/validation mismatch: confirmed as the primary cause and fixed forward in the application validator.
- Unsupported names: confirmed and fixed for every event name observed in this audit.
- Impact: rejected lifecycle events understate app-open/session activity; rejected route publishing events affect feature instrumentation, but not the canonical `route_start` KPI directly.
