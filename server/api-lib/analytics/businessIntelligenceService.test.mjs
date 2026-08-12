import assert from "node:assert/strict";
import test from "node:test";
import {
  destinationMarketForRow,
  resolveBusinessIntelligenceParams,
  travelerOriginForRow,
} from "./businessIntelligenceService.mjs";
import {
  buildBusinessBenchmark,
  buildDecisionInsights,
  calculateDemandIndex,
  enrichCategoryIntelligence,
  metricDefinitionsForClient,
} from "./businessAnalyticsCore.mjs";
import { BusinessAccessError, scopeBusinessAnalyticsParams } from "./businessAccess.mjs";

test("resolveBusinessIntelligenceParams accepts neighborhood + 12m", () => {
  const request = {
    url: "https://example.test/api/admin/business/dashboard?range=12m&country=DO&region=Santiago&city=Santiago&neighborhood=Centro&compare=previous",
  };
  const params = resolveBusinessIntelligenceParams(request);
  assert.equal(params.preset, "12m");
  assert.equal(params.country, "DO");
  assert.equal(params.region, "Santiago");
  assert.equal(params.city, "Santiago");
  assert.equal(params.neighborhood, "Centro");
  assert.equal(params.compare, "previous");
});

test("resolveBusinessIntelligenceParams rejects oversized custom ranges", () => {
  const request = {
    url: "https://example.test/api/admin/business/dashboard?date_from=2024-01-01&date_to=2026-01-01",
  };
  assert.throws(() => resolveBusinessIntelligenceParams(request), /cannot exceed/i);
});

test("resolveBusinessIntelligenceParams supports the shared Business query contract", () => {
  const request = {
    url: "https://example.test/api/business/v1/demand?from=2026-07-01&to=2026-07-31&compare_from=2026-06-01&compare_to=2026-06-30&geo_id=geo-1&business_id=business-1&location_id=location-1&category_id=food&platform=ios&source=mobile&compare_market=Santiago&compare_market=SD",
  };
  const params = resolveBusinessIntelligenceParams(request);
  assert.equal(params.start, "2026-07-01");
  assert.equal(params.explicit_comparison.start, "2026-06-01");
  assert.equal(params.geo_id, "geo-1");
  assert.equal(params.business_id, "business-1");
  assert.equal(params.location_id, "location-1");
  assert.equal(params.category_id, "food");
  assert.equal(params.platform, "ios");
  assert.equal(params.source, "mobile");
  assert.deepEqual(params.compare_markets, ["Santiago", "SD"]);
});

test("Demand Index v1 is stable at 50 and doubling scores 75", () => {
  const previous = {
    active_users: 100,
    sessions: 100,
    searches: 100,
    place_views: 100,
    route_views: 100,
    saves: 100,
    route_starts: 100,
    commercial_intent: 100,
  };
  assert.equal(calculateDemandIndex(previous, previous).score, 50);
  const doubled = Object.fromEntries(Object.entries(previous).map(([key, value]) => [key, value * 2]));
  assert.equal(calculateDemandIndex(doubled, previous).score, 75);
  assert.equal(calculateDemandIndex(doubled, previous).version, "v1");
});

test("Demand Index suppresses 1 to 2 noise", () => {
  const tiny = { active_users: 2, sessions: 2, searches: 2, place_views: 2 };
  const prior = { active_users: 1, sessions: 1, searches: 1, place_views: 1 };
  const result = calculateDemandIndex(tiny, prior);
  assert.equal(result.score, null);
  assert.equal(result.status, "insufficient_data");
});

test("Opportunity scores favor reliable high-demand low-supply categories", () => {
  const categories = enrichCategoryIntelligence([
    { category: "Outdoor", demand: 100, previous_demand: 60, growth_pct: 66.7, searches: 50, intent_rate: 22, save_rate: 18, supply: 3 },
    { category: "Restaurants", demand: 90, previous_demand: 80, growth_pct: 12.5, searches: 30, intent_rate: 14, save_rate: 12, supply: 30 },
    { category: "Shopping", demand: 40, previous_demand: 45, growth_pct: -11.1, searches: 10, intent_rate: 6, save_rate: 5, supply: 20 },
  ]);
  const outdoor = categories.find((item) => item.category === "Outdoor");
  const restaurants = categories.find((item) => item.category === "Restaurants");
  assert.ok(outdoor.opportunity_score > restaurants.opportunity_score);
  assert.equal(outdoor.reliable, true);
  assert.equal(outdoor.opportunity_version, "v1");
});

test("Business Score requires a real benchmark cohort", () => {
  const place = { place_id: "p1", place_name: "A", views: 100, unique_visitors: 80, saves: 20, shares: 5, actions: 10, directions: 8, trend_pct: 20, rating: 4.5 };
  assert.equal(buildBusinessBenchmark(place, [place]).score, null);
  const cohort = [
    place,
    { ...place, place_id: "p2", place_name: "B", saves: 10, actions: 5, rating: 4 },
    { ...place, place_id: "p3", place_name: "C", saves: 5, actions: 2, rating: 3.5 },
    { ...place, place_id: "p4", place_name: "D", saves: 15, actions: 7, rating: 4.2 },
  ];
  const benchmark = buildBusinessBenchmark(place, cohort);
  assert.equal(benchmark.status, "ready");
  assert.equal(benchmark.version, "v1");
  assert.ok(benchmark.score >= 0 && benchmark.score <= 100);
});

test("decision insights expose evidence and suppress low samples", () => {
  const low = buildDecisionInsights({
    range: { start: "2026-07-01", end: "2026-07-31" },
    comparisonRange: { start: "2026-06-01", end: "2026-06-30" },
    kpis: { place_views: 2, commercial_intent: 2, saves: 2, route_starts: 2 },
    previousKpis: { place_views: 1, commercial_intent: 1, saves: 1, route_starts: 1 },
    categories: [],
  });
  assert.deepEqual(low, []);

  const high = buildDecisionInsights({
    range: { start: "2026-07-01", end: "2026-07-31" },
    comparisonRange: { start: "2026-06-01", end: "2026-06-30" },
    kpis: { place_views: 150, commercial_intent: 40, saves: 30, route_starts: 20 },
    previousKpis: { place_views: 100, commercial_intent: 20, saves: 20, route_starts: 15 },
    categories: [],
  });
  assert.ok(high.length > 0);
  assert.ok(high.every((item) => item.evidence && item.confidence && item.period));
});

test("metric dictionary exposes versioned formulas", () => {
  const dictionary = metricDefinitionsForClient();
  assert.equal(dictionary.version, "v1");
  assert.match(dictionary.metrics.intent_rate.description, /high-intent action/i);
  assert.equal(dictionary.metrics.demand_index.version, "v1");
});

test("Business scope restricts own analytics to authorized locations", () => {
  const access = {
    actor_type: "business",
    business_id: "business-1",
    location_id: null,
    selected_location: null,
    authorized_place_ids: ["place-1", "place-2"],
    authorized_market_geo_ids: ["geo-santiago"],
  };
  const scoped = scopeBusinessAnalyticsParams({ place_id: "place-1" }, access, "own");
  assert.deepEqual(scoped.authorized_place_ids, ["place-1", "place-2"]);
  assert.equal(scoped.access_scope, "authorized_locations");
  assert.throws(
    () => scopeBusinessAnalyticsParams({ place_id: "place-3" }, access, "own"),
    (error) => error instanceof BusinessAccessError && error.status === 403,
  );
  const market = scopeBusinessAnalyticsParams({ geo_id: "geo-santiago", city: "Santiago" }, access, "market");
  assert.equal(market.authorized_place_ids, undefined);
  assert.equal(market.access_scope, "purchased_market");
  assert.throws(
    () => scopeBusinessAnalyticsParams({ geo_id: "geo-miami" }, access, "market"),
    (error) => error instanceof BusinessAccessError && error.code === "business_market_denied",
  );
});

test("destination market never falls back to traveler-origin geography", () => {
  const row = {
    country: "US",
    region: "FL",
    city: "Miami",
    locale: "en-US",
    _destination_country: "DO",
    _destination_region: "Santiago",
    _destination_city: "Santiago de los Caballeros",
  };
  assert.deepEqual(destinationMarketForRow(row), {
    country: "DO",
    region: "Santiago",
    city: "Santiago de los Caballeros",
    neighborhood: null,
  });
  assert.deepEqual(travelerOriginForRow(row), {
    country: "US",
    region: "FL",
    city: "Miami",
  });
  assert.equal(destinationMarketForRow({ country: "US", locale: "en-US" }).country, null);
});
