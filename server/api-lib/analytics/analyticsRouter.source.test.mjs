import assert from "node:assert/strict";
import {
  countryFromLocale,
  normalizeAnalyticsEvent,
  normalizeAnalyticsSource,
  resolveRequestMarketGeo,
  validateAnalyticsEventRow,
} from "./analyticsRouter.mjs";

const baseEvent = {
  event_id: "test-event-source-default",
  event_name: "app_open",
  event_version: 1,
  anonymous_id: "anon-test-001",
  session_id: "session-test-001",
  entity_type: "system",
  entity_id: "app",
  occurred_at: "2026-07-02T10:00:00.000Z",
  platform: "web",
  app_version: "test",
  properties: {},
  context: {},
};

let eventCounter = 0;

function buildEvent(overrides = {}) {
  eventCounter += 1;
  return {
    ...baseEvent,
    event_id: overrides.event_id || `test-event-${eventCounter}`,
    ...overrides,
  };
}

assert.equal(normalizeAnalyticsSource(undefined, "web"), "web");
assert.equal(normalizeAnalyticsSource(null, "web"), "web");
assert.equal(normalizeAnalyticsSource("", "web"), "web");
assert.equal(normalizeAnalyticsSource(undefined, "ios"), "mobile");
assert.equal(normalizeAnalyticsSource(undefined, "android"), "mobile");
assert.equal(normalizeAnalyticsSource(undefined, null), "mobile");
assert.equal(normalizeAnalyticsSource("web", "web"), "web");
assert.equal(normalizeAnalyticsSource("mobile", "ios"), "mobile");
assert.equal(normalizeAnalyticsSource("unknown", "web"), null);

const webResult = normalizeAnalyticsEvent(buildEvent({ event_id: "test-web-default" }));
assert.equal(webResult.rejected, undefined);
assert.equal(webResult.row.source, "web");
assert.equal(validateAnalyticsEventRow(webResult.row).valid, true);

const iosResult = normalizeAnalyticsEvent(buildEvent({ event_id: "test-ios-default", platform: "ios" }));
assert.equal(iosResult.rejected, undefined);
assert.equal(iosResult.row.source, "mobile");

const androidResult = normalizeAnalyticsEvent(buildEvent({ event_id: "test-android-default", platform: "android" }));
assert.equal(androidResult.rejected, undefined);
assert.equal(androidResult.row.source, "mobile");

const noPlatformEvent = buildEvent({ event_id: "test-no-platform-default" });
delete noPlatformEvent.platform;
const noPlatformResult = normalizeAnalyticsEvent(noPlatformEvent);
assert.equal(noPlatformResult.rejected, undefined);
assert.equal(noPlatformResult.row.source, "mobile");

const explicitResult = normalizeAnalyticsEvent(
  buildEvent({ event_id: "test-explicit-source", platform: "ios", source: "mobile" }),
);
assert.equal(explicitResult.rejected, undefined);
assert.equal(explicitResult.row.source, "mobile");

const invalidResult = normalizeAnalyticsEvent(
  buildEvent({ event_id: "test-invalid-source", source: "unknown" }),
);
assert.equal(invalidResult.row, undefined);
assert.equal(invalidResult.rejected.reason, "invalid_source");
assert.equal(invalidResult.rejected.source, "web");

const mixedBatch = [
  normalizeAnalyticsEvent(buildEvent({ event_id: "test-batch-ok" })),
  normalizeAnalyticsEvent(buildEvent({ event_id: "test-batch-invalid", source: "unknown" })),
];
assert.equal(mixedBatch.filter((result) => result.row).length, 1);
assert.equal(mixedBatch.filter((result) => result.rejected).length, 1);

assert.equal(countryFromLocale("es-DO"), "DO");
assert.equal(countryFromLocale("en_US"), "US");
assert.equal(countryFromLocale("es"), null);

const geoFromHeaders = resolveRequestMarketGeo({
  headers: {
    get(name) {
      if (name === "x-vercel-ip-country") return "DO";
      if (name === "x-vercel-ip-country-region") return "32";
      return "";
    },
  },
});
assert.equal(geoFromHeaders.country, "DO");
assert.equal(geoFromHeaders.region, "32");
assert.equal(geoFromHeaders.city, null);

const geoFromLocale = resolveRequestMarketGeo({ headers: { get() { return ""; } } }, { locale: "es-DO" });
assert.equal(geoFromLocale.country, "DO");

const enriched = normalizeAnalyticsEvent(buildEvent({ event_id: "test-geo-enrich", country: null, locale: "es-DO" }), {
  request: {
    headers: {
      get(name) {
        return name === "x-vercel-ip-country" ? "DO" : name === "x-vercel-ip-country-region" ? "SD" : "";
      },
    },
  },
});
assert.equal(enriched.row.country, "DO");
assert.equal(enriched.row.region, "SD");
assert.equal(enriched.row.city, null);
