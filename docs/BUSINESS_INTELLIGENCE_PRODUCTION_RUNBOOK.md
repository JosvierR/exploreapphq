# Business Intelligence v2 production runbook

## Production status (2026-08-12)

Project: `ookbeuiavzjhvezvamfu`

| Gate | State |
|---|---|
| Canonical migration baseline | 76 |
| Intentional production forwards | 7 (`20260810120000` … `20260812170000`) |
| Shared migration history | PASS (`npm run verify:shared-migration-history`) |
| Business schema | PASS (`npm run verify:business-schema`) |
| Controlled backfill `2026-08-08`→`2026-08-11` | PASS + idempotent |
| Historical backfill `2026-07-02`→`2026-08-11` | PASS |
| External Business accounts | NOT globally enabled; only `Explore Internal Business` has `bi_v2_enabled=true` |
| Daily aggregation | Vercel cron `15 5 * * *` → `/api/cron/analytics/aggregate` (four-day late-event window) |

### Production forwards

1. `20260810120000_admin_product_analytics_snapshot.sql`
2. `20260811150000_business_intelligence_v2.sql`
3. `20260811210000_business_intelligence_production_activation.sql` (dead-letter timestamp: `created_at`)
4. `20260812140000_business_metric_dictionary_expand.sql`
5. `20260812150000_fix_backfill_dimensions_canonical_ambiguity.sql`
6. `20260812160000_fix_aggregate_affinity_safe_deletes.sql` (affinity `DELETE … WHERE TRUE`)
7. `20260812170000_map_place_route_click_to_views.sql` (`place_click`/`route_click` → view metrics)

Do **not** run migration repair or re-apply already-recorded versions.

## Release gate

Infrastructure is production-ready when schema, history, backfill, security, API, Admin, and scheduler gates pass. External customer enablement still requires per-account `bi_v2_enabled`, membership, entitlements, and market/location authorization. Admin continues using the same core with global scope.

## Safe deployment order

1. Confirm the target project and take a database backup/PITR checkpoint.
2. Dry-run then apply only intentional forward migrations with `npx supabase db push --linked`.
3. Run `npm run verify:shared-migration-history` and `npm run verify:business-schema`.
4. Controlled backfill window twice; verify identical facts.
5. Full historical backfill from `MIN(occurred_at)::date` through the last complete UTC day.
6. Run the golden dataset and complete repository suite (`npm test`, lint, OpenAPI, build).
7. Deploy API/Admin via `main` → Vercel Production.
8. Confirm cron auth + four-day recomputation.
9. Keep external accounts gated until QA and latency budgets pass; Admin/internal may remain enabled.

Before production verification, the developer must materialize the production
environment from their own terminal (outside a restricted agent session):

```bash
npm run env:from-prod
npm run verify:business-schema
npm run business:backfill -- --from=<REAL_MIN_DAY> --to=<LAST_COMPLETE_DAY>
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
