import waitlistSignup from "../../netlify/functions/waitlist-signup.mjs";
import adminWaitlist from "../../netlify/functions/admin-waitlist.mjs";
import adminNotifyLaunch from "../../netlify/functions/admin-notify-launch.mjs";
import adminBroadcast from "../../netlify/functions/admin-broadcast.mjs";
import feedbackSubmit from "../../netlify/functions/feedback-submit.mjs";
import { dispatchModerationApi } from "./moderationRouter.mjs";
import { resolveApiRoute } from "./resolveApiRoute.mjs";
import { jsonResponse, optionsResponse } from "./supabaseModeration.mjs";

function isModerationRoute(route) {
  return (
    route === "health" ||
    route === "reports" ||
    route === "user/hidden-content" ||
    route === "user/hidden-content/unhide" ||
    route === "admin/me" ||
    route === "admin/reports" ||
    route === "admin/moderation/summary" ||
    /^admin\/reports\/[^/]+$/.test(route) ||
    route === "admin/moderation/action"
  );
}

/**
 * Single Vercel serverless entry — all /api/* requests rewrite here.
 */
export async function dispatchApi(request) {
  const route = resolveApiRoute(request);

  if (isModerationRoute(route)) {
    return dispatchModerationApi(request, route);
  }

  if (route === "waitlist/signup") {
    return waitlistSignup(request);
  }

  if (route === "admin/waitlist") {
    return adminWaitlist(request);
  }

  if (route === "admin/waitlist/notify-launch") {
    return adminNotifyLaunch(request);
  }

  if (route === "admin/broadcast") {
    return adminBroadcast(request);
  }

  if (route === "feedback/submit") {
    return feedbackSubmit(request);
  }

  if (request.method === "OPTIONS") {
    return optionsResponse();
  }

  return jsonResponse(404, { ok: false, error: "Not found." });
}
