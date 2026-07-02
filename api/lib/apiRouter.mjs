import waitlistSignup from "../../netlify/functions/waitlist-signup.mjs";
import adminWaitlist from "../../netlify/functions/admin-waitlist.mjs";
import adminNotifyLaunch from "../../netlify/functions/admin-notify-launch.mjs";
import adminBroadcast from "../../netlify/functions/admin-broadcast.mjs";
import feedbackSubmit from "../../netlify/functions/feedback-submit.mjs";
import { dispatchModerationApi } from "./moderationRouter.mjs";
import { resolveApiRoute } from "./resolveApiRoute.mjs";
import {
  handleAdminSystemHealth,
  handleAdminSystemMetrics,
  handleBootstrapBoardAdmins,
  handleTokenMetrics,
} from "./systemRouter.mjs";
import { jsonResponse, optionsResponse } from "./supabaseModeration.mjs";
import { errorSummary, logger, requestLogMeta } from "./logger.mjs";
import { recordApiRequest } from "./metrics.mjs";
import { ensureRequestId, responseHeadersWithRequestId, routePath } from "./requestContext.mjs";

function isModerationRoute(route) {
  return (
    route === "health" ||
    route === "reports" ||
    route === "user/hidden-content" ||
    route === "user/hidden-content/unhide" ||
    route === "admin/me" ||
    route === "admin/reports" ||
    route === "admin/moderation/summary" ||
    route === "admin/ops/summary" ||
    route === "admin/users" ||
    /^admin\/reports\/[^/]+$/.test(route) ||
    route === "admin/moderation/action"
  );
}

/**
 * Single Vercel serverless entry — all /api/* requests rewrite here.
 */
export async function dispatchApi(incomingRequest) {
  const { request, requestId } = ensureRequestId(incomingRequest);
  const route = resolveApiRoute(request);
  const started = Date.now();
  const routeLabel = routePath(route);

  logger.info("API request started", requestLogMeta(request, route));

  let response;
  try {
    if (isModerationRoute(route)) {
      response = await dispatchModerationApi(request, route);
    } else if (route === "admin/system/health") {
      response = await handleAdminSystemHealth(request);
    } else if (route === "admin/system/metrics") {
      response = await handleAdminSystemMetrics(request);
    } else if (route === "admin/system/bootstrap-board") {
      response = await handleBootstrapBoardAdmins(request);
    } else if (route === "metrics") {
      response = await handleTokenMetrics(request);
    } else if (route === "waitlist/signup") {
      response = await waitlistSignup(request);
    } else if (route === "admin/waitlist") {
      response = await adminWaitlist(request);
    } else if (route === "admin/waitlist/notify-launch") {
      response = await adminNotifyLaunch(request);
    } else if (route === "admin/broadcast") {
      response = await adminBroadcast(request);
    } else if (route === "feedback/submit") {
      response = await feedbackSubmit(request);
    } else if (request.method === "OPTIONS") {
      response = optionsResponse();
    } else {
      response = jsonResponse(404, { ok: false, error: "Not found." });
    }
  } catch (error) {
    logger.error("Unhandled API router error", {
      ...requestLogMeta(request, route),
      error: errorSummary(error),
    });
    response = jsonResponse(500, {
      ok: false,
      error: "Internal server error",
      request_id: requestId,
    });
  }

  const durationMs = Date.now() - started;
  const finalResponse = await withRequestId(response, requestId);

  recordApiRequest({
    route: routeLabel,
    method: request.method,
    status: finalResponse.status,
    durationMs,
  });

  logger.info("API request completed", {
    ...requestLogMeta(request, route),
    status: finalResponse.status,
    duration_ms: durationMs,
  });

  return finalResponse;
}

async function withRequestId(response, requestId) {
  const headers = responseHeadersWithRequestId(response.headers, requestId);
  const contentType = headers.get("content-type") || "";

  if (response.status >= 400 && contentType.includes("application/json")) {
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { ok: false, error: "Request failed." };
    }

    if (body && typeof body === "object" && !Array.isArray(body)) {
      body.request_id = body.request_id || requestId;
    }

    return new Response(JSON.stringify(body), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
