import assert from "node:assert/strict";
import {
  ANALYTICS_EVENT_ALLOWLIST,
  EVENT_LABELS,
  eventLabel,
  formatAnalyticsJson,
  formatPropertyValue,
  humanizeKey,
  metricLabel,
  platformLabel,
  propertyLabel,
} from "./analyticsDisplay";

for (const eventName of ANALYTICS_EVENT_ALLOWLIST) {
  assert.ok(EVENT_LABELS[eventName], `${eventName} should have an explicit display label`);
}

assert.equal(eventLabel("screen_view"), "Screen viewed");
assert.equal(eventLabel("route_step_view"), "Route step viewed");
assert.equal(metricLabel("active_users_estimate"), "Active users");
assert.equal(metricLabel("dropoff_pct"), "Drop-off");
assert.equal(metricLabel("no_result_rate"), "No-result rate");
assert.equal(propertyLabel("screen_time"), "Screen time");
assert.equal(platformLabel("ios"), "iOS");
assert.equal(humanizeKey("creator_id"), "Creator ID");
assert.equal(humanizeKey("click_through_rate").includes("_"), false);
assert.equal(formatPropertyValue("duration_ms", 1234), "1.2 s");
assert.equal(formatPropertyValue("screen_time", 12.4), "12.4 s");

const fields = formatAnalyticsJson({
  screen_name: "Home",
  screen_time: 12.4,
  nested_context: {
    query_hash: "hash-123",
  },
});

assert.deepEqual(
  fields.map((field) => [field.label, field.value]),
  [
    ["Screen name", "Home"],
    ["Screen time", "12.4 s"],
    ["Nested Context / Search fingerprint", "hash-123"],
  ],
);
