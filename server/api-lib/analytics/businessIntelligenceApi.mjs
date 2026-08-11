import {
  BusinessIntelligenceError,
  getBusinessIntelligenceCategories,
  getBusinessIntelligenceContentAttribution,
  getBusinessIntelligenceDashboard,
  getBusinessIntelligenceFunnel,
  getBusinessIntelligenceGeography,
  getBusinessIntelligenceMarkets,
  getBusinessIntelligenceOpportunities,
  getBusinessIntelligenceOverview,
  getBusinessIntelligencePlaces,
  getBusinessIntelligenceRoutes,
  getBusinessIntelligenceSearches,
  getBusinessIntelligenceTimeseries,
  resolveBusinessIntelligenceParams,
} from "./businessIntelligenceService.mjs";
import { jsonResponse, optionsResponse } from "../http/responses.mjs";
import { requestIdFromRequest } from "../http/requestContext.mjs";
import { requireAdmin } from "../moderation/supabaseModeration.mjs";
import { logger, requestLogMeta } from "../observability/logger.mjs";
import { serializeErrorForLog } from "./analyticsRouter.mjs";

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

async function handleLoader(request, route, loader) {
  let diagnostics = null;
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed(request);
    const admin = await requireAdmin(request);
    diagnostics = { admin_role: admin?.role || null };
    const params = resolveBusinessIntelligenceParams(request);
    const payload = await loader(admin.supabase, params);
    return jsonResponse(200, {
      ok: true,
      request_id: requestIdFromRequest(request),
      ...payload,
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
};

export async function dispatchBusinessIntelligenceApi(request, route) {
  const handler = ADMIN_BUSINESS_INTEL_ROUTES[route];
  if (!handler) {
    return jsonResponse(404, { ok: false, error: "Not found.", request_id: requestIdFromRequest(request) });
  }
  return handler(request);
}
