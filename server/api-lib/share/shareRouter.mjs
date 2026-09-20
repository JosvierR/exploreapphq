import { jsonResponse, optionsResponse } from "../http/responses.mjs";
import { requestIdFromRequest } from "../http/requestContext.mjs";
import { handleApiError } from "../observability/errors.mjs";
import { getPublicRoutePreview } from "./publicRoutePreview.mjs";

export async function handlePublicRoutePreview(request, route) {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "GET") {
    return jsonResponse(405, { ok: false, error: "Method not allowed." });
  }

  const match = /^public\/routes\/(.+)$/.exec(route);
  const ref = match?.[1] ? decodeURIComponent(match[1]) : "";
  const requestId = requestIdFromRequest(request);

  try {
    const payload = await getPublicRoutePreview(ref);
    if (!payload.ok) {
      return jsonResponse(payload.status || 404, {
        ok: false,
        error: payload.error || "Route not found.",
        code: payload.code || undefined,
        request_id: requestId,
      });
    }

    return jsonResponse(200, {
      ok: true,
      request_id: requestId,
      preview: payload.preview,
    });
  } catch (error) {
    return handleApiError(error, request, { route: "public/routes", domain: "share" });
  }
}
