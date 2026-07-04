import { classifySupabaseAnalyticsError, serializeErrorForLog } from "./analyticsRouter.mjs";
import { makeAnalyticsWarning } from "./analyticsAdminShapes.mjs";

const EVENTS_TABLE = "analytics_events";
const DEAD_LETTERS_TABLE = "analytics_event_dead_letters";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AGGREGATION_DAYS = 7;
const VALID_PRESETS = new Set(["today", "yesterday", "last_7_days"]);

export class AnalyticsOperationsError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.name = "AnalyticsOperationsError";
    this.status = status;
    this.code = options.code;
    this.cause = options.cause;
  }
}

function utcDayString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(day, delta) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return utcDayString(date);
}

function lastMinutes(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function countBy(rows, key, limit = 10) {
  const counts = new Map();
  for (const row of rows) {
    const value = row?.[key] || "unknown";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function qualityWarning(code, severity, message, count = null) {
  return {
    code,
    severity,
    count,
    message,
  };
}

export function parseAnalyticsDay(value) {
  const day = String(value || "").trim();
  if (!DATE_RE.test(day)) {
    throw new AnalyticsOperationsError(400, "day must be YYYY-MM-DD.", {
      code: "analytics_invalid_day",
    });
  }

  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || utcDayString(parsed) !== day) {
    throw new AnalyticsOperationsError(400, "day must be a valid calendar date.", {
      code: "analytics_invalid_day",
    });
  }

  const today = utcDayString();
  if (day > today) {
    throw new AnalyticsOperationsError(400, "Future aggregation days are not allowed.", {
      code: "analytics_future_day",
    });
  }

  return day;
}

export function resolveAggregationPreset(preset) {
  const value = String(preset || "").trim();
  if (!VALID_PRESETS.has(value)) {
    throw new AnalyticsOperationsError(400, "Invalid preset. Use today, yesterday, or last_7_days.", {
      code: "analytics_invalid_preset",
    });
  }

  const today = utcDayString();
  if (value === "today") return [today];
  if (value === "yesterday") return [addUtcDays(today, -1)];

  const days = [];
  for (let offset = 0; offset < MAX_AGGREGATION_DAYS; offset += 1) {
    days.push(addUtcDays(today, -offset));
  }
  return days;
}

export function resolveAggregationInput(body = {}) {
  if (body?.day != null && body?.preset != null) {
    throw new AnalyticsOperationsError(400, "Provide either day or preset, not both.", {
      code: "analytics_invalid_aggregation_input",
    });
  }

  if (body?.preset != null) return resolveAggregationPreset(body.preset);
  if (body?.day != null) return [parseAnalyticsDay(body.day)];

  // Default for cron: yesterday + today
  const today = utcDayString();
  return [addUtcDays(today, -1), today];
}

const AGGREGATION_RPC_NAME = "aggregate_analytics_events_for_day";
// Exact DATA-001 argument name. Do not send { day }.
const AGGREGATION_PARAM_NAME = "target_day";

function publicAggregationCode(error) {
  const code = classifySupabaseAnalyticsError(error);
  if (code === "analytics_rpc_not_found") return "analytics_rpc_not_found";
  if (code === "analytics_permission_denied") return "analytics_rpc_permission_denied";
  if (code === "analytics_rpc_unsafe_mutation") return "analytics_rpc_unsafe_mutation";
  if (code === "analytics_rpc_missing_extension") return "analytics_rpc_missing_extension";
  if (code === "analytics_schema_missing") return "analytics_schema_missing";
  return "analytics_aggregation_failed";
}

function publicAggregationMessage(code) {
  if (code === "analytics_rpc_not_found") {
    return "Aggregation RPC was not found or argument names do not match.";
  }
  if (code === "analytics_permission_denied" || code === "analytics_rpc_permission_denied") {
    return "Service role cannot execute the aggregation RPC.";
  }
  if (code === "analytics_rpc_unsafe_mutation") {
    return "Aggregation RPC failed because a DELETE/UPDATE lacks a WHERE clause under service_role. Mark the function SECURITY DEFINER or add WHERE day = target_day.";
  }
  if (code === "analytics_rpc_missing_extension") {
    return "Aggregation RPC cannot resolve pgcrypto digest(). Set search_path = public, extensions on the function.";
  }
  if (code === "analytics_schema_missing") {
    return "Analytics schema is not installed.";
  }
  return "Aggregation failed";
}

function safeRpcErrorFields(error) {
  const serialized = serializeErrorForLog(error);
  return {
    code: serialized.code || null,
    message: serialized.message || null,
    details: serialized.details || null,
    hint: serialized.hint || null,
  };
}

/**
 * Call public.aggregate_analytics_events_for_day(target_day DATE) RETURNS VOID.
 * VOID/null data with no error is success.
 */
export async function runAnalyticsAggregationForDay(supabase, day, context = {}) {
  const started = Date.now();
  const safeDay = parseAnalyticsDay(day);
  const operation = "aggregate_analytics_events_for_day";

  try {
    const { data, error } = await supabase.rpc(AGGREGATION_RPC_NAME, {
      target_day: safeDay,
    });

    // VOID RPC returns data: null, error: null — treat as success.
    if (!error) {
      return {
        day: safeDay,
        ok: true,
        message: "Aggregation completed",
        duration_ms: Date.now() - started,
        result: { success: true, data: data ?? null },
        param_name: AGGREGATION_PARAM_NAME,
        request_id: context.requestId || null,
      };
    }

    const code = publicAggregationCode(error);
    const rpcError = safeRpcErrorFields(error);
    return {
      day: safeDay,
      ok: false,
      code,
      message: publicAggregationMessage(code),
      duration_ms: Date.now() - started,
      param_name: AGGREGATION_PARAM_NAME,
      operation,
      error: rpcError,
    };
  } catch (error) {
    const code = publicAggregationCode(error);
    return {
      day: safeDay,
      ok: false,
      code,
      message: publicAggregationMessage(code),
      duration_ms: Date.now() - started,
      param_name: AGGREGATION_PARAM_NAME,
      operation,
      error: safeRpcErrorFields(error),
    };
  }
}

export async function runAnalyticsAggregationWindow(supabase, days, context = {}) {
  const uniqueDays = [...new Set(days.map((day) => parseAnalyticsDay(day)))];
  if (uniqueDays.length > MAX_AGGREGATION_DAYS) {
    throw new AnalyticsOperationsError(400, `Aggregation window cannot exceed ${MAX_AGGREGATION_DAYS} days.`, {
      code: "analytics_window_too_large",
    });
  }

  const results = [];
  for (const day of uniqueDays) {
    results.push(await runAnalyticsAggregationForDay(supabase, day, context));
  }

  return {
    ok: results.every((item) => item.ok),
    days: results.map((item) => ({
      day: item.day,
      ok: item.ok,
      message: item.message,
      ...(item.ok ? {} : { code: item.code }),
    })),
    failures: results
      .filter((item) => !item.ok)
      .map((item) => ({
        day: item.day,
        code: item.code,
        message: item.message,
        operation: item.operation || "aggregate_analytics_events_for_day",
        param_name: item.param_name || "target_day",
        error: item.error || null,
        duration_ms: item.duration_ms,
      })),
    warnings: [],
  };
}

async function countEventsSince(supabase, since) {
  const { count, error } = await supabase
    .from(EVENTS_TABLE)
    .select("event_id", { count: "exact", head: true })
    .gte("received_at", since);
  if (error) throw error;
  return count || 0;
}

async function detectTimestampColumn(supabase, table, candidates) {
  for (const column of candidates) {
    const { error } = await supabase.from(table).select(column, { count: "exact", head: true }).limit(1);
    if (!error) return column;
    const code = classifySupabaseAnalyticsError(error);
    if (code !== "analytics_column_mismatch") return null;
  }
  return null;
}

async function countDeadLettersSince(supabase, since, timestampColumn) {
  if (!timestampColumn) return 0;
  const { count, error } = await supabase
    .from(DEAD_LETTERS_TABLE)
    .select("id", { count: "exact", head: true })
    .gte(timestampColumn, since);
  if (error) throw error;
  return count || 0;
}

async function probeTable(supabase, table, columns) {
  const { error } = await supabase.from(table).select(columns.join(","), { count: "exact", head: true }).limit(1);
  if (!error) return { exists: true, selectable: true, warning: null };
  const code = classifySupabaseAnalyticsError(error);
  return {
    exists: code !== "analytics_schema_missing",
    selectable: false,
    warning: makeAnalyticsWarning(`${table}_probe_failed`, `${table}: ${code}`, { classified_code: code }),
  };
}

async function queryViewLatestDay(supabase, viewName) {
  const { data, error } = await supabase.from(viewName).select("day").order("day", { ascending: false }).limit(1);
  if (error) {
    return {
      available: false,
      day: null,
      warning: makeAnalyticsWarning(`${viewName}_unavailable`, `Optional analytics view ${viewName} unavailable.`),
    };
  }
  return { available: true, day: data?.[0]?.day || null, warning: null };
}

export async function getDeadLetterSummary(supabase, context = {}) {
  const timestampColumn =
    context.deadLettersTimeColumn ||
    (await detectTimestampColumn(supabase, DEAD_LETTERS_TABLE, ["received_at", "created_at"]));

  if (!timestampColumn) {
    return {
      last_24h: 0,
      last_7d: 0,
      by_reason: [],
      by_source: [],
      timestamp_column: null,
      warnings: [makeAnalyticsWarning("dead_letters_time_column_unavailable", "Dead-letter timestamp column unavailable.")],
    };
  }

  const since24h = lastMinutes(24 * 60);
  const since7d = lastMinutes(7 * 24 * 60);

  const [last24h, last7d, reasonRows] = await Promise.all([
    countDeadLettersSince(supabase, since24h, timestampColumn),
    countDeadLettersSince(supabase, since7d, timestampColumn),
    supabase
      .from(DEAD_LETTERS_TABLE)
      .select("reason, source")
      .gte(timestampColumn, since7d)
      .limit(1000),
  ]);

  if (reasonRows.error) {
    const code = classifySupabaseAnalyticsError(reasonRows.error);
    if (code === "analytics_column_mismatch") {
      const minimal = await supabase
        .from(DEAD_LETTERS_TABLE)
        .select("reason")
        .gte(timestampColumn, since7d)
        .limit(1000);
      if (minimal.error) throw minimal.error;
      return {
        last_24h: last24h,
        last_7d: last7d,
        by_reason: countBy(minimal.data || [], "reason"),
        by_source: [],
        timestamp_column: timestampColumn,
        warnings: [makeAnalyticsWarning("dead_letters_source_unavailable", "Dead-letter source column unavailable.")],
      };
    }
    throw reasonRows.error;
  }

  return {
    last_24h: last24h,
    last_7d: last7d,
    by_reason: countBy(reasonRows.data || [], "reason"),
    by_source: countBy(reasonRows.data || [], "source"),
    timestamp_column: timestampColumn,
    warnings: [],
  };
}

export async function getAnalyticsDataQualityWarnings(supabase, context = {}) {
  const since24h = lastMinutes(24 * 60);
  const warnings = [];

  const sample = await supabase
    .from(EVENTS_TABLE)
    .select("event_name, source, platform, session_id, anonymous_id, user_id, properties")
    .gte("received_at", since24h)
    .order("received_at", { ascending: false })
    .limit(1000);

  if (sample.error) throw sample.error;
  const rows = sample.data || [];

  if (rows.length === 0) {
    warnings.push(qualityWarning("no_events_last_24h", "warning", "No analytics events were received in the last 24 hours.", 0));
  }

  const mobileCount = rows.filter((row) => row.source === "mobile" || row.platform === "ios" || row.platform === "android").length;
  if (mobileCount === 0) {
    warnings.push(
      qualityWarning(
        "no_mobile_events_last_24h",
        "warning",
        "No mobile analytics events were received in the last 24 hours. DATA-003 may still be pending QA/release.",
        0,
      ),
    );
  }

  const missingPlatform = rows.filter((row) => !row.platform).length;
  if (missingPlatform > 0) {
    warnings.push(qualityWarning("missing_platform", "warning", "Some events are missing platform.", missingPlatform));
  }

  const missingSession = rows.filter((row) => !row.session_id).length;
  if (missingSession > 0) {
    warnings.push(qualityWarning("missing_session_id", "warning", "Some events are missing session_id.", missingSession));
  }

  const missingAnonymous = rows.filter((row) => !row.user_id && !row.anonymous_id).length;
  if (missingAnonymous > 0) {
    warnings.push(
      qualityWarning(
        "missing_anonymous_id_for_anonymous_events",
        "warning",
        "Some anonymous events are missing anonymous_id.",
        missingAnonymous,
      ),
    );
  }

  const searchEvents = rows.filter((row) => String(row.event_name || "").startsWith("search_"));
  const searchWithoutHash = searchEvents.filter((row) => {
    const props = row.properties && typeof row.properties === "object" ? row.properties : {};
    return !props.query_hash && !props.search_query_hash;
  }).length;
  if (searchWithoutHash > 0) {
    warnings.push(
      qualityWarning(
        "search_events_without_query_hash",
        "info",
        "Some search events are missing query_hash.",
        searchWithoutHash,
      ),
    );
  }

  const sources = countBy(rows, "source");
  if (rows.length >= 10 && sources.length === 1 && sources[0].value === "web") {
    warnings.push(
      qualityWarning(
        "event_source_distribution_unusual",
        "info",
        "Event source distribution is unusually web-only in the last 24 hours.",
        sources[0].count,
      ),
    );
  }

  if (context.usingRawEventsFallback) {
    warnings.push(
      qualityWarning(
        "optional_views_unavailable",
        "warning",
        "Optional daily analytics views are unavailable; using raw events fallback.",
      ),
    );
  }

  if (context.deadLetterRate24h != null && context.deadLetterRate24h >= 5) {
    warnings.push(
      qualityWarning(
        "high_dead_letter_rate",
        context.deadLetterRate24h > 20 ? "critical" : "warning",
        `Dead-letter rate over the last 24 hours is ${context.deadLetterRate24h}%.`,
        context.deadLetters24h ?? null,
      ),
    );
  }

  if (context.aggregationStale) {
    warnings.push(qualityWarning("aggregation_stale", "warning", "Analytics aggregation appears stale."));
  }

  return warnings;
}

function computeStatus({
  eventsSelectable,
  deadLettersSelectable,
  events24h,
  deadLetterRate24h,
  aggregationFreshness,
  qualityWarnings,
}) {
  if (!eventsSelectable) return "critical";
  if (deadLetterRate24h > 20) return "critical";
  if (qualityWarnings.some((item) => item.severity === "critical")) return "critical";

  if (!deadLettersSelectable) return "warning";
  if (events24h === 0) return "warning";
  if (deadLetterRate24h >= 5) return "warning";
  if (!aggregationFreshness.is_today_aggregated && !aggregationFreshness.is_yesterday_aggregated) return "warning";
  if (qualityWarnings.some((item) => item.severity === "warning")) return "warning";

  return "healthy";
}

export async function getAnalyticsIngestionHealth(supabase, context = {}) {
  const eventsProbe = await probeTable(supabase, EVENTS_TABLE, ["event_id", "event_name", "received_at", "source", "platform"]);
  const deadLettersProbe = await probeTable(supabase, DEAD_LETTERS_TABLE, ["event_id", "reason"]);
  const deadLettersTimeColumn =
    context.deadLettersTimeColumn ||
    (await detectTimestampColumn(supabase, DEAD_LETTERS_TABLE, ["received_at", "created_at"]));

  const since5m = lastMinutes(5);
  const since1h = lastMinutes(60);
  const since24h = lastMinutes(24 * 60);

  const [events5m, events1h, events24h, deadLetters1h, deadLetters24h, latest, overviewDaily, topContentDaily, searchDaily, adminMetricsDaily, deadLetterSummary] =
    await Promise.all([
      countEventsSince(supabase, since5m),
      countEventsSince(supabase, since1h),
      countEventsSince(supabase, since24h),
      countDeadLettersSince(supabase, since1h, deadLettersTimeColumn),
      countDeadLettersSince(supabase, since24h, deadLettersTimeColumn),
      supabase.from(EVENTS_TABLE).select("received_at").order("received_at", { ascending: false }).limit(1),
      queryViewLatestDay(supabase, "admin_analytics_overview_daily"),
      queryViewLatestDay(supabase, "admin_top_content_daily"),
      queryViewLatestDay(supabase, "admin_search_insights_daily"),
      queryViewLatestDay(supabase, "admin_metrics_daily"),
      getDeadLetterSummary(supabase, { deadLettersTimeColumn }),
    ]);

  if (latest.error) throw latest.error;

  const today = utcDayString();
  const yesterday = addUtcDays(today, -1);
  const latestAdminMetricsDay = adminMetricsDaily.day;
  const latestOverviewDay = overviewDaily.day;
  const aggregationFreshness = {
    latest_admin_metrics_day: latestAdminMetricsDay,
    latest_overview_day: latestOverviewDay,
    is_today_aggregated: latestAdminMetricsDay === today || latestOverviewDay === today,
    is_yesterday_aggregated: latestAdminMetricsDay === yesterday || latestOverviewDay === yesterday,
  };

  const usingRawEventsFallback = !overviewDaily.available || !overviewDaily.day;
  const deadLetterRate24h =
    events24h > 0 ? Math.round((deadLetters24h / events24h) * 1000) / 10 : deadLetters24h > 0 ? 100 : 0;

  const diagnosticsWarnings = [
    eventsProbe.warning,
    deadLettersProbe.warning,
    overviewDaily.warning,
    topContentDaily.warning,
    searchDaily.warning,
    adminMetricsDaily.warning,
    ...(deadLetterSummary.warnings || []),
  ].filter(Boolean);

  if (usingRawEventsFallback) {
    diagnosticsWarnings.push(makeAnalyticsWarning("using_raw_events_fallback", "Using raw events fallback for admin analytics."));
  }

  const qualityWarnings = await getAnalyticsDataQualityWarnings(supabase, {
    usingRawEventsFallback,
    deadLetterRate24h,
    deadLetters24h,
    aggregationStale: !aggregationFreshness.is_today_aggregated && !aggregationFreshness.is_yesterday_aggregated,
  });

  const diagnostics = {
    analytics_events_selectable: eventsProbe.selectable,
    analytics_dead_letters_selectable: deadLettersProbe.selectable,
    analytics_dead_letters_time_column: deadLettersTimeColumn,
    overview_daily_view_available: overviewDaily.available,
    top_content_daily_view_available: topContentDaily.available,
    search_insights_daily_view_available: searchDaily.available,
    admin_metrics_daily_available: adminMetricsDaily.available,
    using_raw_events_fallback: usingRawEventsFallback,
    warnings: diagnosticsWarnings,
  };

  const status = computeStatus({
    eventsSelectable: eventsProbe.selectable,
    deadLettersSelectable: deadLettersProbe.selectable,
    events24h,
    deadLetterRate24h,
    aggregationFreshness,
    qualityWarnings,
  });

  return {
    status,
    last_event_received_at: latest.data?.[0]?.received_at || null,
    events_last_5m: events5m,
    events_last_1h: events1h,
    events_last_24h: events24h,
    dead_letters_last_1h: deadLetters1h,
    dead_letters_last_24h: deadLetters24h,
    dead_letter_rate_24h: deadLetterRate24h,
    top_dead_letter_reasons_24h: deadLetterSummary.by_reason,
    aggregation_freshness: aggregationFreshness,
    diagnostics,
    quality_warnings: qualityWarnings,
  };
}

export function getAnalyticsCronSecret() {
  return (process.env.ANALYTICS_CRON_SECRET || process.env.CRON_SECRET || "").trim();
}

export function assertAnalyticsCronAuthorized(request) {
  const configured = getAnalyticsCronSecret();
  if (!configured) {
    throw new AnalyticsOperationsError(503, "Analytics cron is not configured.", {
      code: "analytics_cron_not_configured",
    });
  }

  const headerSecret = (request.headers.get("x-cron-secret") || "").trim();
  const authHeader = (request.headers.get("authorization") || "").trim();
  const bearerSecret = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice("bearer ".length).trim()
    : "";

  if (headerSecret !== configured && bearerSecret !== configured) {
    throw new AnalyticsOperationsError(401, "Authentication required.", {
      code: "analytics_cron_unauthorized",
    });
  }
}

export function clampEventExplorerLimit(rawLimit, { defaultLimit = 50, maxLimit = 100 } = {}) {
  const value = Number(rawLimit);
  if (!Number.isFinite(value) || value <= 0) return defaultLimit;
  return Math.min(Math.floor(value), maxLimit);
}

export function clampOffset(rawOffset) {
  const value = Number(rawOffset);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}
