import { requireUser } from "../moderation/supabaseModeration.mjs";

export class BusinessAccessError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = "BusinessAccessError";
    this.status = status;
    this.code = code;
  }
}

export function resolveBusinessMembership(memberRows, requestedBusinessId = null) {
  const rows = memberRows || [];
  if (!rows.length) {
    throw new BusinessAccessError(403, "This account is not a member of a Business account.", "business_membership_required");
  }
  const membership = requestedBusinessId
    ? rows.find((row) => row.business_id === requestedBusinessId)
    : rows.length === 1
      ? rows[0]
      : null;
  if (!membership) {
    throw new BusinessAccessError(
      requestedBusinessId ? 403 : 400,
      requestedBusinessId ? "Access to this Business account is not allowed." : "business_id is required when the user has multiple Business accounts.",
      requestedBusinessId ? "business_access_denied" : "business_id_required",
    );
  }
  return membership;
}

export function resolveActiveEntitlements(rows, now = Date.now()) {
  return (rows || [])
    .filter((row) => {
      if (!row?.enabled) return false;
      if (!row.expires_at) return true;
      return Date.parse(row.expires_at) > now;
    })
    .map((row) => row.entitlement);
}

export function assertBusinessFeatureEnabled(account) {
  if (!account || account.status !== "active") {
    throw new BusinessAccessError(403, "The Business account is not active.", "business_account_inactive");
  }
  if (!account.bi_v2_enabled) {
    throw new BusinessAccessError(403, "Business Intelligence v2 is not enabled for this account.", "business_intelligence_v2_disabled");
  }
}

export function assertBusinessEntitlement(entitlements, requiredEntitlement) {
  const aliases = {
    VIEW_COMPETITIVE_BENCHMARKS: ["VIEW_COMPETITIVE_BENCHMARKS", "VIEW_BENCHMARKS"],
    VIEW_BENCHMARKS: ["VIEW_BENCHMARKS", "VIEW_COMPETITIVE_BENCHMARKS"],
  };
  const accepted = aliases[requiredEntitlement] || [requiredEntitlement];
  if (requiredEntitlement && !accepted.some((item) => entitlements.includes(item))) {
    throw new BusinessAccessError(403, `This account is not entitled to ${requiredEntitlement}.`, "business_entitlement_required");
  }
}

function activeMarketAccess(row) {
  const now = Date.now();
  if (row?.starts_at && Date.parse(row.starts_at) > now) return false;
  if (!row?.expires_at) return true;
  return Date.parse(row.expires_at) > now;
}

/**
 * Resolve the authenticated actor once and enforce Business membership and
 * feature entitlement server-side. Admins receive global scope through the
 * same analytics service; external accounts receive only authorized scope.
 */
export async function requireBusinessAnalyticsAccess(request, requiredEntitlement = "VIEW_OWN_ANALYTICS") {
  const context = await requireUser(request);
  const url = new URL(request.url);
  const requestedBusinessId = (url.searchParams.get("business_id") || "").trim() || null;
  const requestedLocationId = (url.searchParams.get("location_id") || "").trim() || null;

  const adminResult = await context.supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", context.user.id)
    .maybeSingle();
  if (adminResult.data && ["admin", "moderator"].includes(adminResult.data.role)) {
    return {
      ...context,
      actor_type: "admin",
      admin_role: adminResult.data.role,
      business_id: requestedBusinessId,
      location_id: requestedLocationId,
      role: adminResult.data.role,
      entitlements: ["*"],
      locations: [],
      authorized_place_ids: null,
    };
  }

  const memberships = await context.supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", context.user.id);
  if (memberships.error) {
    throw new BusinessAccessError(503, "Business account access is not configured.", "business_access_unavailable");
  }
  const membership = resolveBusinessMembership(memberships.data || [], requestedBusinessId);

  const [accountResult, locationResult, entitlementResult, marketAccessResult] = await Promise.all([
    context.supabase
      .from("business_accounts")
      .select("id, name, type, industry, country, status, plan, bi_v2_enabled")
      .eq("id", membership.business_id)
      .maybeSingle(),
    context.supabase
      .from("business_locations")
      .select("id, business_id, place_id, geo_id, name, status")
      .eq("business_id", membership.business_id)
      .eq("status", "active"),
    context.supabase
      .from("business_entitlements")
      .select("entitlement, enabled, source, expires_at")
      .eq("business_id", membership.business_id),
    context.supabase
      .from("business_market_access")
      .select("geo_id, access_type, starts_at, expires_at")
      .eq("business_id", membership.business_id),
  ]);

  if (accountResult.error) throw new BusinessAccessError(503, "Business authorization could not be evaluated.", "business_access_unavailable");
  assertBusinessFeatureEnabled(accountResult.data);
  if (locationResult.error || entitlementResult.error || marketAccessResult.error) {
    throw new BusinessAccessError(503, "Business authorization could not be evaluated.", "business_access_unavailable");
  }

  const entitlements = resolveActiveEntitlements(entitlementResult.data || []);
  assertBusinessEntitlement(entitlements, requiredEntitlement);

  const locations = locationResult.data || [];
  const marketGeoIds = [
    ...locations.map((row) => row.geo_id),
    ...(marketAccessResult.data || []).filter(activeMarketAccess).map((row) => row.geo_id),
  ].filter(Boolean);
  const selectedLocation = requestedLocationId ? locations.find((row) => row.id === requestedLocationId) : null;
  if (requestedLocationId && !selectedLocation) {
    throw new BusinessAccessError(403, "Access to this Business location is not allowed.", "business_location_denied");
  }

  return {
    ...context,
    actor_type: "business",
    account: accountResult.data,
    business_id: membership.business_id,
    location_id: selectedLocation?.id || null,
    role: membership.role,
    entitlements,
    locations,
    selected_location: selectedLocation,
    authorized_place_ids: selectedLocation ? [selectedLocation.place_id] : locations.map((row) => row.place_id),
    authorized_market_geo_ids: [...new Set(marketGeoIds)],
  };
}

export function scopeBusinessAnalyticsParams(params, access, scope = "own") {
  if (access.actor_type === "admin") return { ...params, access_scope: "admin_global" };
  const next = {
    ...params,
    business_id: access.business_id,
    location_id: access.location_id,
    access_scope: scope === "market" ? "purchased_market" : "authorized_locations",
  };
  if (scope === "market") {
    const allowedGeoIds = access.authorized_market_geo_ids || [];
    if (!allowedGeoIds.length) {
      throw new BusinessAccessError(403, "No market has been granted to this Business account.", "business_market_access_required");
    }
    if (params.geo_id && !allowedGeoIds.includes(params.geo_id)) {
      throw new BusinessAccessError(403, "Access to this market is not allowed.", "business_market_denied");
    }
    if (!params.geo_id) {
      if (allowedGeoIds.length !== 1) {
        throw new BusinessAccessError(400, "geo_id is required when the account can access multiple markets.", "business_market_required");
      }
      next.geo_id = allowedGeoIds[0];
    }
    next.authorized_market_geo_ids = allowedGeoIds;
  } else {
    next.authorized_place_ids = access.authorized_place_ids;
    if (access.selected_location) next.place_id = access.selected_location.place_id;
    if (params.place_id && !access.authorized_place_ids.includes(params.place_id)) {
      throw new BusinessAccessError(403, "Access to this place is not allowed.", "business_place_denied");
    }
  }
  return next;
}
