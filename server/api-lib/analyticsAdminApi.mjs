import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { classifySupabaseAnalyticsError, serializeErrorForLog } from "./analyticsRouter.mjs";
import { logger, requestLogMeta } from "./logger.mjs";
import { requestIdFromRequest } from "./requestContext.mjs";
import { jsonResponse, optionsResponse, requireAdmin } from "./supabaseModeration.mjs";

const EVENTS_TABLE = "analytics_events";
const DEAD_LETTERS_TABLE = "analytics_event_dead_letters";
const EVENT_PAGE_SIZE = 50;
const DEAD_LETTER_PAGE_SIZE = 50;
const SAMPLE_LIMIT = 2000;
const TIMESERIES_DAYS = 31;
const REDACTED = "[redacted]";
const SENSITIVE_KEY_RE =
  /(token|secret|password|authorization|refresh[_-]?token|access[_-]?token|service[_-]?role|api[_-]?key|email|cookie|query(?!_hash)|search_query)/i;
const LOCATION_KEYS = new Set(["lat", "lng", "latitude", "longitude", "coordinates"]);
const VALID_RANGES = new Set(["24h", "7d", "30d", "custom"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const EVENTS_COLUMNS = [
  "event_id",
  "event_name",
  "event_version",
  "user_id",
  "anonymous_id",
  "session_id",
  "entity_type",
  "entity_id",
  "source",
  "platform",
  "app_version",
  "build_number",
  "device_os",
  "occurred_at",
  "received_at",
  "batch_id",
  "request_id",
  "properties",
  "context",
];

const DEAD_LETTER_COLUMNS = ["id", "event_id", "user_id", "anonymous_id", "reason", "payload", "source", "received_at"];

class AdminAnalyticsError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.name = "AdminAnalyticsError";
    this.status = status;
    this.code = options.code;
    this.cause = options.cause;
  }
}

function getSupabaseUrl() {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
}

function getSupabaseSecretKey() {
  return (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function serviceRoleConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseSecretKey());
}

function serviceKeyLooksLikeJwt() {
  const key = getSupabaseSecretKey();
  return /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key);
}

function supabaseProjectRef() {
  const url = getSupabaseUrl();
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const match = host.match(/^([a-z0-9-]+)\.supabase\.(co|in)$/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function analyticsSupabaseConfigMeta() {
  return {
    project_ref: supabaseProjectRef(),
    service_role_configured: serviceRoleConfigured(),
    service_key_looks_like_jwt: serviceKeyLooksLikeJwt(),
  };
}

function createServiceClient() {
  const url = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();
  if (!url || !secretKey) {
    throw new AdminAnalyticsError(503, "Supabase server credentials are not configured.", {
      code: "analytics_service_role_missing",
    });
  }

  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: WebSocket },
  });
}

function methodNotAllowed(request) {
  return jsonResponse(405, {
    ok: false,
    error: "Method not allowed.",
    request_id: requestIdFromRequest(request),
  });
}

function analyticsSchemaMissing(error) {
  return classifySupabaseAnalyticsError(error?.cause || error) === "analytics_schema_missing";
}

function adminFailure(request, route, error, diagnostics = null) {
  if (analyticsSchemaMissing(error)) {
    return jsonResponse(200, {
      ok: true,
      request_id: requestIdFromRequest(request),
      data: null,
      diagnostics,
      warnings: ["analytics schema not installed", ...(diagnostics?.warnings || [])],
    });
  }

  const status = error?.status || 500;
  logger.warn("Admin analytics request failed", {
    ...requestLogMeta(request, route),
    status,
    error: serializeErrorForLog(error?.cause || error),
    ...analyticsSupabaseConfigMeta(),
  });

  return jsonResponse(status, {
    ok: false,
    error: status === 401 ? "Authentication required." : status === 403 ? "Access denied." : status === 400 ? error.message : "Internal server error",
    request_id: requestIdFromRequest(request),
    diagnostics,
  });
}

function parseRange(request) {
  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "7d";
  if (!VALID_RANGES.has(range)) {
    throw new AdminAnalyticsError(400, "Invalid range. Use 24h, 7d, 30d, or custom.");
  }

  const sinceParam = url.searchParams.get("since");
  const untilParam = url.searchParams.get("until");
  const now = Date.now();

  if (range === "custom") {
    if (!sinceParam || !untilParam) {
      throw new AdminAnalyticsError(400, "Custom range requires since and until ISO timestamps.");
    }
    return { range, since: new Date(sinceParam).toISOString(), until: new Date(untilParam).toISOString() };
  }

  const hours = range === "24h" ? 24 : range === "30d" ? 24 * 30 : 24 * 7;
  return {
    range,
    since: new Date(now - hours * 60 * 60 * 1000).toISOString(),
    until: new Date(now).toISOString(),
  };
}

function startOfUtcDayIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function lastMinutes(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function shortenId(value) {
  if (!value || typeof value !== "string") return null;
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function sanitizeAdminJson(value, depth = 0) {
  if (value == null) return value;
  if (typeof value === "string") return value.slice(0, 500);
  if (typeof value !== "object" || depth >= 3) return "[object]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeAdminJson(item, depth + 1));

  const out = {};
  for (const [rawKey, item] of Object.entries(value).slice(0, 40)) {
    const key = String(rawKey);
    const normalized = key.toLowerCase();
    if (SENSITIVE_KEY_RE.test(normalized) || LOCATION_KEYS.has(normalized)) {
      out[key] = REDACTED;
    } else if (normalized === "query" || normalized === "search_query" || normalized === "raw_query") {
      out[key] = REDACTED;
    } else {
      out[key] = sanitizeAdminJson(item, depth + 1);
    }
  }
  return out;
}

function payloadSummary(payload) {
  if (!payload || typeof payload !== "object") return null;
  const sanitized = sanitizeAdminJson(payload);
  const keys = Object.keys(sanitized);
  return {
    key_count: keys.length,
    keys: keys.slice(0, 12),
    preview: sanitized,
  };
}

function countBy(rows, key, limit = 10) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[key] || "unknown";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

async function countEventsSince(supabase, since, until = null) {
  let query = supabase.from(EVENTS_TABLE).select("event_id", { count: "exact", head: true }).gte("received_at", since);
  if (until) query = query.lte("received_at", until);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function countDeadLettersSince(supabase, since) {
  const { count, error } = await supabase
    .from(DEAD_LETTERS_TABLE)
    .select("id", { count: "exact", head: true })
    .gte("received_at", since);
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
    warning: `${table}: ${code}`,
  };
}

export async function buildAdminAnalyticsDiagnostics(supabase, request) {
  const [events, deadLetters] = await Promise.all([
    probeTable(supabase, EVENTS_TABLE, EVENTS_COLUMNS),
    probeTable(supabase, DEAD_LETTERS_TABLE, DEAD_LETTER_COLUMNS),
  ]);
  const warnings = [events.warning, deadLetters.warning].filter(Boolean);

  return {
    analytics_events_exists: events.exists,
    analytics_dead_letters_exists: deadLetters.exists,
    analytics_events_selectable: events.selectable,
    analytics_dead_letters_selectable: deadLetters.selectable,
    supabase_project_ref: supabaseProjectRef(),
    service_role_configured: serviceRoleConfigured(),
    service_key_looks_like_jwt: serviceKeyLooksLikeJwt(),
    warnings,
  };
}

async function queryViewRows(supabase, viewName, { since, until, limit = 31, orderColumn = "day" } = {}) {
  let query = supabase.from(viewName).select("*").order(orderColumn, { ascending: false }).limit(limit);
  if (since) query = query.gte(orderColumn, since.slice(0, 10));
  if (until) query = query.lte(orderColumn, until.slice(0, 10));
  const { data, error } = await query;
  if (error) {
    if (analyticsSchemaMissing(error)) return { available: false, rows: [] };
    throw error;
  }
  return { available: true, rows: data || [] };
}

function aggregateRowsByDay(rows, dateKey = "received_at") {
  const buckets = new Map();
  for (const row of rows) {
    const raw = row[dateKey];
    if (!raw) continue;
    const day = String(raw).slice(0, 10);
    buckets.set(day, (buckets.get(day) || 0) + 1);
  }
  return [...buckets.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

function uniqueCount(rows, key) {
  return new Set(rows.map((row) => row[key]).filter(Boolean)).size;
}

function authShare(rows) {
  const authenticated = rows.filter((row) => row.user_id).length;
  const anonymous = rows.length - authenticated;
  return {
    authenticated,
    anonymous,
    authenticated_pct: rows.length ? Math.round((authenticated / rows.length) * 100) : 0,
    anonymous_pct: rows.length ? Math.round((anonymous / rows.length) * 100) : 0,
  };
}

function avgEventsPerSession(rows) {
  const sessions = new Map();
  for (const row of rows) {
    if (!row.session_id) continue;
    sessions.set(row.session_id, (sessions.get(row.session_id) || 0) + 1);
  }
  if (sessions.size === 0) return null;
  const total = [...sessions.values()].reduce((sum, count) => sum + count, 0);
  return Math.round((total / sessions.size) * 10) / 10;
}

function computeHealthStatus({ events5m, events1h, deadLetters24h, diagnostics }) {
  if (!diagnostics?.analytics_events_selectable) return "critical";
  if (events5m > 0 && deadLetters24h < Math.max(10, events1h * 0.2)) return "healthy";
  if (events1h > 0 || diagnostics?.analytics_events_selectable) return "warning";
  return "warning";
}

function mapEventRow(row) {
  return {
    event_id: row.event_id,
    received_at: row.received_at,
    occurred_at: row.occurred_at,
    event_name: row.event_name,
    source: row.source || "unknown",
    platform: row.platform || "unknown",
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    anonymous_id_short: shortenId(row.anonymous_id),
    user_id_present: Boolean(row.user_id),
    session_id_short: shortenId(row.session_id),
    app_version: row.app_version,
    build_number: row.build_number,
  };
}

function mapDeadLetterRow(row) {
  return {
    received_at: row.received_at,
    event_id: row.event_id,
    anonymous_id_short: shortenId(row.anonymous_id),
    user_id_present: Boolean(row.user_id),
    reason: row.reason,
    source: row.source || "unknown",
    payload_summary: payloadSummary(row.payload),
  };
}

async function requireAdminContext(request) {
  const admin = await requireAdmin(request);
  const diagnostics = await buildAdminAnalyticsDiagnostics(admin.supabase, request);
  return { ...admin, diagnostics };
}

async function fetchSampleEvents(supabase, since, until) {
  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .select("event_name, entity_type, entity_id, user_id, anonymous_id, session_id, source, platform, received_at, occurred_at, properties")
    .gte("received_at", since)
    .lte("received_at", until)
    .order("received_at", { ascending: false })
    .limit(SAMPLE_LIMIT);
  if (error) throw error;
  return data || [];
}

export async function handleAdminAnalyticsOverview(request) {
  let diagnostics = null;
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed(request);

    const { supabase, diagnostics: diag } = await requireAdminContext(request);
    diagnostics = diag;
    const { range, since, until } = parseRange(request);
    const sinceToday = startOfUtcDayIso();
    const since24h = lastMinutes(24 * 60);

    const [eventsToday, events24h, events7d, events30d, deadLetters24h, sample, latest] = await Promise.all([
      countEventsSince(supabase, sinceToday),
      countEventsSince(supabase, since24h),
      countEventsSince(supabase, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      countEventsSince(supabase, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      countDeadLettersSince(supabase, since24h),
      fetchSampleEvents(supabase, since, until),
      supabase.from(EVENTS_TABLE).select("received_at, occurred_at").order("received_at", { ascending: false }).limit(1),
    ]);

    if (latest.error) throw latest.error;
    const rangeRows = sample;
    const rows24h = sample.filter((row) => row.received_at >= since24h);

    const dailyView = await queryViewRows(supabase, "admin_analytics_overview_daily", { since, until, limit: 14 });

    return jsonResponse(200, {
      ok: true,
      request_id: requestIdFromRequest(request),
      range,
      overview: {
        events_today: eventsToday,
        events_last_24h: events24h,
        events_last_7d: events7d,
        events_last_30d: events30d,
        events_in_range: rangeRows.length >= SAMPLE_LIMIT ? `${SAMPLE_LIMIT}+` : rangeRows.length,
        active_anonymous_ids: uniqueCount(rows24h, "anonymous_id"),
        active_authenticated_users: uniqueCount(rows24h, "user_id"),
        sessions: uniqueCount(rows24h, "session_id"),
        avg_events_per_session: avgEventsPerSession(rows24h),
        dead_letters_last_24h: deadLetters24h,
        ingestion_health: computeHealthStatus({
          events5m: rows24h.filter((row) => row.received_at >= lastMinutes(5)).length,
          events1h: rows24h.filter((row) => row.received_at >= lastMinutes(60)).length,
          deadLetters24h,
          diagnostics,
        }),
        latest_received_at: latest.data?.[0]?.received_at || null,
        latest_occurred_at: latest.data?.[0]?.occurred_at || null,
        breakdowns: {
          event_name: countBy(rangeRows, "event_name"),
          source: countBy(rangeRows, "source"),
          platform: countBy(rangeRows, "platform"),
          entity_type: countBy(rangeRows, "entity_type"),
          auth_share: authShare(rangeRows),
        },
        daily_view: dailyView.available ? dailyView.rows : null,
      },
      diagnostics,
      warnings: diagnostics.warnings,
    });
  } catch (error) {
    return adminFailure(request, "admin/analytics/overview", error, diagnostics);
  }
}

export async function handleAdminAnalyticsTimeseries(request) {
  let diagnostics = null;
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed(request);

    const { supabase, diagnostics: diag } = await requireAdminContext(request);
    diagnostics = diag;
    const { range, since, until } = parseRange(request);

    const [eventsDailyView, sessionsDailyView, usersDailyView, sample] = await Promise.all([
      queryViewRows(supabase, "admin_analytics_overview_daily", { since, until, limit: TIMESERIES_DAYS }),
      queryViewRows(supabase, "analytics_session_daily", { since, until, limit: TIMESERIES_DAYS }),
      queryViewRows(supabase, "analytics_user_daily", { since, until, limit: TIMESERIES_DAYS }),
      fetchSampleEvents(supabase, since, until),
    ]);

    const eventsByDay =
      eventsDailyView.available && eventsDailyView.rows.length > 0
        ? eventsDailyView.rows
            .map((row) => ({
              day: row.day,
              count: row.event_count ?? row.events ?? row.total_events ?? 0,
            }))
            .reverse()
        : aggregateRowsByDay(sample, "received_at");

    const sessionsByDay =
      sessionsDailyView.available && sessionsDailyView.rows.length > 0
        ? sessionsDailyView.rows.map((row) => ({ day: row.day, count: row.session_count ?? row.sessions ?? 0 })).reverse()
        : aggregateRowsByDay(
            sample.map((row) => ({ day: row.received_at?.slice(0, 10), session_id: row.session_id })),
            "day",
          );

    const usersByDay =
      usersDailyView.available && usersDailyView.rows.length > 0
        ? usersDailyView.rows
            .map((row) => ({
              day: row.day,
              authenticated: row.authenticated_users ?? row.users ?? 0,
              anonymous: row.anonymous_ids ?? row.anonymous_users ?? 0,
            }))
            .reverse()
        : aggregateRowsByDay(
            sample.map((row) => ({ day: row.received_at?.slice(0, 10), user_id: row.user_id || row.anonymous_id })),
            "day",
          );

    const deadLetters = await countDeadLettersSince(supabase, since);

    return jsonResponse(200, {
      ok: true,
      request_id: requestIdFromRequest(request),
      range,
      timeseries: {
        events_by_day: eventsByDay,
        sessions_by_day: sessionsByDay,
        users_by_day: usersByDay,
        top_event_names: countBy(sample, "event_name", 8),
        dead_letters_in_range: deadLetters,
      },
      diagnostics,
      warnings: diagnostics.warnings,
    });
  } catch (error) {
    return adminFailure(request, "admin/analytics/timeseries", error, diagnostics);
  }
}

export async function handleAdminAnalyticsTopContent(request) {
  let diagnostics = null;
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed(request);

    const { supabase, diagnostics: diag } = await requireAdminContext(request);
    diagnostics = diag;
    const { range, since, until } = parseRange(request);
    const entityType = new URL(request.url).searchParams.get("entity_type");

    const view = await queryViewRows(supabase, "admin_top_content_daily", { since, until, limit: 100 });
    let items = [];

    if (view.available && view.rows.length > 0) {
      items = view.rows.map((row) => ({
        entity_id: row.entity_id,
        entity_type: row.entity_type,
        impressions: row.impressions ?? row.impression_count ?? null,
        clicks: row.clicks ?? row.click_count ?? row.views ?? null,
        likes: row.likes ?? null,
        saves: row.saves ?? null,
        shares: row.shares ?? null,
        engagement_rate: row.engagement_rate ?? null,
        last_event_at: row.last_event_at ?? row.day,
        primary_events: row.primary_events ?? null,
      }));
    } else {
      const sample = await fetchSampleEvents(supabase, since, until);
      const grouped = new Map();
      for (const row of sample) {
        if (!row.entity_id || !row.entity_type) continue;
        const key = `${row.entity_type}:${row.entity_id}`;
        const current = grouped.get(key) || {
          entity_id: row.entity_id,
          entity_type: row.entity_type,
          event_count: 0,
          event_names: new Map(),
          last_event_at: row.received_at,
        };
        current.event_count += 1;
        current.event_names.set(row.event_name, (current.event_names.get(row.event_name) || 0) + 1);
        if (row.received_at > current.last_event_at) current.last_event_at = row.received_at;
        grouped.set(key, current);
      }
      items = [...grouped.values()]
        .map((item) => ({
          entity_id: item.entity_id,
          entity_type: item.entity_type,
          event_count: item.event_count,
          primary_events: [...item.event_names.entries()]
            .map(([name, count]) => ({ event_name: name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
          last_event_at: item.last_event_at,
        }))
        .sort((a, b) => b.event_count - a.event_count)
        .slice(0, 50);
    }

    if (entityType) items = items.filter((item) => item.entity_type === entityType);

    const sections = {
      videos: items.filter((item) => item.entity_type === "video").slice(0, 20),
      places: items.filter((item) => item.entity_type === "place").slice(0, 20),
      routes: items.filter((item) => item.entity_type === "route").slice(0, 20),
      profiles: items.filter((item) => item.entity_type === "profile" || item.entity_type === "user").slice(0, 20),
    };

    return jsonResponse(200, {
      ok: true,
      request_id: requestIdFromRequest(request),
      range,
      top_content: sections,
      diagnostics,
      warnings: diagnostics.warnings,
    });
  } catch (error) {
    return adminFailure(request, "admin/analytics/top-content", error, diagnostics);
  }
}

export async function handleAdminAnalyticsSearch(request) {
  let diagnostics = null;
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed(request);

    const { supabase, diagnostics: diag } = await requireAdminContext(request);
    diagnostics = diag;
    const { range, since, until } = parseRange(request);

    const view = await queryViewRows(supabase, "admin_search_insights_daily", { since, until, limit: 31 });
    if (view.available && view.rows.length > 0) {
      const totals = view.rows.reduce(
        (acc, row) => {
          acc.total_searches += row.total_searches ?? row.searches ?? 0;
          acc.no_result_searches += row.no_result_searches ?? 0;
          acc.result_clicks += row.result_clicks ?? row.clicks ?? 0;
          return acc;
        },
        { total_searches: 0, no_result_searches: 0, result_clicks: 0 },
      );

      return jsonResponse(200, {
        ok: true,
        request_id: requestIdFromRequest(request),
        range,
        search: {
          total_searches: totals.total_searches,
          no_result_searches: totals.no_result_searches,
          click_through_rate:
            totals.total_searches > 0 ? Math.round((totals.result_clicks / totals.total_searches) * 1000) / 10 : null,
          daily: view.rows,
          top_query_hashes: [],
          query_length_distribution: [],
          entity_type_breakdown: [],
          top_clicked_entities: [],
        },
        diagnostics,
        warnings: diagnostics.warnings,
      });
    }

    const sample = await fetchSampleEvents(supabase, since, until);
    const searchEvents = sample.filter((row) => String(row.event_name || "").startsWith("search_"));
    const submitted = searchEvents.filter((row) => row.event_name === "search_submitted");
    const noResults = searchEvents.filter((row) => row.event_name === "search_no_results");
    const clicks = searchEvents.filter((row) => row.event_name === "search_result_clicked");

    const queryHashes = new Map();
    const queryLengths = new Map();
    const clickedEntities = new Map();

    for (const row of submitted) {
      const props = row.properties && typeof row.properties === "object" ? row.properties : {};
      const hash = props.query_hash || props.search_query_hash;
      if (hash) queryHashes.set(hash, (queryHashes.get(hash) || 0) + 1);
      const length = props.query_length;
      if (typeof length === "number") {
        const bucket = length <= 5 ? "1-5" : length <= 10 ? "6-10" : length <= 20 ? "11-20" : "21+";
        queryLengths.set(bucket, (queryLengths.get(bucket) || 0) + 1);
      }
    }

    for (const row of clicks) {
      if (!row.entity_id) continue;
      const key = `${row.entity_type || "unknown"}:${row.entity_id}`;
      clickedEntities.set(key, (clickedEntities.get(key) || 0) + 1);
    }

    return jsonResponse(200, {
      ok: true,
      request_id: requestIdFromRequest(request),
      range,
      search: {
        total_searches: submitted.length,
        no_result_searches: noResults.length,
        click_through_rate: submitted.length ? Math.round((clicks.length / submitted.length) * 1000) / 10 : null,
        top_query_hashes: [...queryHashes.entries()]
          .map(([value, count]) => ({ query_hash: value, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20),
        query_length_distribution: [...queryLengths.entries()].map(([bucket, count]) => ({ bucket, count })),
        entity_type_breakdown: countBy(clicks, "entity_type"),
        top_clicked_entities: [...clickedEntities.entries()]
          .map(([key, count]) => {
            const [entity_type, entity_id] = key.split(":");
            return { entity_type, entity_id, count };
          })
          .sort((a, b) => b.count - a.count)
          .slice(0, 20),
      },
      diagnostics,
      warnings: diagnostics.warnings,
    });
  } catch (error) {
    return adminFailure(request, "admin/analytics/search", error, diagnostics);
  }
}

export async function handleAdminAnalyticsEvents(request) {
  let diagnostics = null;
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed(request);

    const { supabase, diagnostics: diag } = await requireAdminContext(request);
    diagnostics = diag;
    const url = new URL(request.url);
    const { since, until } = parseRange(request);
    const limit = Math.min(Number(url.searchParams.get("limit") || EVENT_PAGE_SIZE), EVENT_PAGE_SIZE);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
    const eventName = url.searchParams.get("event_name");
    const source = url.searchParams.get("source");
    const platform = url.searchParams.get("platform");
    const entityType = url.searchParams.get("entity_type");
    const auth = url.searchParams.get("auth");
    const search = url.searchParams.get("q");

    let query = supabase
      .from(EVENTS_TABLE)
      .select(
        "event_id, received_at, occurred_at, event_name, source, platform, entity_type, entity_id, anonymous_id, user_id, session_id, app_version, build_number, properties, context",
        { count: "exact" },
      )
      .gte("received_at", since)
      .lte("received_at", until)
      .order("received_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (eventName) query = query.eq("event_name", eventName);
    if (source) query = query.eq("source", source);
    if (platform) query = query.eq("platform", platform);
    if (entityType) query = query.eq("entity_type", entityType);
    if (auth === "authenticated") query = query.not("user_id", "is", null);
    if (auth === "anonymous") query = query.is("user_id", null);
    if (search) {
      if (search.length > 80) throw new AdminAnalyticsError(400, "Search query is too long.");
      query = query.or(`event_id.eq.${search},entity_id.eq.${search}`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return jsonResponse(200, {
      ok: true,
      request_id: requestIdFromRequest(request),
      pagination: { limit, offset, total: count ?? 0 },
      events: (data || []).map(mapEventRow),
      diagnostics,
      warnings: diagnostics.warnings,
    });
  } catch (error) {
    return adminFailure(request, "admin/analytics/events", error, diagnostics);
  }
}

export async function handleAdminAnalyticsEventDetail(request, eventId) {
  let diagnostics = null;
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed(request);
    if (!eventId) throw new AdminAnalyticsError(400, "event_id is required.");

    const { supabase, diagnostics: diag } = await requireAdminContext(request);
    diagnostics = diag;

    const { data, error } = await supabase
      .from(EVENTS_TABLE)
      .select("event_id, received_at, occurred_at, event_name, source, platform, entity_type, entity_id, properties, context")
      .eq("event_id", eventId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new AdminAnalyticsError(404, "Event not found.");

    return jsonResponse(200, {
      ok: true,
      request_id: requestIdFromRequest(request),
      event: {
        ...mapEventRow(data),
        properties: sanitizeAdminJson(data.properties),
        context: sanitizeAdminJson(data.context),
      },
      diagnostics,
    });
  } catch (error) {
    return adminFailure(request, "admin/analytics/events/:id", error, diagnostics);
  }
}

export async function handleAdminAnalyticsHealth(request) {
  let diagnostics = null;
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed(request);

    const { supabase, diagnostics: diag } = await requireAdminContext(request);
    diagnostics = diag;

    const [events5m, events1h, events24h, deadLetters24h, latest, deadReasons] = await Promise.all([
      countEventsSince(supabase, lastMinutes(5)),
      countEventsSince(supabase, lastMinutes(60)),
      countEventsSince(supabase, lastMinutes(24 * 60)),
      countDeadLettersSince(supabase, lastMinutes(24 * 60)),
      supabase.from(EVENTS_TABLE).select("received_at").order("received_at", { ascending: false }).limit(1),
      supabase
        .from(DEAD_LETTERS_TABLE)
        .select("reason, source")
        .gte("received_at", lastMinutes(24 * 60))
        .limit(500),
    ]);

    if (latest.error) throw latest.error;
    if (deadReasons.error && !analyticsSchemaMissing(deadReasons.error)) throw deadReasons.error;

    const status = computeHealthStatus({ events5m, events1h, deadLetters24h, diagnostics });

    return jsonResponse(200, {
      ok: true,
      request_id: requestIdFromRequest(request),
      health: {
        status,
        events_last_5m: events5m,
        events_last_1h: events1h,
        events_last_24h: events24h,
        dead_letters_last_24h: deadLetters24h,
        rejection_reasons: countBy(deadReasons.data || [], "reason"),
        rejection_sources: countBy(deadReasons.data || [], "source"),
        last_successful_received_at: latest.data?.[0]?.received_at || null,
      },
      diagnostics,
      warnings: diagnostics.warnings,
    });
  } catch (error) {
    return adminFailure(request, "admin/analytics/health", error, diagnostics);
  }
}

export async function handleAdminAnalyticsDeadLetters(request) {
  let diagnostics = null;
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed(request);

    const { supabase, diagnostics: diag } = await requireAdminContext(request);
    diagnostics = diag;
    const url = new URL(request.url);
    const { since, until } = parseRange(request);
    const limit = Math.min(Number(url.searchParams.get("limit") || DEAD_LETTER_PAGE_SIZE), DEAD_LETTER_PAGE_SIZE);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
    const reason = url.searchParams.get("reason");
    const source = url.searchParams.get("source");

    let query = supabase
      .from(DEAD_LETTERS_TABLE)
      .select("id, event_id, user_id, anonymous_id, reason, payload, source, received_at", { count: "exact" })
      .gte("received_at", since)
      .lte("received_at", until)
      .order("received_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (reason) query = query.eq("reason", reason);
    if (source) query = query.eq("source", source);

    const { data, error, count } = await query;
    if (error) throw error;

    return jsonResponse(200, {
      ok: true,
      request_id: requestIdFromRequest(request),
      pagination: { limit, offset, total: count ?? 0 },
      dead_letters: (data || []).map(mapDeadLetterRow),
      diagnostics,
      warnings: diagnostics.warnings,
    });
  } catch (error) {
    return adminFailure(request, "admin/analytics/dead-letters", error, diagnostics);
  }
}

export async function handleAdminAnalyticsAggregate(request) {
  let diagnostics = null;
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "POST") return methodNotAllowed(request);

    const { supabase, diagnostics: diag } = await requireAdminContext(request);
    diagnostics = diag;

    let body;
    try {
      body = await request.json();
    } catch {
      throw new AdminAnalyticsError(400, "Request body must be valid JSON.");
    }

    const day = String(body?.day || "").trim();
    if (!DATE_RE.test(day)) {
      throw new AdminAnalyticsError(400, "day must be YYYY-MM-DD.");
    }

    const { data, error } = await supabase.rpc("aggregate_analytics_events_for_day", { target_day: day });
    if (error) {
      if (analyticsSchemaMissing(error)) {
        throw error;
      }
      throw new AdminAnalyticsError(503, "Aggregation function is not available.", { cause: error });
    }

    logger.info("Analytics aggregation triggered", {
      ...requestLogMeta(request, "admin/analytics/aggregate"),
      day,
      result: safeAggregateResult(data),
    });

    return jsonResponse(200, {
      ok: true,
      request_id: requestIdFromRequest(request),
      day,
      result: safeAggregateResult(data),
      diagnostics,
    });
  } catch (error) {
    return adminFailure(request, "admin/analytics/aggregate", error, diagnostics);
  }
}

function safeAggregateResult(data) {
  if (data == null) return { success: true };
  if (typeof data === "object") return sanitizeAdminJson(data);
  return { value: data };
}

const ADMIN_ANALYTICS_ROUTES = {
  "admin/analytics/overview": handleAdminAnalyticsOverview,
  "admin/analytics/timeseries": handleAdminAnalyticsTimeseries,
  "admin/analytics/top-content": handleAdminAnalyticsTopContent,
  "admin/analytics/search": handleAdminAnalyticsSearch,
  "admin/analytics/events": handleAdminAnalyticsEvents,
  "admin/analytics/health": handleAdminAnalyticsHealth,
  "admin/analytics/dead-letters": handleAdminAnalyticsDeadLetters,
  "admin/analytics/aggregate": handleAdminAnalyticsAggregate,
};

export async function dispatchAdminAnalyticsApi(request, route) {
  if (route.startsWith("admin/analytics/events/")) {
    const eventId = route.slice("admin/analytics/events/".length);
    return handleAdminAnalyticsEventDetail(request, decodeURIComponent(eventId));
  }

  const handler = ADMIN_ANALYTICS_ROUTES[route];
  if (!handler) {
    return jsonResponse(404, { ok: false, error: "Not found.", request_id: requestIdFromRequest(request) });
  }

  return handler(request);
}
