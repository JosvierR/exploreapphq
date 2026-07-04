import assert from "node:assert/strict";
import { dispatchAdminAnalyticsApi, handleAdminAnalyticsOverview } from "./analyticsAdminApi.mjs";
import {
  buildHealthPayload,
  buildOverviewFromEvents,
  buildTimeseriesFromEvents,
  makeAnalyticsWarning,
} from "./analyticsAdminShapes.mjs";
import { runAnalyticsAggregationForDay } from "./analyticsOperationsService.mjs";

const warnings = [makeAnalyticsWarning("daily_view_unavailable", "Using raw events fallback.")];
const rows = [
  {
    event_id: "e1",
    event_name: "app_open",
    source: "web",
    platform: "web",
    entity_type: "system",
    anonymous_id: "anon-1",
    user_id: null,
    session_id: "session-1",
    received_at: "2026-07-03T10:00:00.000Z",
    occurred_at: "2026-07-03T10:00:00.000Z",
  },
  {
    event_id: "e2",
    event_name: "app_open",
    source: "web",
    platform: "web",
    entity_type: "system",
    anonymous_id: "anon-2",
    user_id: null,
    session_id: "session-2",
    received_at: "2026-07-03T11:00:00.000Z",
    occurred_at: "2026-07-03T11:00:00.000Z",
  },
  {
    event_id: "e3",
    event_name: "app_open",
    source: "web",
    platform: "web",
    entity_type: "system",
    anonymous_id: "anon-3",
    user_id: null,
    session_id: "session-3",
    received_at: "2026-07-03T12:00:00.000Z",
    occurred_at: "2026-07-03T12:00:00.000Z",
  },
];

const overviewPayload = buildOverviewFromEvents({
  rangeRows: rows,
  rows24h: rows,
  eventsToday: 3,
  events24h: 3,
  events7d: 3,
  events30d: 3,
  deadLetters24h: 0,
  deadLettersInRange: 0,
  latestReceivedAt: rows[2].received_at,
  latestOccurredAt: rows[2].occurred_at,
  dailyView: null,
  warnings,
});

assert.equal(overviewPayload.overview.total_events_in_range, 3, "overview fallback counts raw events");
assert.equal(overviewPayload.overview.breakdowns.event_name[0].value, "app_open", "event breakdown includes app_open");
assert.equal(overviewPayload.overview.breakdowns.event_name[0].count, 3, "event breakdown count is correct");
assert.equal(overviewPayload.overview.breakdowns.source[0].value, "web", "source breakdown includes web");
assert.equal(overviewPayload.overview.breakdowns.platform[0].value, "web", "platform breakdown includes web");
assert.equal(overviewPayload.overview.breakdowns.entity_type[0].value, "system", "entity type breakdown includes system");
assert.equal(overviewPayload.warnings[0].code, "daily_view_unavailable", "overview exposes fallback warning");

const timeseriesPayload = buildTimeseriesFromEvents(rows, "7d", warnings);
assert.equal(timeseriesPayload.timeseries.events_by_day.length, 1, "timeseries fallback groups rows into buckets");
assert.equal(timeseriesPayload.timeseries.events_by_day[0].count, 3, "timeseries bucket count is correct");
assert.equal(timeseriesPayload.timeseries.sessions_by_day[0].count, 3, "timeseries session count is correct");
assert.equal(timeseriesPayload.timeseries.users_by_day[0].anonymous, 3, "timeseries anonymous count is correct");

const healthPayload = buildHealthPayload({
  events5m: 1,
  events1h: 3,
  events24h: 3,
  deadLetters1h: 0,
  deadLetters24h: 0,
  latestEventReceivedAt: rows[2].received_at,
  latestAggregationDay: "2026-07-03",
  rejectionReasons: [],
  rejectionSources: [],
  diagnostics: {
    analytics_events_selectable: true,
    analytics_dead_letters_selectable: true,
  },
  warnings,
});
assert.equal(healthPayload.health.status, "healthy", "health is healthy when events exist and dead letters are zero");

const aggregateBody = await runAnalyticsAggregationForDay(
  { async rpc() { return { data: null, error: null }; } },
  new Date().toISOString().slice(0, 10),
);
assert.equal(aggregateBody.message, "Aggregation completed", "aggregate void/null success returns message");

const methodResponse = await handleAdminAnalyticsOverview(
  new Request("https://example.com/api/admin/analytics/overview", {
    method: "POST",
    headers: { "x-request-id": "test-overview-request" },
  }),
);
assert.equal(methodResponse.status, 405, "overview rejects invalid method");
const methodBody = await methodResponse.json();
assert.ok(methodBody.request_id, "overview error includes request_id");

const routeResponse = await dispatchAdminAnalyticsApi(
  new Request("https://example.com/api/admin/analytics/unknown", {
    headers: { "x-request-id": "test-route-request" },
  }),
  "admin/analytics/unknown",
);
assert.equal(routeResponse.status, 404, "unknown admin analytics route returns 404");
const routeBody = await routeResponse.json();
assert.ok(routeBody.request_id, "route errors include request_id");

console.log("analyticsAdminApi tests passed");
