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

let rpcArgs = null;
const successClient = {
  async rpc(name, args) {
    assert.equal(name, "aggregate_analytics_events_for_day", "RPC name is correct");
    rpcArgs = args;
    // VOID function: data null, error null
    return { data: null, error: null };
  },
};

const success = await runAnalyticsAggregationForDay(successClient, todayUtc(), { requestId: "req-1" });
assert.equal(success.ok, true, "null/void RPC response is success");
assert.equal(success.message, "Aggregation completed", "success message");
assert.deepEqual(rpcArgs, { target_day: todayUtc() }, "RPC is called with { target_day: day }");
assert.equal(Object.prototype.hasOwnProperty.call(rpcArgs, "day"), false, "RPC is not called with { day }");

let invalidDateCalled = false;
const guardClient = {
  async rpc() {
    invalidDateCalled = true;
    return { data: null, error: null };
  },
};
assert.throws(() => parseAnalyticsDay("bad"), AnalyticsOperationsError, "invalid date rejected before RPC");
try {
  await runAnalyticsAggregationForDay(guardClient, "bad-date");
} catch {
  // parseAnalyticsDay throws inside runAnalyticsAggregationForDay before rpc
}
assert.equal(invalidDateCalled, false, "invalid date never reaches RPC");

const failClient = {
  async rpc(_name, args) {
    assert.deepEqual(args, { target_day: todayUtc() }, "failed RPC still uses target_day");
    return {
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function",
        details: "Searched for aggregate_analytics_events_for_day",
        hint: "Check the function name",
      },
    };
  },
};
const failed = await runAnalyticsAggregationForDay(failClient, todayUtc());
assert.equal(failed.ok, false, "failed RPC returns ok=false");
assert.equal(failed.code, "analytics_rpc_not_found", "missing RPC code");
assert.equal(failed.param_name, "target_day", "failure records target_day");
assert.equal(failed.error.code, "PGRST202", "safe error code logged");
assert.ok(failed.error.message, "safe error message logged");
assert.ok(failed.error.details, "safe error details logged");
assert.ok(failed.error.hint, "safe error hint logged");

const genericFailClient = {
  async rpc() {
    return { data: null, error: { code: "XX000", message: "internal error" } };
  },
};
const genericFailed = await runAnalyticsAggregationForDay(genericFailClient, todayUtc());
assert.equal(genericFailed.code, "analytics_aggregation_failed", "generic RPC error code");

const unsafeDeleteClient = {
  async rpc() {
    return { data: null, error: { code: "21000", message: "DELETE requires a WHERE clause" } };
  },
};
const unsafeDelete = await runAnalyticsAggregationForDay(unsafeDeleteClient, todayUtc());
assert.equal(unsafeDelete.code, "analytics_rpc_unsafe_mutation", "unsafe DELETE maps to dedicated code");
assert.match(unsafeDelete.message, /SECURITY DEFINER|WHERE/i, "unsafe DELETE message is actionable");

const digestClient = {
  async rpc() {
    return {
      data: null,
      error: {
        code: "42883",
        message: "function digest(text, unknown) does not exist",
        hint: "No function matches the given name and argument types.",
      },
    };
  },
};
const digestFailed = await runAnalyticsAggregationForDay(digestClient, todayUtc());
assert.equal(digestFailed.code, "analytics_rpc_missing_extension", "missing digest maps to extension code");
assert.match(digestFailed.message, /extensions|digest/i, "digest error message is actionable");

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

// Cron path uses service-role client after secret auth (no admin session).
assert.equal(
  (await import("node:fs")).readFileSync(new URL("./analyticsAdminApi.mjs", import.meta.url), "utf8").includes(
    'trigger === "cron"',
  ),
  true,
  "cron aggregation path exists",
);
const adminApiSource = (await import("node:fs")).readFileSync(new URL("./analyticsAdminApi.mjs", import.meta.url), "utf8");
assert.match(adminApiSource, /assertAnalyticsCronAuthorized\(request\)/, "cron uses secret auth");
assert.match(adminApiSource, /createServiceClient\(\)/, "cron uses service-role client");
assert.match(adminApiSource, /client: "service_role"/, "cron logs service_role client");
assert.doesNotMatch(adminApiSource, /requireAdminContext\(request\);\s*supabase = admin\.supabase/, "cron does not use admin session client for RPC");

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
