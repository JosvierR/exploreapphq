import { jsonResponse, optionsResponse } from "../http/responses.mjs";
import { requestIdFromRequest } from "../http/requestContext.mjs";
import { handleApiError } from "../observability/errors.mjs";
import { getPioneersLandingData } from "./pioneersService.mjs";

function parseRange(url) {
  const value = url.searchParams.get("range");
  return value === "30d" ? "30d" : "7d";
}

function parseCategory(url) {
  const value = url.searchParams.get("category");
  if (value === "videos" || value === "routes" || value === "places" || value === "total") return value;
  return "total";
}

export async function handlePioneersLanding(request) {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "GET") {
    return jsonResponse(405, { ok: false, error: "Method not allowed." });
  }

  const url = new URL(request.url);
  const range = parseRange(url);
  const category = parseCategory(url);
  const requestId = requestIdFromRequest(request);

  try {
    const payload = await getPioneersLandingData({ range, category });
    if (!payload.ok) {
      return jsonResponse(503, {
        ok: false,
        error: "Pioneers data is not available.",
        code: payload.reason || "pioneers_unavailable",
        request_id: requestId,
      });
    }

    return jsonResponse(200, {
      ok: true,
      request_id: requestId,
      ...payload,
    });
  } catch (error) {
    return handleApiError(error, request, { route: "pioneers/landing", domain: "pioneers" });
  }
}
