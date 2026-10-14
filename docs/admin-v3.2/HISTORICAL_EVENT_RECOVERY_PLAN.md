# Historical Event Recovery Plan

This is a separate, **not executed** workstream. No dead letter was replayed, changed, or deleted during 3.2.

## Inventory

- 9,285 cumulative dead-letter rows.
- 6,493 invalid-entity rows and 2,792 disallowed-event-name rows.
- 586 event IDs repeat across 1,320 rows, so retries must be collapsed before any replay.
- All observed rows are mobile; dominant legitimate families are session lifecycle and route authoring.

## Safe replay design

1. Freeze the source query with an explicit timestamp/event-family range and export only sanitized fields.
2. Classify eligibility against `analytics-ingestion-v2`; unknown or malformed events remain quarantined.
3. Group by `event_id`, compare payload hashes, and flag conflicting duplicates for manual review.
4. Exclude any `event_id` already present in `analytics_events` (the accepted-table unique constraint is the final guard).
5. Preserve original `occurred_at`; stamp a separate recovery batch ID and source provenance.
6. Dry-run normalization into a temporary/local artifact and reconcile candidate counts/KPIs before a write.
7. Obtain explicit approval for the production write and a reviewed replay tool.
8. Replay in small batches with rate limits, stop conditions, structured logs, and post-batch KPI checks.
9. Never delete dead letters as part of replay; record disposition separately for auditability.

## Acceptance and rollback

Replay is acceptable only if payload classes are legitimate, identity/privacy fields pass current sanitization, duplicate conflicts are zero or manually resolved, and KPI deltas match a pre-approved expectation. Because accepted events are append-only and may affect aggregates, rollback is a compensating exclusion/rebuild procedure—not deletion without a reviewed incident plan.

Required approval: production data write + historical metric restatement. Until granted, status remains **planned / blocked by authorization**.
