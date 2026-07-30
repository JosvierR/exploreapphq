import { jsonResponse, optionsResponse } from "../http/responses.mjs";
import { requestIdFromRequest } from "../http/requestContext.mjs";
import { requireAdmin } from "../moderation/supabaseModeration.mjs";
import { appEnvironment, appVersion, errorSummary, logger, requestLogMeta } from "../observability/logger.mjs";
import { observabilityConfigStatus, probeLokiConnectivity } from "../observability/lokiLogger.mjs";
import { metricsPrometheus, metricsSnapshot } from "../observability/metrics.mjs";

function configured(value) {
  return Boolean(String(value || "").trim());
}

function supabaseConfig() {
  return {
    supabase_url_configured: configured(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    supabase_publishable_configured: configured(
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    ),
    supabase_service_configured: configured(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

function metricsToken() {
  return String(process.env.METRICS_TOKEN || "").trim();
}

function bearerToken(request) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

function methodNotAllowed(request) {
  return jsonResponse(405, {
    ok: false,
    error: "Method not allowed.",
    request_id: requestIdFromRequest(request),
  });
}

async function safeTableCheck(supabase, table, warnings) {
  try {
    const { error } = await supabase.from(table).select("id", { count: "exact", head: true });
    if (error) throw error;
    return "ok";
  } catch (error) {
    warnings.push(`${table} table not reachable`);
    logger.warn("Admin system table check failed", {
      table,
      error: errorSummary(error),
    });
    return "warning";
  }
}

export async function handleAdminSystemHealth(request) {
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed(request);

    const requestId = requestIdFromRequest(request);
    const warnings = [];
    const { supabase, user, role, email, fallback } = await requireAdmin(request);
    const started = Date.now();
    const [reportsTable, videosTable, placesTable, actionsTable] = await Promise.all([
      safeTableCheck(supabase, "content_reports", warnings),
      safeTableCheck(supabase, "videos", warnings),
      safeTableCheck(supabase, "places", warnings),
      safeTableCheck(supabase, "moderation_actions", warnings),
    ]);
    const durationMs = Date.now() - started;
    const obs = observabilityConfigStatus();
    const config = supabaseConfig();
    const supabaseReady = config.supabase_url_configured && config.supabase_service_configured;
    const lokiProbe = await probeLokiConnectivity();
    if (lokiProbe.status === "warning") {
      warnings.push(`Loki connectivity: ${lokiProbe.reason || "warning"}`);
    }

    return jsonResponse(200, {
      ok: true,
      service: "explore-web-admin",
      environment: appEnvironment(),
      version: appVersion(),
      timestamp: new Date().toISOString(),
      request_id: requestId,
      duration_ms: durationMs,
      admin: {
        user_id: user.id,
        email,
        role,
        fallback: Boolean(fallback),
      },
      checks: {
        api: "ok",
        admin_auth: "ok",
        supabase_connection: supabaseReady ? "ok" : "warning",
        reports_table: reportsTable,
        videos_table: videosTable,
        places_table: placesTable,
        moderation_actions_table: actionsTable,
        metrics: "in_memory",
        loki_configured: obs.loki_ready,
        loki_connectivity: lokiProbe.status,
        grafana_logs_enabled: obs.grafana_logs_enabled,
      },
      config: {
        ...config,
        metrics_token_configured: configured(process.env.METRICS_TOKEN),
        ...obs,
        loki_probe: lokiProbe,
      },
      warnings,
    });
  } catch (error) {
    logger.warn("Admin system health failed", {
      ...requestLogMeta(request, "admin/system/health"),
      error: errorSummary(error),
    });
    const status = error?.status || 500;
    return jsonResponse(status, {
      ok: false,
      error: status === 401 ? "Authentication required." : status === 403 ? "Access denied." : "Internal server error",
      request_id: requestIdFromRequest(request),
    });
  }
}

function metricsFormat(request) {
  const url = new URL(request.url);
  if (url.searchParams.get("format") === "json") return "json";
  const accept = request.headers.get("accept") || "";
  return accept.includes("application/json") ? "json" : "prometheus";
}

function metricsResponse(request) {
  const requestId = requestIdFromRequest(request);
  if (metricsFormat(request) === "json") {
    return jsonResponse(200, {
      ok: true,
      request_id: requestId,
      ...metricsSnapshot(),
    });
  }

  return new Response(metricsPrometheus(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
      "x-request-id": requestId,
      "Access-Control-Expose-Headers": "x-request-id",
    },
  });
}

export async function handleAdminSystemMetrics(request) {
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed(request);
    await requireAdmin(request);
    return metricsResponse(request);
  } catch (error) {
    const status = error?.status || 500;
    return jsonResponse(status, {
      ok: false,
      error: status === 401 ? "Authentication required." : status === 403 ? "Access denied." : "Internal server error",
      request_id: requestIdFromRequest(request),
    });
  }
}

export async function handleTokenMetrics(request) {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "GET") return methodNotAllowed(request);

  const expected = metricsToken();
  if (!expected) {
    return jsonResponse(404, {
      ok: false,
      error: "Not found.",
      request_id: requestIdFromRequest(request),
    });
  }

  if (bearerToken(request) !== expected) {
    return jsonResponse(403, {
      ok: false,
      error: "Metrics token required.",
      request_id: requestIdFromRequest(request),
    });
  }

  return metricsResponse(request);
}

function bootstrapSecret() {
  return String(process.env.ADMIN_BOOTSTRAP_SECRET || "").trim();
}

export async function handleBootstrapBoardAdmins(request) {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return methodNotAllowed(request);

  const requestId = requestIdFromRequest(request);
  const expected = bootstrapSecret();
  if (!expected) {
    return jsonResponse(404, {
      ok: false,
      error: "Not found.",
      request_id: requestId,
    });
  }

  const provided = String(request.headers.get("x-admin-bootstrap-secret") || "").trim();
  if (!provided || provided !== expected) {
    return jsonResponse(403, {
      ok: false,
      error: "Bootstrap secret required.",
      request_id: requestId,
    });
  }

  try {
    const { provisionBoardAdminAccounts } = await import("./boardAdminProvision.mjs");
    const result = await provisionBoardAdminAccounts();
    logger.info("Board admin bootstrap completed", {
      request_id: requestId,
      account_count: result.accounts.length,
    });
    return jsonResponse(200, {
      ok: true,
      request_id: requestId,
      ...result,
      warning:
        "Save these credentials securely now. Rotate ADMIN_BOOTSTRAP_SECRET and redeploy after bootstrap.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error);
    logger.error("Board admin bootstrap failed", {
      request_id: requestId,
      error: errorSummary(error),
    });
    return jsonResponse(500, {
      ok: false,
      error: message || "Bootstrap failed.",
      request_id: requestId,
    });
  }
}
