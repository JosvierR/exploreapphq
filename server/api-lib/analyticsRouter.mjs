import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { logger, requestLogMeta } from "./logger.mjs";
import { incrementCounter, observeTimer, recordSupabaseError } from "./metrics.mjs";
import { requestIdFromRequest } from "./requestContext.mjs";
import { jsonResponse, optionsResponse, requireAdmin } from "./supabaseModeration.mjs";

const ANALYTICS_EVENTS_TABLE = "analytics_events";
const ANALYTICS_DEAD_LETTERS_TABLE = "analytics_event_dead_letters";
const MAX_EVENTS_PER_BATCH = 50;
const MAX_PAYLOAD_BYTES = 256 * 1024;
const MAX_JSON_DEPTH = 6;
const MAX_OBJECT_KEYS = 60;
const MAX_ARRAY_ITEMS = 50;
const MAX_STRING_LENGTH = 2000;
const MAX_SANITIZED_BYTES = 16 * 1024;
const MAX_BATCHES_PER_MINUTE = 30;
const MAX_EVENTS_PER_MINUTE = 900;
const MAX_ID_LENGTH = 160;
const MAX_TEXT_LENGTH = 256;
const MAX_LOG_TEXT_LENGTH = 2000;
const REDACTED = "[redacted]";

const ANALYTICS_EVENTS_COLUMNS = [
  "event_id",
  "user_id",
  "anonymous_id",
  "session_id",
  "event_name",
  "event_version",
  "entity_type",
  "entity_id",
  "source",
  "platform",
  "app_version",
  "build_number",
  "device_os",
  "locale",
  "timezone",
  "country",
  "region",
  "city",
  "properties",
  "context",
  "occurred_at",
];

const ANALYTICS_DEAD_LETTER_COLUMNS = ["event_id", "user_id", "anonymous_id", "reason", "payload", "source"];

const EVENT_NAMES = new Set([
  "app_open",
  "session_start",
  "session_end",
  "screen_view",
  "search_submitted",
  "search_result_clicked",
  "search_no_results",
  "video_impression",
  "video_view_start",
  "video_view_3s",
  "video_view_25",
  "video_view_50",
  "video_view_75",
  "video_view_complete",
  "video_skip_fast",
  "video_like",
  "video_unlike",
  "video_comment",
  "video_share",
  "video_open_places_routes",
  "place_impression",
  "place_click",
  "place_save",
  "place_unsave",
  "place_open_map",
  "place_get_directions",
  "place_share",
  "place_call",
  "place_website_click",
  "route_impression",
  "route_click",
  "route_save",
  "route_unsave",
  "route_start",
  "route_step_view",
  "route_complete",
  "route_share",
  "profile_view",
  "follow_user",
  "unfollow_user",
  "report_submitted",
  "content_hidden",
  "content_unhidden",
  "block_user",
  "unblock_user",
  "push_notification_open",
  "deep_link_open",
  "error_boundary_shown",
]);

const ENTITY_TYPES = new Set(["video", "place", "route", "profile", "user", "search", "screen", "notification", "system", null]);
const PLATFORMS = new Set(["ios", "android", "web", "server", null]);
const ANALYTICS_SOURCES = new Set(["mobile", "web", "backend", "admin"]);
const SENSITIVE_KEY_RE =
  /(token|secret|password|authorization|refresh[_-]?token|access[_-]?token|service[_-]?role|api[_-]?key|email|user[_-]?id)/i;
const LOCATION_KEYS = new Set(["lat", "lng", "latitude", "longitude", "coordinates"]);
const rateBuckets = new Map();

class AnalyticsError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.name = "AnalyticsError";
    this.status = status;
    this.code = options.code;
    this.cause = options.cause;
    this.operation = options.operation;
    this.table = options.table;
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
    const match = host.match(/^([a-z0-9-]+)\.supabase\.(co|in)$/i) || host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
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
    throw new AnalyticsError(503, "Supabase server credentials are not configured.", {
      code: "analytics_service_role_missing",
    });
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: WebSocket,
    },
  });
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));
}

function safeLogValue(value, depth = 0, seen = new WeakSet()) {
  if (value == null) return value;
  if (typeof value === "string") return value.slice(0, MAX_LOG_TEXT_LENGTH);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value !== "object") return String(value).slice(0, MAX_LOG_TEXT_LENGTH);
  if (seen.has(value)) return "[circular]";
  if (depth >= 2) return "[object]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => safeLogValue(item, depth + 1, seen));
  }

  const out = {};
  for (const [rawKey, item] of Object.entries(value).slice(0, 25)) {
    const key = String(rawKey).slice(0, 120);
    const normalizedKey = key.toLowerCase();
    out[key] = SENSITIVE_KEY_RE.test(normalizedKey) || LOCATION_KEYS.has(normalizedKey)
      ? REDACTED
      : safeLogValue(item, depth + 1, seen);
  }
  return out;
}

function safeText(value) {
  if (value == null) return undefined;
  if (typeof value === "string") return value.slice(0, MAX_LOG_TEXT_LENGTH);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    for (const key of ["message", "error", "description", "details", "hint"]) {
      if (value[key] !== undefined && value[key] !== value) {
        const nested = safeText(value[key]);
        if (nested && nested !== "[object Object]") return nested;
      }
    }

    try {
      const serialized = JSON.stringify(safeLogValue(value));
      return serialized && serialized !== "{}" ? serialized.slice(0, MAX_LOG_TEXT_LENGTH) : undefined;
    } catch {
      return undefined;
    }
  }
  return String(value).slice(0, MAX_LOG_TEXT_LENGTH);
}

export function serializeErrorForLog(error) {
  if (error instanceof Error) {
    const message = safeText(error.message) === "[object Object]" ? safeText(error.cause) : safeText(error.message);
    return compactObject({
      name: error.name,
      message: message || safeText(error.cause) || error.name,
      code: safeText(error.code),
      status: error.status,
      details: safeText(error.details),
      hint: safeText(error.hint),
      stack: process.env.NODE_ENV === "production" ? undefined : safeText(error.stack),
    });
  }

  if (error && typeof error === "object") {
    const message = safeText(error.message) === "[object Object]" ? safeText(error) : safeText(error.message);
    return compactObject({
      name: safeText(error.name),
      message: message || safeText(error) || "Unknown object error",
      code: safeText(error.code),
      status: error.status,
      details: safeText(error.details),
      hint: safeText(error.hint),
    });
  }

  return {
    message: safeText(error) || "Unknown error",
  };
}

export function classifySupabaseAnalyticsError(error) {
  if (error instanceof AnalyticsError && typeof error.code === "string" && error.code.startsWith("analytics_")) {
    return error.code;
  }

  const serialized = serializeErrorForLog(error);
  const rawCode = String(serialized.code || "").trim();
  const code = rawCode.toUpperCase();
  const message = `${serialized.message || ""} ${serialized.details || ""}`.toLowerCase();
  const hint = String(serialized.hint || "").toLowerCase();

  if (rawCode === "analytics_service_role_missing") return "analytics_service_role_missing";
  if (
    code === "42P01" ||
    code === "PGRST205" ||
    (message.includes("relation") && message.includes("does not exist")) ||
    message.includes("could not find the table")
  ) {
    return "analytics_schema_missing";
  }
  if (code === "42703" || code === "PGRST204" || (message.includes("column") && message.includes("schema cache"))) {
    return "analytics_column_mismatch";
  }
  if (code === "42501" || message.includes("permission denied")) return "analytics_permission_denied";
  if (code === "23514" || code === "23502" || code === "23503") return "analytics_constraint_failed";
  if (code === "23505") return "analytics_duplicate_conflict";
  if (message.includes("schema cache") && hint.includes("reload schema")) return "analytics_schema_cache_stale";

  return "analytics_unknown_supabase_error";
}

function analyticsStatusForCode(code) {
  if (code === "analytics_duplicate_conflict") return 409;
  return 503;
}

function analyticsOperationError(error, operation, table) {
  const code = classifySupabaseAnalyticsError(error);
  return new AnalyticsError(
    analyticsStatusForCode(code),
    code === "analytics_schema_missing" ? "Analytics schema not installed." : "Analytics ingestion is not ready.",
    {
      code,
      cause: error,
      operation,
      table,
    },
  );
}

function logSupabaseOperationFailure(request, route, operation, table, error, extra = {}) {
  const serialized = serializeErrorForLog(error);
  const classifiedCode = classifySupabaseAnalyticsError(error);
  logger.warn("Analytics Supabase operation failed", {
    ...requestLogMeta(request, route),
    operation,
    table,
    error_code: serialized.code,
    error_message: serialized.message,
    error_details: serialized.details,
    error_hint: serialized.hint,
    classified_code: classifiedCode,
    error: serialized,
    ...analyticsSupabaseConfigMeta(),
    ...extra,
  });
}

function methodNotAllowed(request) {
  return jsonResponse(405, {
    ok: false,
    error: "Method not allowed.",
    request_id: requestIdFromRequest(request),
  });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function bearerToken(request) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

function firstIp(request) {
  const raw =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return raw.split(",")[0].trim() || "unknown";
}

function hashValue(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 32);
}

function rateKey(request, anonymousId) {
  return `${hashValue(firstIp(request))}:${anonymousId ? hashValue(anonymousId) : "no-anon"}`;
}

function checkRateLimit(request, anonymousId, eventCount) {
  const now = Date.now();
  const key = rateKey(request, anonymousId);
  const bucket = rateBuckets.get(key);
  const current = bucket && now - bucket.windowStart < 60_000 ? bucket : { windowStart: now, batches: 0, events: 0 };
  current.batches += 1;
  current.events += eventCount;
  rateBuckets.set(key, current);

  if (rateBuckets.size > 5000) {
    for (const [bucketKey, value] of rateBuckets.entries()) {
      if (now - value.windowStart >= 60_000) rateBuckets.delete(bucketKey);
    }
  }

  if (current.batches > MAX_BATCHES_PER_MINUTE || current.events > MAX_EVENTS_PER_MINUTE) {
    throw new AnalyticsError(429, "Too many analytics events. Retry later.");
  }
}

function payloadTooLarge(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  return Number.isFinite(contentLength) && contentLength > MAX_PAYLOAD_BYTES;
}

async function readBody(request) {
  if (payloadTooLarge(request)) {
    throw new AnalyticsError(413, "Analytics payload is too large.");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    throw new AnalyticsError(400, "Request body must be valid JSON.");
  }

  const size = Buffer.byteLength(JSON.stringify(body), "utf8");
  if (size > MAX_PAYLOAD_BYTES) {
    throw new AnalyticsError(413, "Analytics payload is too large.");
  }

  return body;
}

function cleanString(value, max = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function isoTimestamp(value) {
  const text = cleanString(value, 80);
  if (!text) return null;
  const time = Date.parse(text);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

function normalizeOptionalEnum(value, allowed) {
  const text = cleanString(value, 80);
  if (!text) return null;
  return allowed.has(text) ? text : null;
}

function hasExplicitValue(value) {
  if (value === undefined || value === null) return false;
  return typeof value !== "string" || value.trim().length > 0;
}

export function normalizeAnalyticsSource(inputSource, platform) {
  const source = cleanString(inputSource, 80);
  if (!source) {
    if (hasExplicitValue(inputSource)) return null;
    return platform === "web" ? "web" : "mobile";
  }

  const normalized = source.toLowerCase();
  return ANALYTICS_SOURCES.has(normalized) ? normalized : null;
}

function deadLetterSource(event) {
  if (!isPlainObject(event)) return "backend";
  const platform = normalizeOptionalEnum(event.platform, PLATFORMS);
  const source = normalizeAnalyticsSource(event.source, platform);
  if (source) return source;
  return platform === "web" ? "web" : "mobile";
}

function forbiddenTopLevelKey(value) {
  if (!isPlainObject(value)) return null;
  return (
    Object.keys(value).find((key) => {
      const normalizedKey = key.toLowerCase();
      return SENSITIVE_KEY_RE.test(normalizedKey) || LOCATION_KEYS.has(normalizedKey);
    }) || null
  );
}

export function validateAnalyticsEventRow(row) {
  if (!isPlainObject(row)) return { valid: false, reason: "invalid_row" };
  if (!cleanString(row.event_id, MAX_ID_LENGTH)) return { valid: false, reason: "event_id is required" };
  if (!cleanString(row.session_id, MAX_ID_LENGTH)) return { valid: false, reason: "session_id is required" };
  if (!cleanString(row.event_name, 80)) return { valid: false, reason: "event_name is required" };
  if (!Number.isInteger(row.event_version) || row.event_version <= 0) {
    return { valid: false, reason: "event_version is invalid" };
  }
  if (!ANALYTICS_SOURCES.has(row.source)) return { valid: false, reason: "invalid_source" };
  if (!ENTITY_TYPES.has(row.entity_type ?? null)) return { valid: false, reason: "entity_type is invalid" };
  if (!PLATFORMS.has(row.platform ?? null)) return { valid: false, reason: "platform is invalid" };
  if (!isPlainObject(row.properties)) return { valid: false, reason: "properties must be a JSON object" };
  if (!isPlainObject(row.context)) return { valid: false, reason: "context must be a JSON object" };
  if (forbiddenTopLevelKey(row.properties)) return { valid: false, reason: "properties contain forbidden keys" };
  if (forbiddenTopLevelKey(row.context)) return { valid: false, reason: "context contains forbidden keys" };
  return { valid: true, reason: null };
}

function sanitizeJson(value, path = "root", depth = 0) {
  const warnings = [];
  if (depth > MAX_JSON_DEPTH) {
    return { value: null, warnings: [`${path} exceeded max depth`], rejected: true };
  }

  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return { value, warnings, rejected: false };
  }

  if (typeof value === "string") {
    return {
      value: value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) : value,
      warnings: value.length > MAX_STRING_LENGTH ? [`${path} string truncated`] : warnings,
      rejected: false,
    };
  }

  if (Array.isArray(value)) {
    const out = [];
    for (const item of value.slice(0, MAX_ARRAY_ITEMS)) {
      const sanitized = sanitizeJson(item, path, depth + 1);
      warnings.push(...sanitized.warnings);
      if (sanitized.rejected) return { value: null, warnings, rejected: true };
      out.push(sanitized.value);
    }
    if (value.length > MAX_ARRAY_ITEMS) warnings.push(`${path} array truncated`);
    return { value: out, warnings, rejected: false };
  }

  if (!isPlainObject(value)) {
    return { value: null, warnings: [`${path} contains unsupported JSON value`], rejected: true };
  }

  const entries = Object.entries(value);
  if (entries.length > MAX_OBJECT_KEYS) {
    return { value: null, warnings: [`${path} has too many keys`], rejected: true };
  }

  const out = {};
  for (const [rawKey, rawValue] of entries) {
    const key = cleanString(rawKey, 120);
    if (!key) continue;
    const normalizedKey = key.toLowerCase();
    if (SENSITIVE_KEY_RE.test(normalizedKey) || LOCATION_KEYS.has(normalizedKey)) {
      warnings.push(`${path}.${key} redacted`);
      continue;
    }

    const sanitized = sanitizeJson(rawValue, `${path}.${key}`, depth + 1);
    warnings.push(...sanitized.warnings);
    if (sanitized.rejected) return { value: null, warnings, rejected: true };
    out[key] = sanitized.value;
  }

  if (Buffer.byteLength(JSON.stringify(out), "utf8") > MAX_SANITIZED_BYTES) {
    return { value: null, warnings: [`${path} sanitized payload too large`], rejected: true };
  }

  return { value: out, warnings, rejected: false };
}

function sanitizeRootObject(value, label) {
  if (value === undefined) return { value: {}, warnings: [], rejected: false };
  if (!isPlainObject(value)) {
    return {
      value: {},
      warnings: [`${label} must be a JSON object`],
      rejected: true,
    };
  }
  return sanitizeJson(value, label);
}

function sanitizedDeadLetterPayload(event) {
  if (!isPlainObject(event)) {
    return {
      type: event === null ? "null" : typeof event,
    };
  }

  const sanitized = sanitizeJson(event, "event");
  if (sanitized.rejected) {
    return {
      rejected: true,
      warnings: sanitized.warnings.slice(0, 10),
    };
  }

  return sanitized.value || {};
}

function reject(reason, event, userId = null) {
  return {
    reason,
    event_id: typeof event?.event_id === "string" ? event.event_id.slice(0, MAX_ID_LENGTH) : null,
    event_name: typeof event?.event_name === "string" ? event.event_name.slice(0, MAX_TEXT_LENGTH) : null,
    user_id: userId || null,
    anonymous_id: typeof event?.anonymous_id === "string" ? event.anonymous_id.slice(0, MAX_ID_LENGTH) : null,
    payload: sanitizedDeadLetterPayload(event),
    source: deadLetterSource(event),
  };
}

export function normalizeAnalyticsEvent(event, { userId = null } = {}) {
  if (!isPlainObject(event)) return { rejected: reject("event must be a JSON object", event, userId), warnings: [] };

  const eventId = cleanString(event.event_id, MAX_ID_LENGTH);
  const eventName = cleanString(event.event_name, 80);
  const sessionId = cleanString(event.session_id, MAX_ID_LENGTH);
  const anonymousId = cleanString(event.anonymous_id, MAX_ID_LENGTH);
  const occurredAt = isoTimestamp(event.occurred_at);
  const entityType = normalizeOptionalEnum(event.entity_type, ENTITY_TYPES);
  const platform = normalizeOptionalEnum(event.platform, PLATFORMS);
  const source = normalizeAnalyticsSource(event.source, platform);

  if (!eventId) return { rejected: reject("event_id is required", event, userId), warnings: [] };
  if (!eventName) return { rejected: reject("event_name is required", event, userId), warnings: [] };
  if (!EVENT_NAMES.has(eventName)) return { rejected: reject("event_name is not allowed", event, userId), warnings: [] };
  if (!sessionId) return { rejected: reject("session_id is required", event, userId), warnings: [] };
  if (!userId && !anonymousId) return { rejected: reject("anonymous_id is required for anonymous events", event, userId), warnings: [] };
  if (!occurredAt) return { rejected: reject("occurred_at must be an ISO timestamp", event, userId), warnings: [] };
  if (event.entity_type && !entityType) return { rejected: reject("entity_type is invalid", event, userId), warnings: [] };
  if (event.platform && !platform) return { rejected: reject("platform is invalid", event, userId), warnings: [] };
  if (!source) return { rejected: reject("invalid_source", event, userId), warnings: [] };

  const properties = sanitizeRootObject(event.properties, "properties");
  if (properties.rejected) {
    return { rejected: reject(properties.warnings[0] || "properties rejected", event, userId), warnings: properties.warnings };
  }

  const context = sanitizeRootObject(event.context, "context");
  if (context.rejected) {
    return { rejected: reject(context.warnings[0] || "context rejected", event, userId), warnings: context.warnings };
  }

  const eventVersion = Number.isInteger(event.event_version) && event.event_version > 0 ? event.event_version : 1;
  const row = {
    event_id: eventId,
    event_name: eventName,
    event_version: Math.min(eventVersion, 100),
    user_id: userId || null,
    anonymous_id: anonymousId,
    session_id: sessionId,
    entity_type: entityType,
    entity_id: cleanString(event.entity_id, MAX_ID_LENGTH),
    source,
    platform,
    app_version: cleanString(event.app_version, 80),
    build_number: cleanString(event.build_number, 80),
    device_os: cleanString(event.device_os, 80),
    locale: cleanString(event.locale, 40),
    timezone: cleanString(event.timezone, 80),
    country: cleanString(event.country, 2)?.toUpperCase() || null,
    region: cleanString(event.region, 120),
    city: cleanString(event.city, 120),
    properties: properties.value,
    context: context.value,
    occurred_at: occurredAt,
  };

  const rowValidation = validateAnalyticsEventRow(row);
  if (!rowValidation.valid) {
    return { rejected: reject(rowValidation.reason || "invalid_row", event, userId), warnings: [] };
  }

  return { row, warnings: [...properties.warnings, ...context.warnings] };
}

function validateEvent(event, context) {
  return normalizeAnalyticsEvent(event, context);
}

async function authContext(request, supabase) {
  const token = bearerToken(request);
  if (!token) return { userId: null, authenticated: false };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new AnalyticsError(401, "Invalid or expired Supabase user token.");
  }

  return { userId: data.user.id, authenticated: true };
}

async function insertDeadLetters(supabase, rejected, context) {
  if (rejected.length === 0) return;

  try {
    const rows = rejected.map((item) => ({
      event_id: item.event_id,
      user_id: item.user_id,
      anonymous_id: item.anonymous_id,
      reason: item.reason,
      payload: item.payload,
      source: item.source,
    }));
    const { error } = await supabase.from(ANALYTICS_DEAD_LETTERS_TABLE).insert(rows);
    if (error) throw error;
  } catch (error) {
    logSupabaseOperationFailure(context.request, "events", "insertDeadLetters insert", ANALYTICS_DEAD_LETTERS_TABLE, error, {
      rejected_count: rejected.length,
    });
  }
}

async function existingEventIds(supabase, eventIds, context) {
  if (eventIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from(ANALYTICS_EVENTS_TABLE)
    .select("event_id")
    .in("event_id", eventIds);

  if (error) {
    logSupabaseOperationFailure(context.request, "events", "existingEventIds select", ANALYTICS_EVENTS_TABLE, error, {
      event_id_count: eventIds.length,
    });
    throw analyticsOperationError(error, "existingEventIds select", ANALYTICS_EVENTS_TABLE);
  }
  return new Set((data || []).map((row) => row.event_id).filter(Boolean));
}

async function insertEvents(supabase, rows, context) {
  if (rows.length === 0) return { accepted: 0, duplicates: 0 };

  const eventIds = rows.map((row) => row.event_id);
  const existing = await existingEventIds(supabase, eventIds, context);
  const newRows = rows.filter((row) => !existing.has(row.event_id));
  if (newRows.length === 0) {
    return { accepted: 0, duplicates: rows.length };
  }

  const { error } = await supabase.from(ANALYTICS_EVENTS_TABLE).insert(newRows);
  if (error?.code === "23505" || /duplicate key/i.test(error?.message || "")) {
    const afterRetry = await existingEventIds(supabase, eventIds, context);
    const retryRows = rows.filter((row) => !afterRetry.has(row.event_id));
    if (retryRows.length === 0) return { accepted: 0, duplicates: rows.length };

    const retry = await supabase.from(ANALYTICS_EVENTS_TABLE).insert(retryRows);
    if (retry.error) {
      logSupabaseOperationFailure(context.request, "events", "insertEvents retry insert", ANALYTICS_EVENTS_TABLE, retry.error, {
        row_count: retryRows.length,
      });
      throw analyticsOperationError(retry.error, "insertEvents retry insert", ANALYTICS_EVENTS_TABLE);
    }
    return { accepted: retryRows.length, duplicates: rows.length - retryRows.length };
  }
  if (error) {
    logSupabaseOperationFailure(context.request, "events", "insertEvents insert", ANALYTICS_EVENTS_TABLE, error, {
      row_count: newRows.length,
    });
    throw analyticsOperationError(error, "insertEvents insert", ANALYTICS_EVENTS_TABLE);
  }

  return { accepted: newRows.length, duplicates: rows.length - newRows.length };
}

function publicAnalyticsErrorCode(error) {
  if (error instanceof AnalyticsError && typeof error.code === "string" && error.code.startsWith("analytics_")) {
    return error.code;
  }

  const candidate = error?.cause || error;
  if (candidate && typeof candidate === "object" && (candidate.code || candidate.details || candidate.hint)) {
    return classifySupabaseAnalyticsError(candidate);
  }

  return null;
}

function statusForError(error) {
  const code = publicAnalyticsErrorCode(error);
  if (code) return analyticsStatusForCode(code);
  return error?.status || 500;
}

function clientError(error) {
  const code = publicAnalyticsErrorCode(error);
  if (code === "analytics_schema_missing") return "Analytics schema not installed.";
  if (code) return "Analytics ingestion is not ready.";
  const status = error?.status || 500;
  if (status === 401) return "Authentication required.";
  if (status === 413) return "Analytics payload is too large.";
  if (status === 429) return "Too many analytics events. Retry later.";
  if (status >= 500) return "Internal server error.";
  return error instanceof Error ? error.message : "Request failed.";
}

export function analyticsEventAllowlist() {
  return [...EVENT_NAMES].sort();
}

export async function handleEvents(request) {
  const started = Date.now();
  const requestId = requestIdFromRequest(request);

  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "POST") return methodNotAllowed(request);

    const body = await readBody(request);
    if (!isPlainObject(body)) throw new AnalyticsError(400, "Request body must be a JSON object.");
    if (!Array.isArray(body.events)) throw new AnalyticsError(400, "events must be an array.");
    if (body.events.length === 0) throw new AnalyticsError(400, "events must include at least one event.");
    if (body.events.length > MAX_EVENTS_PER_BATCH) {
      throw new AnalyticsError(400, `events cannot contain more than ${MAX_EVENTS_PER_BATCH} items.`);
    }

    const sentAt = body.sent_at === undefined ? null : isoTimestamp(body.sent_at);
    if (body.sent_at !== undefined && !sentAt) throw new AnalyticsError(400, "sent_at must be an ISO timestamp.");

    const firstAnonymousId = cleanString(body.events.find((event) => isPlainObject(event))?.anonymous_id, MAX_ID_LENGTH);
    checkRateLimit(request, firstAnonymousId, body.events.length);

    const hasBearerToken = Boolean(bearerToken(request));
    let supabase = hasBearerToken ? createServiceClient() : null;
    const auth = hasBearerToken ? await authContext(request, supabase) : { userId: null, authenticated: false };
    const warnings = [];
    const rejected = [];
    const rows = [];

    for (const event of body.events) {
      const result = validateEvent(event, {
        userId: auth.userId,
      });
      warnings.push(...result.warnings);
      if (result.rejected) {
        rejected.push(result.rejected);
      } else {
        rows.push(result.row);
      }
    }

    if (rows.length > 0) {
      supabase = supabase || createServiceClient();
    }

    if (supabase) {
      await insertDeadLetters(supabase, rejected, { request, requestId });
    } else if (rejected.length > 0) {
      try {
        const deadLetterClient = createServiceClient();
        await insertDeadLetters(deadLetterClient, rejected, { request, requestId });
      } catch (error) {
        logger.warn("Analytics dead-letter skipped without Supabase credentials", {
          request_id: requestId,
          rejected_count: rejected.length,
          error: serializeErrorForLog(error),
          classified_code: publicAnalyticsErrorCode(error),
          ...analyticsSupabaseConfigMeta(),
        });
      }
    }

    const inserted = await insertEvents(supabase, rows, { request, requestId });
    const durationMs = Date.now() - started;

    incrementCounter("explore_analytics_events_accepted_total", { authenticated: String(auth.authenticated) }, inserted.accepted);
    incrementCounter("explore_analytics_events_rejected_total", { authenticated: String(auth.authenticated) }, rejected.length);
    incrementCounter("explore_analytics_events_duplicates_total", { authenticated: String(auth.authenticated) }, inserted.duplicates);
    observeTimer("explore_analytics_ingest_duration_ms", durationMs, { authenticated: String(auth.authenticated) });

    logger.info("Analytics events ingested", {
      ...requestLogMeta(request, "events"),
      accepted: inserted.accepted,
      rejected: rejected.length,
      duplicates: inserted.duplicates,
      authenticated: auth.authenticated,
      duration_ms: durationMs,
      warning_count: warnings.length,
    });

    return jsonResponse(200, {
      ok: true,
      request_id: requestId,
      accepted: inserted.accepted,
      duplicates: inserted.duplicates,
      rejected: rejected.length,
      warning_count: warnings.length,
      warnings: warnings.slice(0, 20),
    });
  } catch (error) {
    const status = statusForError(error);
    const code = publicAnalyticsErrorCode(error);
    if (status >= 500) recordSupabaseError("/api/events");
    logger.warn("Analytics events request failed", {
      ...requestLogMeta(request, "events"),
      status,
      operation: error?.operation,
      table: error?.table,
      classified_code: code,
      error: serializeErrorForLog(error?.cause || error),
      ...analyticsSupabaseConfigMeta(),
      duration_ms: Date.now() - started,
    });
    const body = {
      ok: false,
      error: clientError(error),
      request_id: requestId,
    };
    if (code) body.code = code;
    return jsonResponse(status, body);
  }
}
