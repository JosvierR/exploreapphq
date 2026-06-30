import {
  handleAdminMe,
  handleAdminModerationAction,
  handleAdminReportById,
  handleAdminReports,
  handleHealth,
  handleReports,
  jsonResponse,
  optionsResponse,
} from "./supabaseModeration.mjs";

function apiPathname(request) {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, "");
  return pathname.replace(/^\/api\/?/, "");
}

function routeKey(pathname) {
  return pathname.split("/").filter(Boolean).join("/");
}

/**
 * Single entry for moderation/admin Supabase API routes.
 */
export async function dispatchModerationApi(request) {
  if (request.method === "OPTIONS") {
    return optionsResponse();
  }

  const pathname = apiPathname(request);
  const route = routeKey(pathname);

  if (route === "health") {
    return handleHealth(request);
  }

  if (route === "reports") {
    return handleReports(request);
  }

  if (route === "admin/me") {
    return handleAdminMe(request);
  }

  if (route === "admin/reports") {
    return handleAdminReports(request);
  }

  const reportMatch = route.match(/^admin\/reports\/([^/]+)$/);
  if (reportMatch) {
    return handleAdminReportById(request, reportMatch[1]);
  }

  if (route === "admin/moderation/action") {
    return handleAdminModerationAction(request);
  }

  return jsonResponse(404, { ok: false, error: "Not found." });
}
