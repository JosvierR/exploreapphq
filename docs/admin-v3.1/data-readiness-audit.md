# Production Analytics Data Readiness

Command: `npm run analytics:ingestion-audit`
Run time: 2026-10-13 23:40:04 UTC
Scope: read-only; no replay, repair, schema change, or production mutation.

## Result

| Window | Accepted | Rejected | Rejection rate |
| --- | ---: | ---: | ---: |
| 24 hours | 499 | 221 | 30.69% |
| 7 days | 2,310 | 1,266 | 35.40% |
| 30 days | 10,867 | 4,895 | 31.06% |
| Cumulative | 29,857 | 9,285 | 23.72% |

Latest rejection: `2026-10-13T22:28:08.538269Z`.

## Rejection taxonomy

| Reason | Cumulative count |
| --- | ---: |
| `entity_type is invalid` | 6,493 |
| `event_name is not allowed` | 2,792 |

All 9,285 audited dead-letter rows were from `mobile`. Dominant rejected event names remain lifecycle events: `session_end` (3,372), `app_open` (1,828), `app_background` (1,560), `session_start` (1,293), and `app_foreground` (1,110).

## Deployment conclusion

The forward ingestion correction delivered in code cannot be marked deployed/effective. Rejections continued on October 13, including 221 on that UTC day and a rejection at 22:28 UTC. This release therefore retains explicit quality metadata and does not present rejected activity as canonical product usage.

## Duplicate behavior

- 1,320 dead-letter rows share a repeated `event_id`.
- 586 distinct event IDs repeat in dead letters.
- The accepted table retains its unique `analytics_events.event_id` guard.
- No dead letters were replayed. Any future replay requires an independently reviewed, idempotent tool and a post-replay reconciliation.

## Audit limitations

- Bearer-token failures occur before event validation and are not represented in dead letters.
- The audit emits category counts only; raw payloads are not printed.
- Historical cumulative rejection counts do not prove the current client version. The recent rejection timestamp is the basis for the deployment conclusion.
