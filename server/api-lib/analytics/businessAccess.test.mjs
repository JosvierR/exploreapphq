import assert from "node:assert/strict";
import test from "node:test";
import {
  assertBusinessEntitlement,
  assertBusinessFeatureEnabled,
  BusinessAccessError,
  resolveActiveEntitlements,
  resolveBusinessMembership,
  scopeBusinessAnalyticsParams,
} from "./businessAccess.mjs";

test("Business A cannot select Business B by changing business_id", () => {
  assert.throws(
    () => resolveBusinessMembership([{ business_id: "business-a", role: "viewer" }], "business-b"),
    (error) => error instanceof BusinessAccessError && error.code === "business_access_denied",
  );
});

test("external place and location scope never becomes global", () => {
  const access = {
    actor_type: "business",
    business_id: "business-a",
    location_id: "location-a",
    selected_location: { id: "location-a", place_id: "place-a" },
    authorized_place_ids: ["place-a"],
    authorized_market_geo_ids: ["geo-a"],
  };
  const scoped = scopeBusinessAnalyticsParams({}, access, "own");
  assert.deepEqual(scoped.authorized_place_ids, ["place-a"]);
  assert.equal(scoped.place_id, "place-a");
  assert.throws(
    () => scopeBusinessAnalyticsParams({ place_id: "place-b" }, access, "own"),
    (error) => error instanceof BusinessAccessError && error.code === "business_place_denied",
  );
});

test("market grants prevent geo_id tampering", () => {
  const access = {
    actor_type: "business",
    business_id: "business-a",
    authorized_market_geo_ids: ["geo-a"],
    authorized_place_ids: [],
  };
  assert.equal(scopeBusinessAnalyticsParams({}, access, "market").geo_id, "geo-a");
  assert.throws(
    () => scopeBusinessAnalyticsParams({ geo_id: "geo-b" }, access, "market"),
    (error) => error instanceof BusinessAccessError && error.code === "business_market_denied",
  );
});

test("feature flag blocks external accounts until explicitly enabled", () => {
  assert.throws(
    () => assertBusinessFeatureEnabled({ status: "active", bi_v2_enabled: false }),
    (error) => error instanceof BusinessAccessError && error.code === "business_intelligence_v2_disabled",
  );
  assert.doesNotThrow(() => assertBusinessFeatureEnabled({ status: "active", bi_v2_enabled: true }));
});

test("entitlements are enforced server-side and expired grants are ignored", () => {
  const entitlements = resolveActiveEntitlements([
    { entitlement: "VIEW_OWN_ANALYTICS", enabled: true, expires_at: null },
    { entitlement: "VIEW_SEARCH_INTELLIGENCE", enabled: true, expires_at: "2020-01-01T00:00:00.000Z" },
    { entitlement: "EXPORT_REPORTS", enabled: false, expires_at: null },
  ]);
  assert.deepEqual(entitlements, ["VIEW_OWN_ANALYTICS"]);
  assert.doesNotThrow(() => assertBusinessEntitlement(entitlements, "VIEW_OWN_ANALYTICS"));
  assert.throws(
    () => assertBusinessEntitlement(entitlements, "VIEW_SEARCH_INTELLIGENCE"),
    (error) => error instanceof BusinessAccessError && error.code === "business_entitlement_required",
  );
  for (const entitlement of ["VIEW_MARKET_ANALYTICS", "VIEW_BENCHMARKS", "EXPORT_REPORTS"]) {
    assert.throws(
      () => assertBusinessEntitlement(entitlements, entitlement),
      (error) => error instanceof BusinessAccessError && error.code === "business_entitlement_required",
    );
  }
  assert.doesNotThrow(() => assertBusinessEntitlement(["VIEW_COMPETITIVE_BENCHMARKS"], "VIEW_BENCHMARKS"));
});

test("Admin remains a globally scoped consumer of the same analytics core", () => {
  const params = { geo_id: "any-geo", business_id: "any-business" };
  assert.deepEqual(scopeBusinessAnalyticsParams(params, { actor_type: "admin" }, "market"), {
    ...params,
    access_scope: "admin_global",
  });
});
