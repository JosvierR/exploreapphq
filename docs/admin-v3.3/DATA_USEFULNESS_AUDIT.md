# Data Usefulness Audit

Audit time: 2026-10-14 UTC. Scope: read-only production queries plus local fixture validation.

## What is decision-useful now

- Active identities, sessions, route starts/completions, searches, commercial actions, and total accepted events reconcile between normalized and raw sources for canonical invariants.
- Place and route rankings can be used as observed product activity when minimum-count and authorization rules pass.
- Category mappings report 100% canonical coverage in the current business quality view; normalization preserves an explicit Uncategorized state rather than deleting records.
- Place resolution is 99.4%; route resolution is 100%.
- Historical fact coverage runs from 2026-07-04 through 2026-10-12.

## What requires qualification

- Seven-day ingestion: 2,357 accepted / 1,235 rejected; 34.38% is an operational rejection proxy, not a unique-device failure rate, because retries may repeat.
- Only 50.4% of destination events have resolved destination geography. Market comparisons cannot represent total tourism-market demand.
- Route starts are 10 versus 2 previously. The +400% calculation is arithmetically correct but statistically weak; the v3 readiness contract marks it unreliable for an unqualified headline.
- Commercial actions are 1 versus 2. These are intent signals, not transactions or revenue.
- No authorized reconciled financial source is connected. Revenue is unavailable, not zero.
- `fact_content_attribution` has zero rows, so content-attribution conclusions are ineligible.

## Current observed KPIs

For the seven days ending at the audit time: 58 active identities, 106 sessions, 34 normalized place views, 14 normalized route views, 10 route starts, 1 route completion, 1 commercial action, and 18 searches. The exact JSON is in `benchmarks/production-executive-reconciliation.json`.

## Instrumentation priorities

1. Correct mobile producers emitting invalid session entity types and non-allowlisted lifecycle events.
2. Sustain a post-deploy rejection gate below 1% for at least 24 hours and 100 attempts.
3. Improve destination attribution for the unresolved 49.6% of destination events.
4. Instrument and reconcile financial providers before showing money.
5. Populate content-attribution facts before claiming content-driven conversion.
