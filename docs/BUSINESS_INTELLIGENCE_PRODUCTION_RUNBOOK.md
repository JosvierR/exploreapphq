# Business Intelligence v2 production runbook

## Release gate

Business Intelligence v2 is not client-ready until both migrations, the historical backfill, real-data QA, and performance validation have completed. External accounts remain blocked by `business_accounts.bi_v2_enabled = false`; Admin continues using the same core with global scope.

## Safe deployment order

1. Confirm the target project and take a database backup/PITR checkpoint.
2. Apply `20260811150000_business_intelligence_v2.sql` in staging.
3. Apply `20260811210000_business_intelligence_production_activation.sql` in staging.
4. Run `npm run verify:business-schema` with staging server credentials.
5. Run dimension backfill and a short date window twice; verify identical facts.
6. Run the golden dataset and complete repository suite.
7. Repeat the two migrations in production.
8. Run the production schema verifier before any backfill.
9. Backfill dimensions, then historical facts in bounded windows.
10. Validate selected countries, cities, places, and routes against normalized-event counts.
11. Deploy the API/Admin build and let the Vercel cron recompute today through `today - 3 days`.
12. Enable `bi_v2_enabled` only for `Explore Internal Business`; enable external accounts after QA and latency budgets pass.

Before production verification, the developer must materialize the production
environment from their own terminal (outside a restricted agent session):

```bash
npm run env:from-prod
npm run verify:business-schema
npm run business:backfill -- --from=2026-01-01 --to=2026-08-11
```

Vercel can return `[SENSITIVE]` instead of decrypted values in agent or
non-interactive sessions. Never paste production secrets into chat and never
work around that redaction. Stop until an authorized developer terminal has
created the ignored `.env` and `.env.local` files.

## Verification

`npm run verify:business-schema` verifies required relations, RPCs, indexes, and RLS. It also prints the aggregated quality report without exposing event payloads or credentials.

Expected architecture:

```text
analytics_events / analytics_raw_events (immutable)
  -> analytics_valid_events
  -> analytics_normalized_events
  -> daily facts
  -> Business Analytics Core
  -> score / insight / Admin / Business API
```

Backfill is idempotent: dimensions use stable keys with upserts, and each fact day is deleted and rebuilt inside the aggregation RPC. Possible place duplicates are reported in `business_duplicate_place_candidates`; they are never automatically merged.

## Daily operation

The Vercel cron calls `/api/cron/analytics/aggregate` every day. Its default window is today plus the previous three UTC days to capture late events. Each day performs the base aggregation followed by `run_business_intelligence_aggregation`, which records status, duration inputs, processed events, generated records, and sanitized failure codes in `business_aggregation_runs`.

Use an explicit Admin recompute for a corrected date. Do not recalculate all history in the daily job.

## Data QA checklist

For at least three countries, five cities, ten places, and five routes, record:

- raw event count;
- validity exclusions by reason;
- normalized canonical event count;
- resolved geography/category/entity;
- corresponding daily fact count;
- API metric and insight evidence.

Confirm geographic drill-down and category/time filters update every section. Any unexplained difference blocks external rollout.

## Performance checks

Measure server timing with production-sized ranges after facts are populated:

- overview under 1 second;
- trends and place rankings under 1.5 seconds;
- deep analytics under 2 seconds.

Structured `analytics_request` logs include endpoint, tenant-safe identifiers, geography, duration, cache hit, rows scanned, and status. Cache keys are tenant-scoped; current-period TTL is 60 seconds and historical TTL is five minutes.

## Incident response

1. Disable `bi_v2_enabled` for affected external accounts; do not delete raw data.
2. Inspect Admin Analytics Health, `business_aggregation_runs`, rejection reasons, geography coverage, and resolution rates.
3. Recompute only affected dates after fixing taxonomy or dimensions.
4. Run schema verification and QA comparisons again.
5. Re-enable accounts only when counts are explainable and quality/latency gates pass.

Never repair an incident by editing or deleting `analytics_events`. Add mappings/dimensions, then recompute normalized facts.

## Rollback

Application rollback is performed by disabling external account flags and deploying the previous API build. Database objects are additive; do not drop them during an incident. Raw events remain untouched, allowing dimensions and facts to be safely regenerated.
