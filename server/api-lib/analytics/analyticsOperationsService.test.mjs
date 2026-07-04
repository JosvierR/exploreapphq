import assert from "node:assert/strict";
import {
  AnalyticsOperationsError,
  assertAnalyticsCronAuthorized,
  clampEventExplorerLimit,
  clampOffset,
  parseAnalyticsDay,
  resolveAggregationInput,
  resolveAggregationPreset,
  runAnalyticsAggregationForDay,
  runAnalyticsAggregationWindow,
} from "./analyticsOperationsService.mjs";

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function addUtcDays(day, delta) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

assert.equal(parseAnalyticsDay(todayUtc()), todayUtc(), "valid day accepted");
assert.throws(() => parseAnalyticsDay("not-a-date"), AnalyticsOperationsError, "invalid day rejected");
assert.throws(() => parseAnalyticsDay(addUtcDays(todayUtc(), 2)), AnalyticsOperationsError, "future day rejected");

assert.deepEqual(resolveAggregationPreset("today"), [todayUtc()], "today preset");
assert.deepEqual(resolveAggregationPreset("yesterday"), [addUtcDays(todayUtc(), -1)], "yesterday preset");
assert.equal(resolveAggregationPreset("last_7_days").length, 7, "last_7_days preset length");
assert.throws(() => resolveAggregationPreset("last_30_days"), AnalyticsOperationsError, "invalid preset rejected");

assert.deepEqual(resolveAggregationInput({ day: todayUtc() }), [todayUtc()], "day input");
assert.deepEqual(resolveAggregationInput({ preset: "today" }), [todayUtc()], "preset input");
assert.deepEqual(resolveAggregationInput({}), [addUtcDays(todayUtc(), -1), todayUtc()], "default cron window");
assert.throws(
  () => resolveAggregationInput({ day: todayUtc(), preset: "today" }),
  AnalyticsOperationsError,
  "day and preset together rejected",
);

const successClient = {
  async rpc() {
    return { data: null, error: null };
  },
};

const success = await runAnalyticsAggregationForDay(successClient, todayUtc(), { requestId: "req-1" });
assert.equal(success.ok, true, "null/void RPC response is success");
assert.equal(success.message, "Aggregation completed", "success message");

const failClient = {
  async rpc() {
    return { data: null, error: { code: "PGRST202", message: "Could not find the function in the schema cache" } };
  },
};
const failed = await runAnalyticsAggregationForDay(failClient, todayUtc());
assert.equal(failed.ok, false, "failed RPC returns ok=false");
assert.equal(failed.code, "analytics_rpc_not_found", "missing RPC code");

let attempts = 0;
const fallbackClient = {
  async rpc(_name, args) {
    attempts += 1;
    if (Object.prototype.hasOwnProperty.call(args, "target_day")) {
      return { data: null, error: { code: "PGRST202", message: "Could not find the function public.aggregate_analytics_events_for_day(target_day) in the schema cache" } };
    }
    if (Object.prototype.hasOwnProperty.call(args, "day")) {
      return { data: null, error: null };
    }
    return { data: null, error: { code: "PGRST202", message: "Could not find the function" } };
  },
};
const recovered = await runAnalyticsAggregationForDay(fallbackClient, todayUtc());
assert.equal(recovered.ok, true, "RPC recovers with alternate argument name");
assert.equal(recovered.param_name, "day", "uses day argument name");
assert.ok(attempts >= 2, "tries more than one argument name");

const windowResult = await runAnalyticsAggregationWindow(successClient, resolveAggregationPreset("last_7_days"));
assert.equal(windowResult.ok, true, "window aggregation succeeds");
assert.equal(windowResult.days.length, 7, "window returns 7 days");
await assert.rejects(
  () =>
    runAnalyticsAggregationWindow(successClient, [
      ...resolveAggregationPreset("last_7_days"),
      addUtcDays(todayUtc(), -7),
    ]),
  (error) => error instanceof AnalyticsOperationsError && error.code === "analytics_window_too_large",
  "window larger than 7 days rejected",
);

process.env.ANALYTICS_CRON_SECRET = "cron-secret-test";
assert.throws(
  () => assertAnalyticsCronAuthorized(new Request("https://example.com/api/cron/analytics/aggregate")),
  (error) => error instanceof AnalyticsOperationsError && error.status === 401,
  "missing cron secret rejected",
);
assert.throws(
  () =>
    assertAnalyticsCronAuthorized(
      new Request("https://example.com/api/cron/analytics/aggregate", {
        headers: { "x-cron-secret": "wrong" },
      }),
    ),
  (error) => error instanceof AnalyticsOperationsError && error.status === 401,
  "invalid cron secret rejected",
);
assert.doesNotThrow(
  () =>
    assertAnalyticsCronAuthorized(
      new Request("https://example.com/api/cron/analytics/aggregate", {
        headers: { "x-cron-secret": "cron-secret-test" },
      }),
    ),
  "valid x-cron-secret accepted",
);
assert.doesNotThrow(
  () =>
    assertAnalyticsCronAuthorized(
      new Request("https://example.com/api/cron/analytics/aggregate", {
        headers: { authorization: "Bearer cron-secret-test" },
      }),
    ),
  "valid bearer cron secret accepted",
);

delete process.env.ANALYTICS_CRON_SECRET;
delete process.env.CRON_SECRET;
assert.throws(
  () => assertAnalyticsCronAuthorized(new Request("https://example.com/api/cron/analytics/aggregate")),
  (error) => error instanceof AnalyticsOperationsError && error.code === "analytics_cron_not_configured",
  "missing configured secret returns 503",
);

assert.equal(clampEventExplorerLimit(200), 100, "event explorer limit capped at 100");
assert.equal(clampEventExplorerLimit(0), 50, "event explorer default limit");
assert.equal(clampOffset(-5), 0, "offset cannot be negative");

console.log("analyticsOperationsService tests passed");
