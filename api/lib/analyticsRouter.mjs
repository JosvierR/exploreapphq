import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { errorSummary, logger, requestLogMeta } from "./logger.mjs";
import { incrementCounter, observeTimer, recordSupabaseError } from "./metrics.mjs";
import { requestIdFromRequest } from "./requestContext.mjs";
import { jsonResponse, optionsResponse, requireAdmin } from "./supabaseModeration.mjs";

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
const SENSITIVE_KEY_RE =
  /(token|secret|password|authorization|refresh[_-]?token|access[_-]?token|service[_-]?role|api[_-]?key|email|user[_-]?id)/i;
const LOCATION_KEYS = new Set(["lat", "lng", "latitude", "longitude", "coordinates"]);
const rateBuckets = new Map();

class AnalyticsError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "AnalyticsError";
    this.status = status;
  }
}

function getSupabaseUrl() {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
}

function getSupabaseSecretKey() {
  return (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function createServiceClient() {
  const url = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();
  if (!url || !secretKey) {
    throw new AnalyticsError(500, "Supabase server credentials are not configured.");
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

function reject(reason, event) {
  return {
    reason,
    event_id: typeof event?.event_id === "string" ? event.event_id.slice(0, MAX_ID_LENGTH) : null,
    event_name: typeof event?.event_name === "string" ? event.event_name.slice(0, MAX_TEXT_LENGTH) : null,
  };
}

function validateEvent(event, { userId, batchId, requestId, receivedAt }) {
  if (!isPlainObject(event)) return { rejected: reject("event must be a JSON object", event), warnings: [] };

  const eventId = cleanString(event.event_id, MAX_ID_LENGTH);
  const eventName = cleanString(event.event_name, 80);
  const sessionId = cleanString(event.session_id, MAX_ID_LENGTH);
  const anonymousId = cleanString(event.anonymous_id, MAX_ID_LENGTH);
  const occurredAt = isoTimestamp(event.occurred_at);
  const entityType = normalizeOptionalEnum(event.entity_type, ENTITY_TYPES);
  const platform = normalizeOptionalEnum(event.platform, PLATFORMS);

  if (!eventId) return { rejected: reject("event_id is required", event), warnings: [] };
  if (!eventName) return { rejected: reject("event_name is required", event), warnings: [] };
  if (!EVENT_NAMES.has(eventName)) return { rejected: reject("event_name is not allowed", event), warnings: [] };
  if (!sessionId) return { rejected: reject("session_id is required", event), warnings: [] };
  if (!userId && !anonymousId) return { rejected: reject("anonymous_id is required for anonymous events", event), warnings: [] };
  if (!occurredAt) return { rejected: reject("occurred_at must be an ISO timestamp", event), warnings: [] };
  if (event.entity_type && !entityType) return { rejected: reject("entity_type is invalid", event), warnings: [] };
  if (event.platform && !platform) return { rejected: reject("platform is invalid", event), warnings: [] };

  const properties = sanitizeRootObject(event.properties, "properties");
  if (properties.rejected) return { rejected: reject(properties.warnings[0] || "properties rejected", event), warnings: properties.warnings };

  const context = sanitizeRootObject(event.context, "context");
  if (context.rejected) return { rejected: reject(context.warnings[0] || "context rejected", event), warnings: context.warnings };

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
    occurred_at: occurredAt,
    received_at: receivedAt,
    batch_id: batchId,
    request_id: requestId,
    platform,
    app_version: cleanString(event.app_version, 80),
    build_number: cleanString(event.build_number, 80),
    locale: cleanString(event.locale, 40),
    timezone: cleanString(event.timezone, 80),
    country: cleanString(event.country, 2)?.toUpperCase() || null,
    region: cleanString(event.region, 120),
    city: cleanString(event.city, 120),
    properties: properties.value,
    context: context.value,
  };

  return { row, warnings: [...properties.warnings, ...context.warnings] };
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

async function insertDeadLetters(supabase, rejected, requestId, batchId) {
  if (rejected.length === 0) return;

  try {
    const rows = rejected.map((item) => ({
      request_id: requestId,
      batch_id: batchId,
      event_id: item.event_id,
      event_name: item.event_name,
      reason: item.reason,
      received_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("analytics_event_dead_letters").insert(rows);
    if (error) throw error;
  } catch (error) {
    logger.warn("Analytics dead-letter insert skipped", {
      request_id: requestId,
      error: errorSummary(error),
      rejected_count: rejected.length,
    });
  }
}

async function existingEventIds(supabase, eventIds) {
  if (eventIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("analytics_events")
    .select("event_id")
    .in("event_id", eventIds);

  if (error) throw error;
  return new Set((data || []).map((row) => row.event_id).filter(Boolean));
}

async function insertEvents(supabase, rows) {
  if (rows.length === 0) return { accepted: 0, duplicates: 0 };

  const existing = await existingEventIds(supabase, rows.map((row) => row.event_id));
  const newRows = rows.filter((row) => !existing.has(row.event_id));
  if (newRows.length === 0) {
    return { accepted: 0, duplicates: rows.length };
  }

  const { error } = await supabase.from("analytics_events").insert(newRows);
  if (error?.code === "23505" || /duplicate key/i.test(error?.message || "")) {
    const afterRetry = await existingEventIds(supabase, rows.map((row) => row.event_id));
    const retryRows = rows.filter((row) => !afterRetry.has(row.event_id));
    if (retryRows.length === 0) return { accepted: 0, duplicates: rows.length };

    const retry = await supabase.from("analytics_events").insert(retryRows);
    if (retry.error) throw retry.error;
    return { accepted: retryRows.length, duplicates: rows.length - retryRows.length };
  }
  if (error) throw error;

  return { accepted: newRows.length, duplicates: rows.length - newRows.length };
}

function clientError(error) {
  if (analyticsSchemaMissing(error)) return "Analytics schema not installed.";
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
  const receivedAt = new Date().toISOString();

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

    const batchId = cleanString(body.batch_id, MAX_ID_LENGTH);
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
        batchId,
        requestId,
        receivedAt,
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
      await insertDeadLetters(supabase, rejected, requestId, batchId);
    } else if (rejected.length > 0) {
      try {
        const deadLetterClient = createServiceClient();
        await insertDeadLetters(deadLetterClient, rejected, requestId, batchId);
      } catch (error) {
        logger.warn("Analytics dead-letter skipped without Supabase credentials", {
          request_id: requestId,
          rejected_count: rejected.length,
          error: errorSummary(error),
        });
      }
    }

    const inserted = await insertEvents(supabase, rows);
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
    const status = analyticsSchemaMissing(error) ? 503 : error?.status || 500;
    if (status >= 500) recordSupabaseError("/api/events");
    logger.warn("Analytics events request failed", {
      ...requestLogMeta(request, "events"),
      status,
      error: errorSummary(error),
      duration_ms: Date.now() - started,
    });
    return jsonResponse(status, {
      ok: false,
      error: clientError(error),
      request_id: requestId,
    });
  }
}

function lastHours(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[key] || "unknown";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

async function countSince(supabase, since) {
  const { count, error } = await supabase
    .from("analytics_events")
    .select("event_id", { count: "exact", head: true })
    .gte("received_at", since);
  if (error) throw error;
  return count || 0;
}

function analyticsSchemaMissing(error) {
  return error?.code === "42P01" || /does not exist|schema cache/i.test(error?.message || "");
}

export async function handleAdminAnalyticsOverview(request) {
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed(request);

    const { supabase } = await requireAdmin(request);
    const since24h = lastHours(24);
    const since7d = lastHours(24 * 7);

    const [events24h, events7d, recentResult, latestResult] = await Promise.all([
      countSince(supabase, since24h),
      countSince(supabase, since7d),
      supabase
        .from("analytics_events")
        .select("event_name, entity_type, user_id, anonymous_id, received_at")
        .gte("received_at", since7d)
        .order("received_at", { ascending: false })
        .limit(1000),
      supabase
        .from("analytics_events")
        .select("received_at")
        .order("received_at", { ascending: false })
        .limit(1),
    ]);

    if (recentResult.error) throw recentResult.error;
    if (latestResult.error) throw latestResult.error;

    const recentRows = recentResult.data || [];
    const rows24h = recentRows.filter((row) => row.received_at && row.received_at >= since24h);
    const uniqueUsers = new Set(rows24h.map((row) => row.user_id).filter(Boolean));
    const uniqueAnonymous = new Set(rows24h.map((row) => row.anonymous_id).filter(Boolean));

    return jsonResponse(200, {
      ok: true,
      request_id: requestIdFromRequest(request),
      overview: {
        events_last_24h: events24h,
        events_last_7d: events7d,
        unique_users_last_24h: uniqueUsers.size,
        unique_anonymous_ids_last_24h: uniqueAnonymous.size,
        top_event_names: countBy(recentRows, "event_name"),
        top_entity_types: countBy(recentRows, "entity_type"),
        latest_received_at: latestResult.data?.[0]?.received_at || null,
        ingestion_health: "ok",
      },
      warnings: [],
    });
  } catch (error) {
    if (analyticsSchemaMissing(error)) {
      return jsonResponse(200, {
        ok: true,
        request_id: requestIdFromRequest(request),
        overview: null,
        warnings: ["analytics schema not installed"],
      });
    }

    const status = error?.status || 500;
    logger.warn("Admin analytics overview failed", {
      ...requestLogMeta(request, "admin/analytics/overview"),
      status,
      error: errorSummary(error),
    });
    return jsonResponse(status, {
      ok: false,
      error: status === 401 ? "Authentication required." : status === 403 ? "Access denied." : "Internal server error",
      request_id: requestIdFromRequest(request),
    });
  }
}
