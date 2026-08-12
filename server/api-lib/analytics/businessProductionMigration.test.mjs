import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const foundation = readFileSync(new URL("../../../supabase/migrations/20260811150000_business_intelligence_v2.sql", import.meta.url), "utf8");
const activation = readFileSync(
  new URL("../../../supabase/migrations/20260811210000_business_intelligence_production_activation.sql", import.meta.url),
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
});

test("backfill is idempotent and exposes quality reports without auto-merging duplicates", () => {
  assert.match(activation, /create or replace function public\.backfill_business_dimensions/i);
  assert.match(activation, /on conflict \(place_id\) do update/i);
  assert.match(activation, /on conflict \(route_id\) do update/i);
  assert.match(activation, /business_duplicate_place_candidates/i);
  assert.doesNotMatch(activation, /delete\s+from\s+public\.places/i);
  assert.match(activation, /business_intelligence_quality_report/i);
});

test("external rollout is explicitly gated while Admin retains the same core", () => {
  assert.match(foundation, /bi_v2_enabled boolean not null default false/i);
  assert.match(activation, /Explore Internal Business/i);
  assert.match(activation, /business_market_access/i);
});

