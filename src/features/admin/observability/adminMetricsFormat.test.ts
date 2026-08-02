import assert from "node:assert/strict";
import {
  counterBreakdownByLabel,
  errorRatePercent,
  formatPercent,
  humanizeMetricName,
  metricValue,
  topNamedCounters,
  type MetricBreakdownRow,
} from "./adminMetricsFormat";
import type { AdminMetricsSnapshot } from "./adminObservabilityApi";

const sample: AdminMetricsSnapshot = {
  ok: true,
  request_id: "test",
  generated_at: new Date().toISOString(),
  note: "test",
  counters: [
    { name: "explore_api_requests_total", labels: { route: "/api/health" }, value: 10 },
    { name: "explore_api_requests_total", labels: { route: "/api/admin/me" }, value: 4 },
    { name: "explore_api_errors_total", labels: { route: "/api/admin/me" }, value: 2 },
    { name: "explore_auth_failures_total", labels: { reason: "invalid_token" }, value: 3 },
  ],
  timers: [],
};

assert.equal(metricValue(sample, "explore_api_requests_total"), 14);
assert.equal(errorRatePercent(sample)?.toFixed(1), ((2 / 14) * 100).toFixed(1));
assert.equal(formatPercent(12.34), "12%");
assert.equal(humanizeMetricName("explore_api_errors_total"), "api errors");

const byRoute: MetricBreakdownRow[] = counterBreakdownByLabel(sample, "explore_api_requests_total", "route");
assert.deepEqual(
  byRoute.map((row) => row.label),
  ["/api/health", "/api/admin/me"],
);
assert.equal(byRoute[0]?.value, 10);

const named = topNamedCounters(sample, ["explore_api_requests_total", "explore_auth_failures_total"]);
assert.equal(named[0]?.value, 14);
assert.equal(named[1]?.value, 3);

console.log("adminMetricsFormat tests passed");
