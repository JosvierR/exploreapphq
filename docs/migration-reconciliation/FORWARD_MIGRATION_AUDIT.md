# Business Intelligence v2 forward-migration audit

Target project: `ookbeuiavzjhvezvamfu`  
Audited apply set: `20260810120000`, `20260811150000`, `20260811210000`

The linked dry-run contains exactly these three migrations. Production history
contains 76 aligned canonical versions and no remote-only migration.

## Current production scale

Read-only probes on 2026-08-12 returned:

| Relation | Rows | Total bytes |
|---|---:|---:|
| `analytics_events` | 10,930 | 10,059,776 |
| `places` | 317 | 303,104 |
| `routes` | 168 | 1,163,264 |
| `videos` | 23 | 212,992 |
| `users` | 155 | 172,032 |

This is a modest transactional DDL workload. The three new partial indexes on
`analytics_events` require a scan of about 10 MB. Normal `CREATE INDEX` is
appropriate at this scale; `CONCURRENTLY` would prevent the migration from
remaining atomic and is not justified by the measured data size.

The live role probe also confirms `anon` and `authenticated` cannot create in
the `public` schema, `analytics_events` has RLS enabled, the base aggregation RPC
is executable by `service_role`, and it is not executable by `authenticated`.

## `20260810120000_admin_product_analytics_snapshot.sql`

- Dependency: `public.analytics_events` and its current DATA-001 columns.
- Creates/replaces: `public.admin_product_analytics_snapshot()`.
- Reads: a seven-day window of `analytics_events` when invoked.
- Migration-time data work: none; the function is not invoked by the migration.
- Locks: function catalog only.
- Security: `SECURITY DEFINER`, owned by `postgres`, fixed
  `search_path=public, extensions`; execution is revoked from `PUBLIC`, `anon`,
  and `authenticated` and granted only to `service_role`.
- Expected migration runtime: sub-second.
- Recovery: keep the function installed and roll the application back; use a
  new forward migration for any function correction.

## `20260811150000_business_intelligence_v2.sql`

- Dependencies: `auth.users`, `analytics_events`, `analytics_event_dead_letters`,
  `pgcrypto`, and the canonical production foundation.
- Creates: geography, Business account/membership/location/claim/entitlement,
  signal, metric/taxonomy, dimension, fact, and aggregation-run tables; raw,
  valid, and normalized analytics views; plan synchronization, membership, and
  daily aggregation functions.
- Alters: adds `source_type`, `source_id`, `geo_id`, `analytics_eligible`, and
  `analytics_exclusion_reason` to `analytics_events`.
- Indexes: three partial analytics-event indexes plus geography, access, signal,
  fact, and run indexes.
- Data mutations: idempotent seed/upsert of plan features, event-name mappings,
  metric definitions, taxonomy, and sources; plan entitlement synchronization
  for any pre-existing Business accounts. It does not update or delete raw
  analytics events.
- Aggregation behavior: facts for one day are deleted and rebuilt by primary
  key, making recomputation idempotent. Geography selection for a Place/Route
  group is deterministic.
- RLS and permissions: every Business/fact/dimension table has RLS enabled;
  direct tenant metadata access has explicit authenticated grants plus scoped
  policies; facts, dimensions, raw/valid/normalized views, and maintenance RPCs
  remain service-role-only. Security-definer maintenance RPCs explicitly revoke
  default `PUBLIC` execution.
- Lock risk: brief `ACCESS EXCLUSIVE` locks for five metadata-fast column adds;
  index scans over the measured 10 MB event table; new-table DDL is isolated.
- Expected migration runtime: seconds at current scale, with a conservative
  allowance under one minute.
- Recovery: external exposure remains gated; roll back the application or
  disable `bi_v2_enabled`. Database objects are additive and should be corrected
  with a new forward migration, not dropped during an incident.

## `20260811210000_business_intelligence_production_activation.sql`

- Dependencies: every v2 relation/function above plus `places`, `routes`, and
  PostGIS point functions.
- Creates/replaces: category mappings, backfill-run tracking, canonical label,
  country/region normalization, geo resolution/upsert, dimension backfill,
  rejected-event/duplicate/alert views, monitored aggregation, descendant-geo,
  quality-report, and deep schema-verification functions.
- Alters/indexes: additive columns on new dimension tables and a null-safe
  canonical geography uniqueness index.
- Data mutations: canonical category seeds and one fixed internal Business
  account. `Explore Internal Business` is enabled; all external accounts remain
  disabled by the `false` column default. Historical dimension/fact backfill is
  not invoked during migration.
- Geography: the later idempotent dimension backfill seeds country/region trees
  from coarse event metadata, extracts coordinates from every production Place
  PostGIS point, and never invents city data. Current production has zero events
  with city telemetry, so city metrics must report unavailable until tracking or
  a trusted catalog source provides it.
- Category coverage: every Place/Route enum currently present in production is
  mapped; legacy food/restaurant aliases collapse to canonical Food & Dining.
- RLS and permissions: activation tables are private and service-role-only;
  helper and verification RPCs revoke browser execution. The schema verifier
  checks relations, columns, functions, owners/security-definer flags, indexes,
  foreign keys, RLS, explicit permissions, and feature configuration.
- Lock risk: new/empty v2 tables only; no raw-event rewrite.
- Expected migration runtime: seconds.
- Recovery: disable the internal feature flag and roll back the application;
  retain raw events and additive schema for a forward fix.

## Compatibility decisions

`AFFINITY_FORWARD_REQUIRED = NO`: bare PostgreSQL `DELETE FROM table;` is valid,
and the live aggregate is already a `postgres`-owned `SECURITY DEFINER` function
with a safe fixed search path. `WHERE TRUE` would be a style-only replacement.

`AUTHENTICATED_GRANT_REQUIRED = NO`: Admin aggregation, cron, and backfill all
invoke RPCs through a server-side service-role client. Reintroducing the retired
authenticated aggregate grant would widen privileges without a caller.

## Gate

`SAFE_TO_APPLY_DDL` remains `NO` until the final merged source passes tests,
TypeScript, lint, API build, OpenAPI lint/anti-drift, frontend production build,
shared-history verification, secret scan, and `git diff --check`.
