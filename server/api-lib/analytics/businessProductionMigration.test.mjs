import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const foundation = readFileSync(new URL("../../../supabase/migrations/20260811150000_business_intelligence_v2.sql", import.meta.url), "utf8");
const activation = readFileSync(
  new URL("../../../supabase/migrations/20260811210000_business_intelligence_production_activation.sql", import.meta.url),
  "utf8",
);
const geographyClosure = readFileSync(
  new URL("../../../supabase/migrations/20260812210000_business_destination_geography_enrichment.sql", import.meta.url),
  "utf8",
);
const geographyBackfillClosure = readFileSync(
  new URL("../../../supabase/migrations/20260812213000_preserve_enriched_geography_on_dimension_backfill.sql", import.meta.url),
  "utf8",
);
const geographySemanticsClosure = readFileSync(
  new URL("../../../supabase/migrations/20260812220000_require_explicit_destination_geo_semantics.sql", import.meta.url),
  "utf8",
);

test("production pipeline preserves raw rows and layers validated + normalized views", () => {
  assert.match(foundation, /create or replace view public\.analytics_raw_events/i);
  assert.match(foundation, /create or replace view public\.analytics_valid_events/i);
  assert.match(foundation, /create or replace view public\.analytics_normalized_events/i);
  assert.doesNotMatch(`${foundation}\n${activation}`, /(?:update|delete\s+from)\s+public\.analytics_events/i);
  assert.match(activation, /e\.event_name as original_event_name/i);
});

test("facts are private-by-default and production schema is machine-verifiable", () => {
  for (const table of ["fact_market_daily", "fact_place_daily", "fact_route_daily", "fact_business_daily", "fact_search_daily"]) {
    assert.match(foundation, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(activation, /create or replace function public\.verify_business_intelligence_schema/i);
  assert.match(activation, /geo_entities_canonical_hierarchy_uidx/i);
  assert.match(activation, /run_business_intelligence_aggregation/i);
  for (const section of ["columns", "security_definer", "foreign_keys", "permissions", "configuration"]) {
    assert.match(activation, new RegExp(`'${section}'`));
  }
});

test("security-definer maintenance and snapshot RPCs are not executable by public clients", () => {
  const snapshot = readFileSync(
    new URL("../../../supabase/migrations/20260810120000_admin_product_analytics_snapshot.sql", import.meta.url),
    "utf8",
  );
  assert.match(
    snapshot,
    /revoke all on function public\.admin_product_analytics_snapshot\(\) from public, anon, authenticated/i,
  );
  assert.doesNotMatch(snapshot, /grant execute on function public\.admin_product_analytics_snapshot\(\) to authenticated/i);
  assert.match(
    foundation,
    /revoke all on function public\.sync_business_plan_entitlements\(uuid\) from public, anon, authenticated/i,
  );
  assert.match(
    foundation,
    /revoke all on function public\.aggregate_business_intelligence_for_day\(date\) from public, anon, authenticated/i,
  );
  assert.match(
    activation,
    /revoke all on function public\.resolve_business_event_geo_id\([^;]+\) from public, anon/i,
  );
});

test("backfill is idempotent and exposes quality reports without auto-merging duplicates", () => {
  assert.match(activation, /create or replace function public\.backfill_business_dimensions/i);
  assert.match(activation, /on conflict \(place_id\) do update/i);
  assert.match(activation, /on conflict \(route_id\) do update/i);
  assert.match(activation, /seed the canonical hierarchy from coarse event geography/i);
  assert.match(activation, /st_y\(p\.location::geometry\)/i);
  assert.match(activation, /business_region_name\(country_code, raw_region\)/i);
  for (const category of ["gastronomy", "urban", "nature", "beach", "history", "culture", "hiking", "adventure"]) {
    assert.match(activation, new RegExp(`'${category}'`));
  }
  assert.match(activation, /business_duplicate_place_candidates/i);
  assert.doesNotMatch(activation, /delete\s+from\s+public\.places/i);
  assert.match(activation, /business_intelligence_quality_report/i);
});

test("daily place aggregation chooses a resolved geography without an invalid grouped select", () => {
  assert.match(foundation, /min\(geo_id::text\)::uuid/i);
  assert.doesNotMatch(foundation, /target_day,\s*entity_id,\s*geo_id,\s*count\(\*\) filter/i);
});

test("external rollout is explicitly gated while Admin retains the same core", () => {
  assert.match(foundation, /bi_v2_enabled boolean not null default false/i);
  assert.match(activation, /Explore Internal Business/i);
  assert.match(activation, /business_market_access/i);
});

test("destination geography enrichment is private, idempotent, and origin-safe", () => {
  assert.match(geographyClosure, /create table if not exists public\.business_place_geo_enrichment/i);
  assert.match(geographyClosure, /on conflict \(place_id\) do update/i);
  assert.match(geographyClosure, /place coordinates changed; refusing stale geography/i);
  assert.match(geographyClosure, /event\.country as origin_country/i);
  assert.match(geographyClosure, /event_entity_type = 'place'[\s\S]+select geo_id into result_id from public\.dim_places/i);
  assert.match(geographyClosure, /refresh_business_route_geography/i);
  assert.match(geographyClosure, /revoke all on function public\.apply_business_place_geo_enrichment[\s\S]+authenticated/i);
  assert.doesNotMatch(geographyClosure, /(?:update|delete\s+from)\s+public\.analytics_events/i);
});

test("dimension backfill preserves only coordinate-current enrichment and refreshes route markets", () => {
  assert.match(
    geographyBackfillClosure,
    /rename to backfill_business_dimensions_without_geo_enrichment/i,
  );
  assert.match(geographyBackfillClosure, /enrichment\.status = 'applied'/i);
  assert.match(geographyBackfillClosure, /abs\(place\.latitude - enrichment\.latitude\) <= 0\.0000005/i);
  assert.match(geographyBackfillClosure, /abs\(place\.longitude - enrichment\.longitude\) <= 0\.0000005/i);
  assert.match(geographyBackfillClosure, /refresh_business_route_geography\(\)/i);
  assert.match(
    geographyBackfillClosure,
    /revoke all on function public\.backfill_business_dimensions_without_geo_enrichment\(\)[\s\S]+service_role/i,
  );
  assert.doesNotMatch(geographyBackfillClosure, /(?:update|delete\s+from)\s+public\.analytics_events/i);
});

test("ambiguous event geography cannot become destination geography", () => {
  assert.match(
    geographySemanticsClosure,
    /if direct_geo_id is not null and explicit_destination then return direct_geo_id/i,
  );
  assert.doesNotMatch(
    geographySemanticsClosure,
    /if direct_geo_id is not null then return direct_geo_id/i,
  );
  assert.match(geographySemanticsClosure, /end as explicit_event_geo_id/i);
  assert.match(geographySemanticsClosure, /end as origin_geo_id/i);
  assert.match(geographySemanticsClosure, /create or replace function public\.verify_business_geo_semantics/i);
  assert.doesNotMatch(geographySemanticsClosure, /(?:update|delete\s+from)\s+public\.analytics_events/i);
});
