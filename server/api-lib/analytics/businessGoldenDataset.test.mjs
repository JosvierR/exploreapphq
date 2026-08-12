import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBusinessBenchmark,
  calculateCanonicalKpis,
  calculateDemandIndex,
  enrichCategoryIntelligence,
} from "./businessAnalyticsCore.mjs";
import { computeKpis } from "./businessIntelligenceService.mjs";
import { BUSINESS_GOLDEN_DATASET as golden } from "./fixtures/businessGoldenDataset.mjs";
import { businessCacheKey, clearBusinessIntelligenceCache, readThroughBusinessCache } from "./businessIntelligenceCache.mjs";

test("golden fixture has the documented deterministic topology", () => {
  assert.equal(golden.events.length, 100);
  assert.equal(golden.users.length, 10);
  assert.equal(golden.markets.length, 2);
  assert.equal(golden.places.length, 8);
  assert.equal(golden.routes.length, 3);
  assert.equal(new Set(golden.events.map((event) => event.event_id)).size, 100);
});

test("canonical golden metrics match their manually reviewed values", () => {
  const metrics = calculateCanonicalKpis(golden.events);
  assert.equal(metrics.total_events, golden.expected.events);
  assert.equal(metrics.active_travelers, golden.expected.active_travelers);
  assert.equal(metrics.sessions, golden.expected.sessions);
  assert.equal(metrics.place_views, golden.expected.place_views);
  assert.equal(metrics.unique_place_visitors, golden.expected.unique_place_visitors);
  assert.equal(metrics.saves, golden.expected.saves);
  assert.equal(metrics.commercial_actions, golden.expected.commercial_actions);
  assert.equal(metrics.intent_rate, golden.expected.intent_rate);
  assert.equal(metrics.searches, golden.expected.searches);
  assert.equal(metrics.route_views, golden.expected.route_views);
  assert.equal(metrics.route_starts, golden.expected.route_starts);
  assert.equal(metrics.route_completions, golden.expected.route_completions);
  assert.equal(metrics.route_completion_rate, golden.expected.route_completion_rate);
});

test("Business service consumes the same canonical KPI implementation", () => {
  assert.deepEqual(computeKpis(golden.events), calculateCanonicalKpis(golden.events));
});

test("scores stay bounded and rank commercially stronger controlled cohorts higher", () => {
  const currentHigh = {
    active_travelers: 80, sessions: 90, searches: 70, place_views: 100, route_views: 40,
    saves: 35, shares: 15, route_starts: 30, commercial_actions: 28,
  };
  const previous = {
    active_travelers: 40, sessions: 45, searches: 35, place_views: 50, route_views: 20,
    saves: 18, shares: 8, route_starts: 15, commercial_actions: 14,
  };
  const highDemand = calculateDemandIndex(currentHigh, previous);
  const lowDemand = calculateDemandIndex(previous, currentHigh);
  assert.ok(highDemand.score > lowDemand.score);
  assert.ok(highDemand.score >= 0 && highDemand.score <= 100);
  assert.ok(lowDemand.score >= 0 && lowDemand.score <= 100);

  const categories = enrichCategoryIntelligence([
    { category: "High opportunity", demand: 100, previous_demand: 50, supply: 8, intent: 30, saves: 25 },
    { category: "Mature", demand: 80, previous_demand: 75, supply: 70, intent: 12, saves: 10 },
    { category: "Low opportunity", demand: 15, previous_demand: 30, supply: 90, intent: 1, saves: 1 },
    { category: "Peer 1", demand: 45, previous_demand: 40, supply: 50, intent: 8, saves: 6 },
    { category: "Peer 2", demand: 55, previous_demand: 50, supply: 45, intent: 10, saves: 8 },
    { category: "Peer 3", demand: 65, previous_demand: 55, supply: 35, intent: 14, saves: 12 },
    { category: "Peer 4", demand: 35, previous_demand: 32, supply: 60, intent: 5, saves: 4 },
    { category: "Peer 5", demand: 75, previous_demand: 68, supply: 30, intent: 16, saves: 14 },
    { category: "Peer 6", demand: 25, previous_demand: 28, supply: 75, intent: 3, saves: 2 },
    { category: "Peer 7", demand: 85, previous_demand: 65, supply: 20, intent: 20, saves: 18 },
  ]);
  const opportunityHigh = categories.find((item) => item.category === "High opportunity");
  const opportunityLow = categories.find((item) => item.category === "Low opportunity");
  assert.ok(opportunityHigh.opportunity_score > opportunityLow.opportunity_score);
  assert.ok(categories.every((item) => item.opportunity_score == null || (item.opportunity_score >= 0 && item.opportunity_score <= 100)));

  const cohort = [
    { place_id: "p2", views: 50, saves: 8, shares: 2, actions: 4, trend_pct: 5, rating: 4.0 },
    { place_id: "p3", views: 60, saves: 10, shares: 3, actions: 5, trend_pct: 8, rating: 4.2 },
    { place_id: "p4", views: 70, saves: 12, shares: 4, actions: 6, trend_pct: 10, rating: 4.3 },
    { place_id: "p5", views: 80, saves: 14, shares: 5, actions: 7, trend_pct: 12, rating: 4.4 },
  ];
  const business = buildBusinessBenchmark(
    { place_id: "p1", views: 120, saves: 30, shares: 12, actions: 20, trend_pct: 30, rating: 4.8 },
    cohort,
  );
  assert.equal(business.status, "ready");
  assert.ok(business.score >= 0 && business.score <= 100);
});

test("cache keys and values stay isolated between Business accounts", async () => {
  clearBusinessIntelligenceCache();
  const params = { start: "2026-08-01", end: "2026-08-11", geo_id: "geo-a" };
  const keyA = businessCacheKey("business/v1/overview", params, { actor_type: "business", business_id: "business-a" });
  const keyB = businessCacheKey("business/v1/overview", params, { actor_type: "business", business_id: "business-b" });
  assert.notEqual(keyA, keyB);
  let loads = 0;
  const first = await readThroughBusinessCache(keyA, 60_000, async () => ({ business: "a", load: ++loads }));
  const second = await readThroughBusinessCache(keyA, 60_000, async () => ({ business: "wrong", load: ++loads }));
  const other = await readThroughBusinessCache(keyB, 60_000, async () => ({ business: "b", load: ++loads }));
  assert.equal(first.cache_hit, false);
  assert.equal(second.cache_hit, true);
  assert.equal(second.value.business, "a");
  assert.equal(other.value.business, "b");
  assert.equal(loads, 2);
});
