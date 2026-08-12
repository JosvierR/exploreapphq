import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAnalyticsEvent } from "./analyticsRouter.mjs";
import { calculateCanonicalKpis } from "./businessAnalyticsCore.mjs";
import { buildBusinessMobileOverviewPayload, computeKpis } from "./businessIntelligenceService.mjs";

test("mobile event -> validation -> canonical metric -> Admin/Mobile contract", () => {
  const input = [
    {
      event_id: "e2e-search",
      event_name: "search_performed",
      event_version: 1,
      anonymous_id: "traveler-1",
      session_id: "journey-1",
      entity_type: "search",
      entity_id: "search-1",
      occurred_at: "2026-08-10T18:00:00.000Z",
      platform: "ios",
      timezone: "America/Santo_Domingo",
      properties: { search_query: "restaurant", results_count: 4 },
      context: { environment: "production" },
    },
    {
      event_id: "e2e-view",
      event_name: "place_view",
      event_version: 1,
      anonymous_id: "traveler-1",
      session_id: "journey-1",
      entity_type: "place",
      entity_id: "place-a",
      occurred_at: "2026-08-10T18:01:00.000Z",
      platform: "ios",
      timezone: "America/Santo_Domingo",
      source_type: "search",
      source_id: "search-1",
      properties: {},
      context: { environment: "production" },
    },
    {
      event_id: "e2e-save",
      event_name: "place_save",
      event_version: 1,
      anonymous_id: "traveler-1",
      session_id: "journey-1",
      entity_type: "place",
      entity_id: "place-a",
      occurred_at: "2026-08-10T18:02:00.000Z",
      platform: "ios",
      timezone: "America/Santo_Domingo",
      properties: {},
      context: { environment: "production" },
    },
    {
      event_id: "e2e-directions",
      event_name: "place_get_directions",
      event_version: 1,
      anonymous_id: "traveler-1",
      session_id: "journey-1",
      entity_type: "place",
      entity_id: "place-a",
      occurred_at: "2026-08-10T18:03:00.000Z",
      platform: "ios",
      timezone: "America/Santo_Domingo",
      properties: {},
      context: { environment: "production" },
    },
  ];

  const normalized = input.map((event) => normalizeAnalyticsEvent(event)).map((result) => {
    assert.equal(result.rejected, undefined);
    return result.row;
  });
  assert.equal(normalized[0].properties.search_query, undefined, "raw search text is removed");
  assert.ok(normalized[0].properties.query_hash, "search is privacy-safe and auditable");

  const canonical = calculateCanonicalKpis(normalized);
  const adminMetrics = computeKpis(normalized);
  assert.deepEqual(adminMetrics, canonical);
  assert.equal(canonical.place_views, 1);
  assert.equal(canonical.saves, 1);
  assert.equal(canonical.commercial_actions, 1);

  const dashboard = {
    kpis: canonical,
    places: [{ directions: 1 }],
    comparison: { deltas: { place_views: { percent: 10, reliable: true }, saves: { percent: 10, reliable: true } } },
    business_performance: null,
    range: { start: "2026-08-10", end: "2026-08-10", preset: "custom" },
    data_as_of: normalized.at(-1).received_at,
    executive_summary: { headline: "One attributable journey", narrative: "Validated Explore activity." },
    what_changed: [],
    peak_demand: { peak_window: null },
    insights: [],
    state: "low_sample",
  };
  const mobile = buildBusinessMobileOverviewPayload(dashboard, { business_id: "business-a", location_id: "location-a" });
  assert.equal(mobile.kpi_values.place_views, adminMetrics.place_views);
  assert.equal(mobile.kpi_values.saves, adminMetrics.saves);
  assert.equal(mobile.kpi_values.directions, 1);
  assert.equal(mobile.business.business_id, "business-a");
});

