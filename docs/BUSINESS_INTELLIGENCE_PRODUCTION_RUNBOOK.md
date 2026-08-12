# Business Intelligence v2 production runbook

## Production status (2026-08-12)

Project: `ookbeuiavzjhvezvamfu`

| Gate | State |
|---|---|
| Canonical migration baseline | 76 |
| Intentional production forwards | 10 (`20260810120000` through `20260812220000`) |
| Shared migration history | PASS (`npm run verify:shared-migration-history`) |
| Business schema | PASS (`npm run verify:business-schema`) |
| Historical backfill `2026-07-02` through `2026-08-12` | PASS; two destination-aware reruns had identical fact hashes |
| Destination geography | 100% country, 95.9% region, 96.2% city, 87.5% Route market |
| External Business accounts | Not globally enabled; controlled per-account only |
| Daily aggregation | Configured for Vercel cron `15 5 * * *` (UTC) to `/api/cron/analytics/aggregate`, four-day late-event window; authorized proof is a release gate |

### Production forwards

1. `20260810120000_admin_product_analytics_snapshot.sql`
2. `20260811150000_business_intelligence_v2.sql`
3. `20260811210000_business_intelligence_production_activation.sql`
4. `20260812140000_business_metric_dictionary_expand.sql`
5. `20260812150000_fix_backfill_dimensions_canonical_ambiguity.sql`
6. `20260812160000_fix_aggregate_affinity_safe_deletes.sql`
7. `20260812170000_map_place_route_click_to_views.sql`
8. `20260812210000_business_destination_geography_enrichment.sql`
9. `20260812213000_preserve_enriched_geography_on_dimension_backfill.sql`
10. `20260812220000_require_explicit_destination_geo_semantics.sql`

Do not run migration repair or reapply an already-recorded version.

## Architecture and migration ownership

```text
analytics_events / analytics_raw_events (immutable)
  -> analytics_valid_events
  -> analytics_normalized_events
  -> canonical dimensions + destination geography
  -> daily facts
  -> Business Analytics Core
  -> score / insight / Admin / Business API
```

The repository migration directory and `supabase/migration-baseline.json` own
schema history. Production must have no remote-only/local-only versions or
timestamp collisions. Raw analytics is immutable; repairs are additive mappings,
dimensions, or functions followed by an idempotent fact recomputation.

Destination and traveler-origin geography are separate contracts. Place/Route
coordinates resolve the destination/market only; they never establish where a
traveler was located. `analytics_normalized_events.origin_*` retains coarse
request-origin data, while destination market filters use canonical Place/Route
geography.

## Safe release order

1. Confirm the linked project and backup/PITR posture.
2. Run migration history verification and `supabase db push --linked --dry-run`.
3. Validate pending SQL in a transaction that always rolls back, then apply only
   the reviewed forward migration.
4. Run schema and geography verifiers.
5. Preview geographic enrichment; manually review representative countries and
   cities before controlled and full writes.
6. Recompute a representative/full historical window twice and compare exact
   fact counts, totals, and hashes.
7. Run tests, lint/type checks, API build, OpenAPI, anti-drift, frontend build,
   browser-secret scan, and `git diff --check`.
8. Deploy final `main`, confirm the exact SHA reaches Vercel Production, then
   repeat authenticated Admin, Business, tenant-isolation, latency, cron, and
   health regression tests.

Never work around Vercel `[SENSITIVE]` redaction. Materialize approved protected
test credentials in ignored `.env.local`; never paste them into chat or logs.

## Geographic enrichment

Preview first:

```bash
npm run business:enrich-geo -- --dry-run --only-unresolved --limit=20 --accept-public-nominatim-policy
```

Use `--apply` only after review. Public Nominatim use requires explicit policy
acknowledgement, one serial request per 1.1 seconds, a custom user agent, and the
database-backed coordinate cache. It is suitable for the reviewed one-time
backfill, not recurring production traffic. Reruns select only missing/stale
coordinate hashes, refuse changed coordinates, preserve manual/higher-confidence
evidence, never write raw events, and prefer unknown over an incorrect market.
Attribute resolved data to OpenStreetMap contributors under ODbL wherever raw
resolved geography is exposed. Review and follow the official usage policy:
<https://operations.osmfoundation.org/policies/nominatim/>.

`backfill_business_dimensions()` is the only service-callable dimension entry
point. It reapplies only coordinate-current enrichment, refreshes linked Business
locations, and derives Route scope as `single_market`, `multi_market`, or
`unknown`. The renamed legacy implementation is private.

## Backfill and recompute

```bash
npm run business:backfill -- --from=<REAL_MIN_DAY> --to=<LAST_COMPLETE_DAY>
node --env-file=.env.local scripts/business-fact-fingerprint.mjs
```

Run the same window twice. Every fact table must have identical row counts,
totals, and hashes. Dimensions use stable upserts; each fact day is rebuilt on
its stable primary/unique key. Possible Place duplicates are reporting-only and
are never automatically merged.

## Cron and late events

Vercel calls `GET /api/cron/analytics/aggregate` at `15 5 * * *` in UTC. It
supplies `Authorization: Bearer <CRON_SECRET>`. An authorized operator can use
`POST` with `ANALYTICS_CRON_SECRET`. Both are server-only and must never use a
`VITE_` prefix.

Vercel documents the UTC schedule, GET invocation, and `CRON_SECRET` bearer
contract at <https://vercel.com/docs/cron-jobs> and
<https://vercel.com/docs/cron-jobs/manage-cron-jobs>.

The default window is UTC D-3, D-2, D-1, and D. Each day runs the base aggregate
then `run_business_intelligence_aggregation`, recording status, duration,
processed events, generated records, and sanitized failures. Vercel does not
retry failed cron invocations. Inspect function logs and Admin Analytics Health,
correct the issue, and issue an authorized idempotent rerun. Fact keys prevent a
late-window rerun from double counting.

## Claims, entitlements, and tenant isolation

Business authorization requires all of: active account, membership, per-account
`bi_v2_enabled`, active location or explicit market grant, and endpoint-specific
entitlement. Claims must use exact Place IDs and an explicit Admin review. Cache
keys include actor/account, authorized locations/Places/markets, endpoint, and
query. Test Business A then B and B then A; changing `business_id`, `location_id`,
`place_id`, or `geo_id` must never reveal another tenant.

The emergency kill switch is `business_accounts.bi_v2_enabled=false` for the
affected account. Do not globally enable external accounts.

## Data and product quality

For real countries, cities, Places, and Routes, reconcile source events,
valid/rejected taxonomy, entity/destination resolution, facts, API KPIs, scores,
and insight evidence. Low sample or absent tracking is a product state, not a
failure and never a reason to synthesize data.

Content attribution stays `tracking unavailable` until mobile telemetry sends
stable `source_type` and `source_id` for qualifying content-to-Place/Route
actions. Do not display missing tracking as zero conversions.

Latency budgets are overview under 1 second, trend/Places/Routes under 1.5
seconds, and deep analytics under 2 seconds where practical. Structured request
logs contain endpoint, tenant-safe scope, duration, cache hit, rows scanned, and
status. Optimize only measured slow paths.

## Monitoring and incident response

Operators must notice: stale cron success, processing lag, failed backfills or
aggregations, schema/history mismatch, rejection or unknown-entity spikes,
destination-geography regression, and API 5xx/latency breaches. Analytics Health
surfaces the last successful and attempted aggregation, status, duration,
sanitized error, and `data_as_of`; Vercel function logs show invocation failure.

Incident order:

1. Set `bi_v2_enabled=false` for affected accounts.
2. Inspect schema/history, Analytics Health, aggregation runs, rejects, and geo
   coverage.
3. Fix taxonomy/dimensions/functions additively; never edit raw events.
4. Recompute only affected days twice and repeat data/security/API QA.
5. Re-enable only the reviewed account after counts and latency are explainable.

Application rollback deploys the prior API build while keeping the account kill
switch off. Database objects are additive and should not be dropped during an
incident. Preserve legitimate aggregate history when access is revoked.
