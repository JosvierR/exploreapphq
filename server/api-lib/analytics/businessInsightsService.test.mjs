import assert from "node:assert/strict";
import {
  BusinessInsightsError,
  buildDelta,
  getBusinessOverview,
  getContentPerformance,
  getCreatorPerformance,
  getEngagementFunnel,
  getGrowthInsights,
  getInvestorSnapshot,
  getLocationInterest,
  getSearchInsights,
  resolveBusinessRange,
} from "./businessInsightsService.mjs";

const rows = [
  {
    event_name: "app_open",
    entity_type: "system",
    entity_id: "app",
    anonymous_id: "a1",
    user_id: null,
    session_id: "s1",
    source: "web",
    platform: "web",
    country: "DO",
    region: "Santo Domingo",
    city: "Santo Domingo",
    received_at: "2026-07-03T10:00:00.000Z",
    properties: {},
    context: {},
  },
  {
    event_name: "screen_view",
    entity_type: "screen",
    entity_id: "home",
    anonymous_id: "a1",
    user_id: null,
    session_id: "s1",
    source: "web",
    platform: "web",
    country: "DO",
    region: "Santo Domingo",
    city: "Santo Domingo",
    received_at: "2026-07-03T10:01:00.000Z",
    properties: {},
    context: {},
  },
  {
    event_name: "video_view_start",
    entity_type: "video",
    entity_id: "video-1",
    anonymous_id: "a1",
    user_id: "u1",
    session_id: "s1",
    source: "web",
    platform: "web",
    country: "DO",
    region: "Santo Domingo",
    city: "Santo Domingo",
    received_at: "2026-07-03T10:02:00.000Z",
    properties: { creator_id: "creator-1" },
    context: {},
  },
  {
    event_name: "video_like",
    entity_type: "video",
    entity_id: "video-1",
    anonymous_id: "a1",
    user_id: "u1",
    session_id: "s1",
    source: "web",
    platform: "web",
    country: "DO",
    region: "Santo Domingo",
    city: "Santo Domingo",
    received_at: "2026-07-03T10:03:00.000Z",
    properties: { creator_id: "creator-1" },
    context: {},
  },
  {
    event_name: "search_submitted",
    entity_type: "search",
    entity_id: "search-1",
    anonymous_id: "a2",
    user_id: null,
    session_id: "s2",
    source: "web",
    platform: "web",
    country: "US",
    region: "NY",
    city: "New York",
    received_at: "2026-07-03T11:00:00.000Z",
    properties: { query_hash: "abc123", query: "should-not-leak" },
    context: {},
  },
  {
    event_name: "search_no_results",
    entity_type: "search",
    entity_id: "search-2",
    anonymous_id: "a2",
    user_id: null,
    session_id: "s2",
    source: "web",
    platform: "web",
    country: "US",
    region: "NY",
    city: "New York",
    received_at: "2026-07-03T11:01:00.000Z",
    properties: { query_hash: "abc123" },
    context: {},
  },
];

function mockClient(events = rows) {
  return {
    from(table) {
      return {
        select() {
          return {
            gte() {
              return this;
            },
            lt() {
              return this;
            },
            eq() {
              return this;
            },
            limit() {
              return this;
            },
            order() {
              return this;
            },
            async then(resolve) {
              if (table === "analytics_event_dead_letters") {
                return resolve({ count: 0, error: null, data: [] });
              }
              return resolve({ data: events, error: null, count: events.length });
            },
          };
        },
      };
    },
  };
}

const range = {
  preset: "7d",
  start: "2026-07-01",
  end: "2026-07-03",
  since: "2026-07-01T00:00:00.000Z",
  until: "2026-07-04T00:00:00.000Z",
};

const overview = await getBusinessOverview(mockClient(), range);
assert.equal(overview.summary.total_events, 6, "overview counts events");
assert.equal(overview.summary.app_opens, 1, "overview counts app opens");
assert.equal(overview.summary.video_views, 1, "overview counts video views");
assert.ok(overview.breakdowns.top_event_names.length > 0, "overview has event breakdown");

const growth = await getGrowthInsights(mockClient(), range);
assert.ok(growth.series.length >= 1, "growth returns daily series");
assert.ok(growth.summary.active_anonymous_ids >= 1, "growth has anonymous ids");

const funnel = await getEngagementFunnel(mockClient(), range);
assert.equal(funnel.funnel[0].key, "app_open", "funnel starts with app_open");
assert.ok(funnel.funnel[0].count >= 1, "funnel app_open count");
assert.equal(typeof funnel.funnel[1].dropoff_pct, "number", "funnel includes dropoff");

const content = await getContentPerformance(mockClient(), range);
assert.equal(content.sections.videos[0].entity_id, "video-1", "content includes video");
assert.equal(content.sections.videos[0].engagement_score, 1 * 1 + 1 * 3, "content score formula");

const search = await getSearchInsights(mockClient(), range);
assert.equal(search.summary.total_searches, 1, "search totals");
assert.equal(search.breakdowns.top_query_hashes[0].query_hash, "abc123", "search exposes query_hash");
assert.equal(
  JSON.stringify(search).includes("should-not-leak"),
  false,
  "search never exposes raw query",
);

const creators = await getCreatorPerformance(mockClient(), range);
assert.equal(creators.creators[0].creator_id, "creator-1", "creator insights when creator_id present");

const creatorsMissing = await getCreatorPerformance(
  mockClient(rows.map((row) => ({ ...row, properties: {}, context: {} }))),
  range,
);
assert.equal(creatorsMissing.creators.length, 0, "creator empty when missing");
assert.ok(
  creatorsMissing.warnings.some((item) => item.code === "creator_id_not_in_analytics_events"),
  "creator warning when missing",
);

const locations = await getLocationInterest(mockClient(), range);
assert.ok(locations.countries.some((item) => item.country === "DO"), "location countries");
assert.ok(
  !locations.cities.some((item) => item.city === "New York"),
  "location threshold hides cities under 3 events",
);

const sparseLocations = await getLocationInterest(
  mockClient(rows.map((row) => ({ ...row, country: null, region: null, city: null }))),
  range,
);
assert.ok(
  sparseLocations.warnings.some((item) => item.code === "location_metadata_missing"),
  "location warning when metadata missing",
);

const investor = await getInvestorSnapshot(mockClient(), range);
assert.ok(investor.snapshot.active_users_estimate >= 1, "investor snapshot estimate");
assert.ok(investor.copy_text.includes("Active users"), "investor copy text");
assert.ok(Array.isArray(investor.snapshot.data_quality_notes), "investor quality notes");

assert.throws(
  () =>
    resolveBusinessRange(
      new Request("https://example.com/api/admin/analytics/business/overview?start=2026-01-01&end=2026-06-01"),
    ),
  (error) => error instanceof BusinessInsightsError && error.code === "business_range_too_large",
  "max 90-day range enforced",
);

assert.throws(
  () => resolveBusinessRange(new Request("https://example.com/api/admin/analytics/business/overview?range=bad")),
  (error) => error instanceof BusinessInsightsError && error.code === "business_invalid_range",
  "invalid range rejected",
);

const okRange = resolveBusinessRange(new Request("https://example.com/api/admin/analytics/business/overview?range=7d"));
assert.equal(okRange.preset, "7d", "default-like preset accepted");

const filtered = resolveBusinessRange(
  new Request("https://example.com/api/admin/analytics/business/overview?range=7d&platform=web&source=web&compare=previous"),
);
assert.equal(filtered.platform, "web", "valid platform accepted");
assert.equal(filtered.source, "web", "valid source accepted");
assert.equal(filtered.compare, true, "compare previous accepted");

assert.throws(
  () =>
    resolveBusinessRange(
      new Request("https://example.com/api/admin/analytics/business/overview?platform=windows"),
    ),
  (error) => error instanceof BusinessInsightsError && error.code === "business_invalid_filter",
  "invalid filters rejected",
);

const zeroPrevious = buildDelta(5, 0);
assert.equal(zeroPrevious.percent, null, "previous zero does not divide by zero");
assert.equal(zeroPrevious.label, "New activity", "previous zero uses friendly label");

const compared = await getBusinessOverview(mockClient(), { ...range, compare: true });
assert.ok(compared.comparison?.deltas?.active_sessions, "compare previous returns deltas");
assert.equal(compared.summary.active_users_estimate, 3, "overview includes active users estimate");
assert.equal(JSON.stringify(compared).includes("should-not-leak"), false, "no raw query in overview");
assert.equal(JSON.stringify(compared).includes('"lat"'), false, "no precise lat field leaked");
assert.equal(JSON.stringify(compared).includes('"lng"'), false, "no precise lng field leaked");
assert.equal(JSON.stringify(compared).includes("latitude"), false, "no latitude field leaked");

assert.ok(investor.copy_text.includes("Explore Analytics Snapshot"), "investor snapshot is founder-friendly");

console.log("businessInsightsService tests passed");
