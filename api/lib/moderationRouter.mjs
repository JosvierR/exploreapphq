import {
  handleAdminMe,
  handleAdminModerationAction,
  handleAdminReportById,
  handleAdminReports,
  handleHealth,
  handleReports,
  handleUserHiddenContent,
  handleUserHiddenContentUnhide,
  jsonResponse,
  optionsResponse,
} from "./supabaseModeration.mjs";
import { resolveApiRoute } from "./resolveApiRoute.mjs";

/**
 * Supabase moderation + admin API routes.
 */
export async function dispatchModerationApi(request, routeOverride) {
  if (request.method === "OPTIONS") {
    return optionsResponse();
  }

  const route = routeOverride ?? resolveApiRoute(request);

  if (route === "health") {
    return handleHealth(request);
  }

  if (route === "reports") {
    return handleReports(request);
  }

  if (route === "user/hidden-content") {
    return handleUserHiddenContent(request);
  }

  if (route === "user/hidden-content/unhide") {
    return handleUserHiddenContentUnhide(request);
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
