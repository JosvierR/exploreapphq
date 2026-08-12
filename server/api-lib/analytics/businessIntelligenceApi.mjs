import {
  BusinessIntelligenceError,
  getBusinessIntelligenceCategories,
  getBusinessIntelligenceCompare,
  getBusinessIntelligenceContentAttribution,
  getBusinessIntelligenceDashboard,
  getBusinessIntelligenceDefinitions,
  getBusinessIntelligenceDemand,
  getBusinessIntelligenceExecutiveSummary,
  getBusinessIntelligenceFunnel,
  getBusinessIntelligenceGeography,
  getBusinessIntelligenceHealth,
  getBusinessIntelligenceInsights,
  getBusinessIntelligenceMarkets,
  getBusinessIntelligenceMobileOverview,
  getBusinessIntelligenceOpportunities,
  getBusinessIntelligenceOverview,
  getBusinessIntelligenceAudience,
  getBusinessIntelligenceBenchmarks,
  getBusinessIntelligencePlaceDetail,
  getBusinessIntelligencePlaces,
  getBusinessIntelligenceRouteDetail,
  getBusinessIntelligenceRoutes,
  getBusinessIntelligenceSearches,
  getBusinessIntelligenceTime,
  getBusinessIntelligenceTimeseries,
  getBusinessIntelligenceUnmetDemand,
  resolveBusinessIntelligenceParams,
} from "./businessIntelligenceService.mjs";
import { requireBusinessAnalyticsAccess, scopeBusinessAnalyticsParams } from "./businessAccess.mjs";
import { jsonResponse, optionsResponse } from "../http/responses.mjs";
import { requestIdFromRequest } from "../http/requestContext.mjs";
import { requireAdmin } from "../moderation/supabaseModeration.mjs";
import { logger, requestLogMeta } from "../observability/logger.mjs";
import { serializeErrorForLog } from "./analyticsRouter.mjs";
import {
  businessCacheKey,
  businessCacheTtl,
  readThroughBusinessCache,
} from "./businessIntelligenceCache.mjs";

function queryMetadata(params, payload) {
  const warnings = Array.isArray(payload?.warnings) ? payload.warnings : [];
  const severe = warnings.some((item) => item?.severity === "error");
  const lowData = payload?.state === "low_sample" || warnings.some((item) => /low_sample|truncated|schema/i.test(item?.code || ""));
  const query = {
      geo_id: params.geo_id || null,
      from: params.start,
      to: params.end,
      category: params.category || params.category_id || null,
      business_id: params.business_id || null,
      location_id: params.location_id || null,
      platform: params.platform || null,
      source: params.source || null,
    };
  const dataQualityGrade = severe ? "error" : lowData ? "limited" : "high";
  return {
    query,
    metric_version: "business-v2",
    data_quality_grade: dataQualityGrade,
    query_metadata: { query, metric_version: "business-v2", data_quality: dataQualityGrade },
  };
}

function methodNotAllowed(request) {
  return jsonResponse(405, { ok: false, error: "Method not allowed.", request_id: requestIdFromRequest(request) });
}

function failure(request, route, error, diagnostics) {
  const requestId = requestIdFromRequest(request);
  if (error instanceof BusinessIntelligenceError) {
    return jsonResponse(error.status, {
      ok: false,
      error: error.message,
      code: error.code,
      request_id: requestId,
      diagnostics,
    });
  }
  const status = error?.status || 500;
  if (status === 401 || status === 403 || status === 400) {
    return jsonResponse(status, {
      ok: false,
      error: error?.message || (status === 401 ? "Authentication required." : "Access denied."),
      code: error?.code,
      request_id: requestId,
      diagnostics,
    });
  }
  logger.error("Business intelligence failure", {
    ...requestLogMeta(request, route),
    error: serializeErrorForLog(error),
  });
  return jsonResponse(500, {
    ok: false,
    error: "Business intelligence request failed.",
    request_id: requestId,
    diagnostics,
  });
}

async function handleBusinessLoader(request, route, loader, options = {}) {
  const started = Date.now();
  let diagnostics = null;
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed(request);
    const access = await requireBusinessAnalyticsAccess(request, options.entitlement || "VIEW_OWN_ANALYTICS");
    diagnostics = {
      actor_type: access.actor_type,
      business_role: access.role,
      access_scope: options.scope || "own",
    };
    let params = resolveBusinessIntelligenceParams(request);
    if (options.placeId) params.place_id = options.placeId;
    if (options.routeId) params.route_id = options.routeId;
    params = scopeBusinessAnalyticsParams(params, access, options.scope || "own");
    const cached = await readThroughBusinessCache(
      businessCacheKey(route, params, access),
      businessCacheTtl(params),
      () => loader(access.supabase, params),
    );
    const payload = cached.value;
    diagnostics.cache_hit = cached.cache_hit;
    logger.info("Business analytics request", {
      ...requestLogMeta(request, route),
      event: "analytics_request",
      business_id: access.business_id,
      geo_id: params.geo_id,
      endpoint: route,
      duration_ms: Date.now() - started,
      cache_hit: cached.cache_hit,
      rows_scanned: payload?.data_quality?.event_count ?? payload?.analytics_health?.events_received ?? null,
      status: 200,
    });
    return jsonResponse(200, {
      ok: true,
      request_id: requestIdFromRequest(request),
      ...payload,
      ...queryMetadata(params, payload),
      diagnostics,
    });
  } catch (error) {
    return failure(request, route, error, diagnostics);
  }
}

async function handleLoader(request, route, loader) {
  const started = Date.now();
  let diagnostics = null;
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed(request);
    const admin = await requireAdmin(request);
    diagnostics = { admin_role: admin?.role || null };
    const params = resolveBusinessIntelligenceParams(request);
    params.access_scope = "admin_global";
    const cached = await readThroughBusinessCache(
      businessCacheKey(route, params, { actor_type: "admin" }),
      businessCacheTtl(params),
      () => loader(admin.supabase, params),
    );
    const payload = cached.value;
    diagnostics.cache_hit = cached.cache_hit;
    logger.info("Business analytics request", {
      ...requestLogMeta(request, route),
      event: "analytics_request",
      business_id: params.business_id || null,
      geo_id: params.geo_id,
      endpoint: route,
      duration_ms: Date.now() - started,
      cache_hit: cached.cache_hit,
      rows_scanned: payload?.data_quality?.event_count ?? payload?.analytics_health?.events_received ?? null,
      status: 200,
    });
    return jsonResponse(200, {
      ok: true,
      request_id: requestIdFromRequest(request),
      ...payload,
      ...queryMetadata(params, payload),
      diagnostics,
    });
  } catch (error) {
    return failure(request, route, error, diagnostics);
  }
}

export async function handleBusinessIntelDashboard(request) {
  return handleLoader(request, "admin/business/dashboard", getBusinessIntelligenceDashboard);
}

export async function handleBusinessIntelOverview(request) {
  return handleLoader(request, "admin/business/overview", getBusinessIntelligenceOverview);
}

export async function handleBusinessIntelGeography(request) {
  return handleLoader(request, "admin/business/geography", getBusinessIntelligenceGeography);
}

export async function handleBusinessIntelMarkets(request) {
  return handleLoader(request, "admin/business/markets", getBusinessIntelligenceMarkets);
}

export async function handleBusinessIntelPlaces(request) {
  return handleLoader(request, "admin/business/places", getBusinessIntelligencePlaces);
}

export async function handleBusinessIntelRoutes(request) {
  return handleLoader(request, "admin/business/routes", getBusinessIntelligenceRoutes);
}

export async function handleBusinessIntelCategories(request) {
  return handleLoader(request, "admin/business/categories", getBusinessIntelligenceCategories);
}

export async function handleBusinessIntelTimeseries(request) {
  return handleLoader(request, "admin/business/timeseries", getBusinessIntelligenceTimeseries);
}

export async function handleBusinessIntelFunnel(request) {
  return handleLoader(request, "admin/business/funnel", getBusinessIntelligenceFunnel);
}

export async function handleBusinessIntelSearches(request) {
  return handleLoader(request, "admin/business/searches", getBusinessIntelligenceSearches);
}

export async function handleBusinessIntelOpportunities(request) {
  return handleLoader(request, "admin/business/opportunities", getBusinessIntelligenceOpportunities);
}

export async function handleBusinessIntelContentAttribution(request) {
  return handleLoader(request, "admin/business/content-attribution", getBusinessIntelligenceContentAttribution);
}

export async function handleBusinessIntelExecutiveSummary(request) {
  return handleLoader(request, "admin/business/executive-summary", getBusinessIntelligenceExecutiveSummary);
}

export async function handleBusinessIntelCompare(request) {
  return handleLoader(request, "admin/business/compare", getBusinessIntelligenceCompare);
}

export async function handleBusinessIntelDemand(request) {
  return handleLoader(request, "admin/business/demand", getBusinessIntelligenceDemand);
}

export async function handleBusinessIntelAudience(request) {
  return handleLoader(request, "admin/business/audience", getBusinessIntelligenceAudience);
}

export async function handleBusinessIntelTime(request) {
  return handleLoader(request, "admin/business/time", getBusinessIntelligenceTime);
}

export async function handleBusinessIntelInsights(request) {
  return handleLoader(request, "admin/business/insights", getBusinessIntelligenceInsights);
}

export async function handleBusinessIntelBenchmarks(request) {
  return handleLoader(request, "admin/business/benchmarks", getBusinessIntelligenceBenchmarks);
}

export async function handleBusinessIntelMobileOverview(request) {
  return handleLoader(request, "admin/business/mobile-overview", getBusinessIntelligenceMobileOverview);
}

export async function handleBusinessIntelDefinitions(request) {
  return handleLoader(request, "admin/business/definitions", async () => getBusinessIntelligenceDefinitions());
}

export async function handleBusinessIntelHealth(request) {
  return handleLoader(request, "admin/business/health", getBusinessIntelligenceHealth);
}

export const ADMIN_BUSINESS_INTEL_ROUTES = {
  "admin/business/dashboard": handleBusinessIntelDashboard,
  "admin/business/overview": handleBusinessIntelOverview,
  "admin/business/geography": handleBusinessIntelGeography,
  "admin/business/markets": handleBusinessIntelMarkets,
  "admin/business/places": handleBusinessIntelPlaces,
  "admin/business/routes": handleBusinessIntelRoutes,
  "admin/business/categories": handleBusinessIntelCategories,
  "admin/business/timeseries": handleBusinessIntelTimeseries,
  "admin/business/funnel": handleBusinessIntelFunnel,
  "admin/business/searches": handleBusinessIntelSearches,
  "admin/business/opportunities": handleBusinessIntelOpportunities,
  "admin/business/content-attribution": handleBusinessIntelContentAttribution,
  "admin/business/executive-summary": handleBusinessIntelExecutiveSummary,
  "admin/business/compare": handleBusinessIntelCompare,
  "admin/business/demand": handleBusinessIntelDemand,
  "admin/business/audience": handleBusinessIntelAudience,
  "admin/business/time": handleBusinessIntelTime,
  "admin/business/insights": handleBusinessIntelInsights,
  "admin/business/benchmarks": handleBusinessIntelBenchmarks,
  "admin/business/mobile-overview": handleBusinessIntelMobileOverview,
  "admin/business/definitions": handleBusinessIntelDefinitions,
  "admin/business/health": handleBusinessIntelHealth,
};

export async function dispatchBusinessIntelligenceApi(request, route) {
  const handler = ADMIN_BUSINESS_INTEL_ROUTES[route];
  if (!handler) {
    return jsonResponse(404, { ok: false, error: "Not found.", request_id: requestIdFromRequest(request) });
  }
  return handler(request);
}

const BUSINESS_V1_ROUTES = {
  "business/v1/overview": { loader: getBusinessIntelligenceOverview, entitlement: "VIEW_OWN_ANALYTICS", scope: "own" },
  "business/v1/executive-summary": { loader: getBusinessIntelligenceExecutiveSummary, entitlement: "VIEW_OWN_ANALYTICS", scope: "own" },
  "business/v1/mobile-overview": { loader: getBusinessIntelligenceMobileOverview, entitlement: "VIEW_OWN_ANALYTICS", scope: "own" },
  "business/v1/geography": { loader: getBusinessIntelligenceGeography, entitlement: "VIEW_MARKET_ANALYTICS", scope: "market" },
  "business/v1/markets": { loader: getBusinessIntelligenceMarkets, entitlement: "VIEW_MARKET_ANALYTICS", scope: "market" },
  "business/v1/compare": { loader: getBusinessIntelligenceCompare, entitlement: "VIEW_MARKET_ANALYTICS", scope: "market" },
  "business/v1/demand": { loader: getBusinessIntelligenceDemand, entitlement: "VIEW_MARKET_ANALYTICS", scope: "market" },
  "business/v1/categories": { loader: getBusinessIntelligenceCategories, entitlement: "VIEW_MARKET_ANALYTICS", scope: "market" },
  "business/v1/searches": { loader: getBusinessIntelligenceSearches, entitlement: "VIEW_SEARCH_INTELLIGENCE", scope: "market" },
  "business/v1/unmet-demand": { loader: getBusinessIntelligenceUnmetDemand, entitlement: "VIEW_SEARCH_INTELLIGENCE", scope: "market" },
  "business/v1/places": { loader: getBusinessIntelligencePlaces, entitlement: "VIEW_OWN_ANALYTICS", scope: "own" },
  "business/v1/routes": { loader: getBusinessIntelligenceRoutes, entitlement: "VIEW_MARKET_ANALYTICS", scope: "market" },
  "business/v1/audience": { loader: getBusinessIntelligenceAudience, entitlement: "VIEW_AUDIENCE", scope: "own" },
  "business/v1/time": { loader: getBusinessIntelligenceTime, entitlement: "VIEW_OWN_ANALYTICS", scope: "own" },
  "business/v1/content-attribution": { loader: getBusinessIntelligenceContentAttribution, entitlement: "VIEW_ATTRIBUTION", scope: "own" },
  "business/v1/funnel": { loader: getBusinessIntelligenceFunnel, entitlement: "VIEW_OWN_ANALYTICS", scope: "own" },
  "business/v1/opportunities": { loader: getBusinessIntelligenceOpportunities, entitlement: "VIEW_OPPORTUNITIES", scope: "market" },
  "business/v1/insights": { loader: getBusinessIntelligenceInsights, entitlement: "VIEW_OWN_ANALYTICS", scope: "own" },
  "business/v1/benchmarks": { loader: getBusinessIntelligenceBenchmarks, entitlement: "VIEW_COMPETITIVE_BENCHMARKS", scope: "own" },
  "business/v1/definitions": { loader: async () => getBusinessIntelligenceDefinitions(), entitlement: "VIEW_OWN_ANALYTICS", scope: "own" },
};

export async function dispatchBusinessV1Api(request, route) {
  const placeMatch = route.match(/^business\/v1\/places\/([^/]+)$/);
  if (placeMatch) {
    return handleBusinessLoader(request, route, getBusinessIntelligencePlaceDetail, {
      entitlement: "VIEW_OWN_ANALYTICS",
      scope: "own",
      placeId: decodeURIComponent(placeMatch[1]),
    });
  }
  const routeMatch = route.match(/^business\/v1\/routes\/([^/]+)$/);
  if (routeMatch) {
    return handleBusinessLoader(request, route, getBusinessIntelligenceRouteDetail, {
      entitlement: "VIEW_MARKET_ANALYTICS",
      scope: "market",
      routeId: decodeURIComponent(routeMatch[1]),
    });
  }
  const config = BUSINESS_V1_ROUTES[route];
  if (!config) {
    return jsonResponse(404, { ok: false, error: "Not found.", request_id: requestIdFromRequest(request) });
  }
  return handleBusinessLoader(request, route, config.loader, config);
}
