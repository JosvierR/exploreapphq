import { jsonResponse, optionsResponse } from "../http/responses.mjs";
import { requestIdFromRequest } from "../http/requestContext.mjs";
import { requireAdmin } from "../moderation/supabaseModeration.mjs";
import { errorSummary, logger, requestLogMeta } from "../observability/logger.mjs";
import { buildMinimalOpenApiSpec, isOpenApiSurface } from "./minimalSpecs.mjs";
import {
  fetchLivePostgrestOpenApi,
  openApiJsonResponse,
  postgrestOpenApiConfigStatus,
} from "./postgrestOpenApi.mjs";

function methodNotAllowed(request) {
  return jsonResponse(405, {
    ok: false,
    error: "Method not allowed.",
    request_id: requestIdFromRequest(request),
  });
}

/**
 * GET /api/admin/openapi/{postgrest|edge|admin}
 * Admin-only OpenAPI 3.1 documents.
 *
 * @param {Request} request
 * @param {string} route  Resolved route without `/api/` prefix (e.g. `admin/openapi/postgrest`)
 */
export async function dispatchOpenApiDocs(request, route) {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "GET") return methodNotAllowed(request);

  const surface = String(route || "").replace(/^admin\/openapi\//, "");
  if (!isOpenApiSurface(surface)) {
    return jsonResponse(404, {
      ok: false,
      error: "Not found.",
      request_id: requestIdFromRequest(request),
    });
  }

  try {
    await requireAdmin(request);

    if (surface === "postgrest") {
      const { json, cache } = await fetchLivePostgrestOpenApi();
      return openApiJsonResponse(request, 200, json, {
        "Cache-Control": "private, max-age=60",
        "X-Explore-OpenAPI-Cache": cache,
      });
    }

    return jsonResponse(200, buildMinimalOpenApiSpec(surface), {
      "Cache-Control": "no-store",
    });
  } catch (error) {
    logger.warn("Admin OpenAPI docs failed", {
      ...requestLogMeta(request, route),
      surface,
      config: surface === "postgrest" ? postgrestOpenApiConfigStatus() : undefined,
      error: errorSummary(error),
      code: error?.code,
    });
    const status = error?.status || 500;
    const message =
      status === 401
        ? "Authentication required."
        : status === 403
          ? "Access denied."
          : status === 503
            ? error?.message || "PostgREST OpenAPI is not configured."
            : status === 502
              ? error?.message || "Failed to load live PostgREST OpenAPI."
              : "Internal server error";
    return jsonResponse(status, {
      ok: false,
      error: message,
      code: error?.code,
      request_id: requestIdFromRequest(request),
    });
  }
}

/**
 * @param {string} route
 */
export function isOpenApiDocsRoute(route) {
  return /^admin\/openapi\/(postgrest|edge|admin)$/.test(route);
}
