import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { jsonResponse, optionsResponse } from "../http/responses.mjs";
import { requestIdFromRequest } from "../http/requestContext.mjs";
import { appEnvironment, appVersion, errorSummary, logger, requestLogMeta } from "../observability/logger.mjs";
import { recordAdminAction, recordModerationAction, recordSupabaseError } from "../observability/metrics.mjs";

export { jsonResponse, optionsResponse };

const CONTENT_TYPES = new Set(["video", "user", "place", "place_photo"]);
const REPORT_REASONS = new Set([
  "spam",
  "inappropriate",
  "harassment",
  "violence",
  "sexual_content",
  "fake",
  "other",
]);
const REPORT_STATUSES = new Set(["pending", "reviewed", "dismissed", "removed"]);
const ADMIN_REPORT_STATUSES = new Set(["pending", "reviewed", "dismissed", "removed", "all"]);
const ADMIN_REPORT_SORTS = new Set(["newest", "oldest"]);
const ADMIN_REPORT_REASON_FILTERS = new Set([...REPORT_REASONS, "all"]);
const VISIBILITY_STATUSES = ["active", "under_review", "hidden", "removed"];
const HIDDEN_CONTENT_REASONS = new Set(["reported", "hidden_by_user"]);
const ACTION_TYPES = new Set([
  "hide_video",
  "restore_video",
  "hide_place",
  "restore_place",
  "suspend_user",
  "unsuspend_user",
  "dismiss_report",
  "mark_reviewed",
  "reopen_report",
  "remove_content",
]);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function methodNotAllowed() {
  return jsonResponse(405, { ok: false, error: "Method not allowed." });
}

function safeClientError(error, status) {
  if (status === 401) return "Authentication required.";
  if (status === 403) return "Access denied.";
  if (status >= 500) return "Internal server error.";
  return error instanceof Error ? error.message : "Request failed.";
}

function handleError(error, request) {
  const status = error instanceof HttpError ? error.status : error?.status || 500;
  const meta = request
    ? requestLogMeta(request, new URL(request.url).pathname.replace(/^\/api\/?/, ""))
    : {};

  if (status >= 500) {
    recordSupabaseError(meta.route || "unknown");
    logger.error("Moderation API error", {
      ...meta,
      status,
      error: errorSummary(error),
    });
  } else {
    logger.warn("Moderation API rejected request", {
      ...meta,
      status,
      error: errorSummary(error),
    });
  }

  return jsonResponse(status, {
    ok: false,
    error: safeClientError(error, status),
    request_id: request ? requestIdFromRequest(request) : undefined,
  });
}

function getSupabaseUrl() {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
}

function getSupabasePublishableKey() {
  return (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim();
}

function getSupabaseSecretKey() {
  return (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

export async function handleHealth(request) {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "GET") return methodNotAllowed();

  const supabaseUrlConfigured = Boolean(getSupabaseUrl());
  const publishableKeyConfigured = Boolean(getSupabasePublishableKey());
  const secretKeyConfigured = Boolean(getSupabaseSecretKey());

  return jsonResponse(200, {
    ok: true,
    service: "explore-web-admin",
    environment: appEnvironment(),
    version: appVersion(),
    timestamp: new Date().toISOString(),
    request_id: requestIdFromRequest(request),
    checks: {
      api: "ok",
      supabase_url_configured: supabaseUrlConfigured,
      supabase_publishable_configured: publishableKeyConfigured,
      supabase_service_configured: secretKeyConfigured,
      admin_routes: "ok",
    },
    supabaseUrlConfigured,
    publishableKeyConfigured,
    secretKeyConfigured,
  });
}

function createServiceClient() {
  const url = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();

  if (!url || !secretKey) {
    throw new HttpError(
      500,
      "Supabase server credentials are not configured. Set VITE_SUPABASE_URL and SUPABASE_SECRET_KEY.",
    );
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

function getBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

async function requireUser(request) {
  const token = getBearerToken(request);
  if (!token) {
    throw new HttpError(401, "A valid Supabase user token is required.");
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new HttpError(401, "Invalid or expired Supabase user token.");
  }

  return { supabase, token, user: data.user };
}

function allowedAdminEmails() {
  const raw =
    process.env.EXPLORE_ADMIN_ALLOWED_EMAILS ||
    process.env.ADMIN_ALLOWED_EMAILS ||
    process.env.VITE_ADMIN_EMAILS ||
    "";

  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdmin(request) {
  const context = await requireUser(request);
  const email = context.user.email?.trim().toLowerCase() || "";

  const { data, error } = await context.supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (data && ["admin", "moderator"].includes(data.role)) {
    return { ...context, role: data.role, email };
  }

  const fallbackEmails = allowedAdminEmails();
  if (email && fallbackEmails.includes(email)) {
    return { ...context, role: "admin", email, fallback: true };
  }

  if (error) {
    throw new HttpError(
      403,
      "This account is not in admin_users, and no EXPLORE_ADMIN_ALLOWED_EMAILS fallback matched.",
    );
  }

  throw new HttpError(403, "Access denied.");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

function validateReportBody(body) {
  if (!isPlainObject(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const contentType = typeof body.content_type === "string" ? body.content_type.trim() : "";
  const contentId = typeof body.content_id === "string" ? body.content_id.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const details =
    typeof body.details === "string" && body.details.trim() ? body.details.trim().slice(0, 4000) : null;
  const metadata = body.metadata === undefined ? {} : body.metadata;
  const hideForReporter = body.hide_for_reporter === undefined ? false : body.hide_for_reporter;

  if (!CONTENT_TYPES.has(contentType)) {
    throw new HttpError(400, "content_type must be video, user, place, or place_photo.");
  }

  if (!contentId || contentId.length > 256) {
    throw new HttpError(400, "content_id is required and must be 256 characters or fewer.");
  }

  if (!REPORT_REASONS.has(reason)) {
    throw new HttpError(400, "reason is invalid.");
  }

  if (!isPlainObject(metadata)) {
    throw new HttpError(400, "metadata must be a JSON object when provided.");
  }

  if (typeof hideForReporter !== "boolean") {
    throw new HttpError(400, "hide_for_reporter must be a boolean when provided.");
  }

  return {
    content_type: contentType,
    content_id: contentId,
    reason,
    details,
    metadata,
    hide_for_reporter: hideForReporter,
  };
}

function duplicateError(error) {
  return error?.code === "23505" || /duplicate key/i.test(error?.message || "");
}

async function ensureHiddenContentForUser(
  supabase,
  { userId, contentType, contentId, reason = "reported" },
) {
  const { error } = await supabase
    .from("user_hidden_content")
    .upsert(
      {
        user_id: userId,
        content_type: contentType,
        content_id: contentId,
        reason,
      },
      { onConflict: "user_id,content_type,content_id" },
    );

  if (error) throw error;
  return true;
}

export async function handleReports(request) {
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "POST") return methodNotAllowed();

    const { supabase, user } = await requireUser(request);
    const input = validateReportBody(await readJson(request));
    const { hide_for_reporter: hideForReporter, ...reportInput } = input;

    const existing = await supabase
      .from("content_reports")
      .select("id")
      .eq("reporter_id", user.id)
      .eq("content_type", input.content_type)
      .eq("content_id", input.content_id)
      .maybeSingle();

    if (existing.data) {
      if (hideForReporter) {
        await ensureHiddenContentForUser(supabase, {
          userId: user.id,
          contentType: input.content_type,
          contentId: input.content_id,
          reason: "reported",
        });
      }

      return jsonResponse(200, {
        ok: true,
        already_reported: true,
        hidden_for_reporter: hideForReporter,
      });
    }

    if (existing.error) {
      throw existing.error;
    }

    const { data, error } = await supabase
      .from("content_reports")
      .insert({
        ...reportInput,
        reporter_id: user.id,
        status: "pending",
      })
      .select("id, status")
      .single();

    if (duplicateError(error)) {
      if (hideForReporter) {
        await ensureHiddenContentForUser(supabase, {
          userId: user.id,
          contentType: input.content_type,
          contentId: input.content_id,
          reason: "reported",
        });
      }

      return jsonResponse(200, {
        ok: true,
        already_reported: true,
        hidden_for_reporter: hideForReporter,
      });
    }

    if (error) throw error;

    if (hideForReporter) {
      await ensureHiddenContentForUser(supabase, {
        userId: user.id,
        contentType: input.content_type,
        contentId: input.content_id,
        reason: "reported",
      });
    }

    return jsonResponse(201, {
      ok: true,
      report_id: data.id,
      status: data.status,
      hidden_for_reporter: hideForReporter,
    });
  } catch (error) {
    return handleError(error, request);
  }
}

function validateHiddenContentBody(body, { requireReason }) {
  if (!isPlainObject(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const contentType = typeof body.content_type === "string" ? body.content_type.trim() : "";
  const contentId = typeof body.content_id === "string" ? body.content_id.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!CONTENT_TYPES.has(contentType)) {
    throw new HttpError(400, "content_type must be video, user, place, or place_photo.");
  }

  if (!contentId || contentId.length > 256) {
    throw new HttpError(400, "content_id is required and must be 256 characters or fewer.");
  }

  if (requireReason && !HIDDEN_CONTENT_REASONS.has(reason)) {
    throw new HttpError(400, "reason must be reported or hidden_by_user.");
  }

  return {
    content_type: contentType,
    content_id: contentId,
    reason: requireReason ? reason : null,
  };
}

export async function handleUserHiddenContent(request) {
  try {
    if (request.method === "OPTIONS") return optionsResponse();

    const { supabase, user } = await requireUser(request);

    if (request.method === "GET") {
      const url = new URL(request.url);
      const contentType = url.searchParams.get("content_type")?.trim() || "";

      if (contentType && !CONTENT_TYPES.has(contentType)) {
        throw new HttpError(400, "content_type must be video, user, place, or place_photo.");
      }

      let query = supabase
        .from("user_hidden_content")
        .select("content_type, content_id, reason, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (contentType) query = query.eq("content_type", contentType);

      const { data, error } = await query;
      if (error) throw error;

      return jsonResponse(200, { ok: true, items: data || [] });
    }

    if (request.method === "POST") {
      const input = validateHiddenContentBody(await readJson(request), { requireReason: true });

      await ensureHiddenContentForUser(supabase, {
        userId: user.id,
        contentType: input.content_type,
        contentId: input.content_id,
        reason: input.reason,
      });

      return jsonResponse(200, { ok: true });
    }

    return methodNotAllowed();
  } catch (error) {
    return handleError(error, request);
  }
}

export async function handleUserHiddenContentUnhide(request) {
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "POST") return methodNotAllowed();

    const { supabase, user } = await requireUser(request);
    const input = validateHiddenContentBody(await readJson(request), { requireReason: false });

    const { error } = await supabase
      .from("user_hidden_content")
      .delete()
      .eq("user_id", user.id)
      .eq("content_type", input.content_type)
      .eq("content_id", input.content_id);

    if (error) throw error;

    return jsonResponse(200, { ok: true });
  } catch (error) {
    return handleError(error, request);
  }
}

function parseEnumParam(url, name, validValues, fallback) {
  const value = url.searchParams.get(name)?.trim() || fallback;
  if (!validValues.has(value)) {
    throw new HttpError(400, `${name} is invalid.`);
  }
  return value;
}

function parseLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(Math.floor(parsed), 100);
}

function parseOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function groupReportIds(reports) {
  const groups = new Map();
  for (const report of reports) {
    if (!groups.has(report.content_type)) groups.set(report.content_type, new Set());
    groups.get(report.content_type).add(report.content_id);
  }
  return groups;
}

async function fetchRowsById(supabase, table, ids) {
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase.from(table).select("*").in("id", ids);
  if (error || !data) return new Map();

  return new Map(data.map((row) => [String(row.id), row]));
}

async function fetchTargetPreviewMaps(supabase, reports) {
  const grouped = groupReportIds(reports);
  const previews = new Map();

  async function addRows(contentType, table) {
    const ids = [...(grouped.get(contentType) || [])];
    const rows = await fetchRowsById(supabase, table, ids);
    for (const [id, row] of rows) previews.set(`${contentType}:${id}`, row);
  }

  await Promise.all([
    addRows("video", "videos"),
    addRows("place", "places"),
    addRows("place_photo", "place_photos"),
    addRows("user", "profiles"),
  ]);

  const userIds = [...(grouped.get("user") || [])].filter((id) => !previews.has(`user:${id}`));
  if (userIds.length > 0) {
    const rows = await fetchRowsById(supabase, "users", userIds);
    for (const [id, row] of rows) previews.set(`user:${id}`, row);
  }

  return previews;
}

function actionHistoryRow(action) {
  return {
    id: action.id,
    report_id: action.report_id,
    admin_id: action.admin_id,
    target_type: action.target_type,
    target_id: action.target_id,
    action_type: action.action_type,
    notes: action.notes,
    created_at: action.created_at,
  };
}

function reportTargetKey(contentType, contentId) {
  return `${contentType}:${contentId}`;
}

async function fetchReportCountsByTarget(supabase, reports) {
  const grouped = groupReportIds(reports);
  const counts = new Map();

  await Promise.all(
    [...grouped.entries()].map(async ([contentType, ids]) => {
      const idList = [...ids];
      if (idList.length === 0) return;

      const { data, error } = await supabase
        .from("content_reports")
        .select("content_type, content_id")
        .eq("content_type", contentType)
        .in("content_id", idList);

      if (error || !data) return;

      for (const row of data) {
        const key = reportTargetKey(row.content_type, row.content_id);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }),
  );

  return counts;
}

function mergeActionRows(rows) {
  const merged = new Map();
  for (const row of rows.flat()) {
    if (row?.id) merged.set(row.id, actionHistoryRow(row));
  }
  return [...merged.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

async function fetchActionHistoryForReports(supabase, reports) {
  if (reports.length === 0) return new Map();

  try {
    const reportIds = reports.map((report) => report.id).filter(Boolean);
    const grouped = groupReportIds(reports);
    const queries = [];

    if (reportIds.length > 0) {
      queries.push(
        supabase
          .from("moderation_actions")
          .select("id, admin_id, report_id, target_type, target_id, action_type, notes, created_at")
          .in("report_id", reportIds)
          .order("created_at", { ascending: false })
          .limit(200),
      );
    }

    for (const [contentType, ids] of grouped.entries()) {
      const idList = [...ids];
      if (idList.length === 0) continue;
      queries.push(
        supabase
          .from("moderation_actions")
          .select("id, admin_id, report_id, target_type, target_id, action_type, notes, created_at")
          .eq("target_type", contentType)
          .in("target_id", idList)
          .order("created_at", { ascending: false })
          .limit(200),
      );
    }

    const results = await Promise.all(queries);
    const actions = mergeActionRows(results.map((result) => (result.error ? [] : result.data || [])));
    const actionMap = new Map();

    for (const report of reports) {
      const targetKey = reportTargetKey(report.content_type, report.content_id);
      actionMap.set(
        report.id,
        actions.filter(
          (action) =>
            action.report_id === report.id ||
            reportTargetKey(action.target_type, action.target_id) === targetKey,
        ),
      );
    }

    return actionMap;
  } catch {
    return new Map();
  }
}

function relatedReportRow(report) {
  return {
    id: report.id,
    content_type: report.content_type,
    content_id: report.content_id,
    reason: report.reason,
    status: report.status,
    reporter_id: report.reporter_id,
    created_at: report.created_at,
  };
}

async function fetchRelatedReportsForTargets(supabase, reports) {
  if (reports.length === 0) return new Map();

  const grouped = groupReportIds(reports);
  const relatedMap = new Map();

  await Promise.all(
    [...grouped.entries()].map(async ([contentType, ids]) => {
      const idList = [...ids];
      if (idList.length === 0) return;

      const { data, error } = await supabase
        .from("content_reports")
        .select("id, content_type, content_id, reason, status, reporter_id, created_at")
        .eq("content_type", contentType)
        .in("content_id", idList)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error || !data) return;

      for (const row of data) {
        const key = reportTargetKey(row.content_type, row.content_id);
        if (!relatedMap.has(key)) relatedMap.set(key, []);
        relatedMap.get(key).push(relatedReportRow(row));
      }
    }),
  );

  return relatedMap;
}

async function fetchReporterHiddenTargets(supabase, reports) {
  if (reports.length === 0) return new Map();

  const hiddenMap = new Map();
  const grouped = groupReportIds(reports);
  const reporterIds = [...new Set(reports.map((report) => report.reporter_id).filter(Boolean))];
  if (reporterIds.length === 0) return hiddenMap;

  await Promise.all(
    [...grouped.entries()].map(async ([contentType, ids]) => {
      const idList = [...ids];
      if (idList.length === 0) return;

      const { data, error } = await supabase
        .from("user_hidden_content")
        .select("user_id, content_type, content_id")
        .in("user_id", reporterIds)
        .eq("content_type", contentType)
        .in("content_id", idList);

      if (error || !data) return;

      for (const row of data) {
        hiddenMap.set(`${row.user_id}:${row.content_type}:${row.content_id}`, true);
      }
    }),
  );

  return hiddenMap;
}

function firstField(row, names) {
  if (!row) return undefined;

  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return undefined;
}

function nullableString(value) {
  return value === undefined || value === null || value === "" ? null : String(value);
}

function nullableNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function publicMediaUrl(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return null;
}

function normalizeModerationStatus(value) {
  const status = nullableString(value);
  return VISIBILITY_STATUSES.includes(status) ? status : status;
}

function creatorIdFromTargetRow(row) {
  return nullableString(firstField(row, ["created_by", "creator_id", "owner_id", "user_id", "profile_id"]));
}

function serializeAdminActor(row, fallbackId = null) {
  if (!row) {
    return fallbackId
      ? {
          id: fallbackId,
          handle: null,
          display_name: null,
          avatar_url: null,
          email: null,
        }
      : null;
  }

  const id = nullableString(firstField(row, ["id", "user_id", "uid"])) || fallbackId;
  if (!id) return null;

  return {
    id,
    handle: nullableString(firstField(row, ["handle", "username"])),
    display_name: nullableString(firstField(row, ["display_name", "full_name", "name"])),
    avatar_url: publicMediaUrl(firstField(row, ["avatar_url", "avatarUrl", "photo_url", "image_url"])),
    email: nullableString(firstField(row, ["email"])),
  };
}

async function fetchUserSummaryMap(supabase, ids) {
  const userIds = [...new Set(ids.map((id) => nullableString(id)).filter(Boolean))];
  const users = new Map();
  if (userIds.length === 0) return users;

  for (const table of ["profiles", "users"]) {
    const rows = await fetchRowsById(supabase, table, userIds);
    for (const [id, row] of rows) {
      const existing = users.get(id) || {};
      users.set(id, {
        ...existing,
        ...serializeAdminActor(row, id),
      });
    }
  }

  for (const id of userIds) {
    if (!users.has(id)) users.set(id, serializeAdminActor(null, id));
  }

  return users;
}

async function fetchUserSummaryMapForReports(supabase, reports, previewMap) {
  const ids = [];

  for (const report of reports) {
    ids.push(report.reporter_id);
    const targetRow = previewMap.get(`${report.content_type}:${report.content_id}`);
    const creatorId = creatorIdFromTargetRow(targetRow);
    if (creatorId) ids.push(creatorId);
  }

  return fetchUserSummaryMap(supabase, ids);
}

function visibilityLabelForTarget(target) {
  if (target?.moderation_status) return target.moderation_status;
  if (target?.visibility) return target.visibility;
  if (target?.state) return target.state;
  return "unknown";
}

function isGloballyVisibleTarget(target) {
  const moderationStatus = String(target?.moderation_status || "").toLowerCase();
  if (moderationStatus === "hidden" || moderationStatus === "removed") return false;

  const state = String(target?.state || "").toLowerCase();
  if (!state) return moderationStatus === "active" || moderationStatus === "under_review" || !moderationStatus;
  if (["deleted", "removed", "draft", "processing", "failed", "private"].includes(state)) return false;

  return ["published", "active", "public", "ready"].includes(state);
}

function targetVisibilityFields(row) {
  return {
    moderation_status: normalizeModerationStatus(firstField(row, ["moderation_status"])),
    state: nullableString(firstField(row, ["state", "status"])),
    visibility: nullableString(firstField(row, ["visibility"])),
  };
}

function targetPreview(contentType, contentId, row, userMap = new Map()) {
  if (!row) {
    const unavailable = {
      type: contentType,
      id: contentId,
      title: contentId,
      target_unavailable: true,
      video_available: false,
      unavailable_message: "Report target was not found. It may have been deleted or migrated.",
      visibility_label: "Not available",
      globally_visible: false,
    };

    return unavailable;
  }

  if (contentType === "video") {
    const visibility = targetVisibilityFields(row);
    const rawVideoUrl = firstField(row, ["video_url", "videoUrl", "url", "media_url", "file_url"]);
    const videoUrl = publicMediaUrl(rawVideoUrl);
    const thumbnailUrl = publicMediaUrl(
      firstField(row, [
        "thumbnail_url",
        "thumbnailUrl",
        "thumbnail",
        "cover_url",
        "coverUrl",
        "cover_image_url",
      ]),
    );
    const creatorId = creatorIdFromTargetRow(row);
    const target = {
      type: "video",
      id: contentId,
      ...visibility,
      title: nullableString(firstField(row, ["title", "caption", "description", "name"])) || "Video",
      thumbnail_url: thumbnailUrl,
      video_url: videoUrl,
      video_available: Boolean(videoUrl),
      unavailable_message: videoUrl
        ? null
        : rawVideoUrl
          ? "Video could not be loaded. It may be unavailable or storage-protected."
          : "Video could not be loaded. No playable video URL is available.",
      description: nullableString(firstField(row, ["description", "caption", "title"])),
      tags: stringList(firstField(row, ["tags", "tag_list"])),
      duration_seconds: nullableNumber(firstField(row, ["duration_seconds", "duration", "durationSeconds"])),
      total_likes: nullableNumber(firstField(row, ["total_likes", "likes_count", "like_count"])),
      total_comments: nullableNumber(firstField(row, ["total_comments", "comments_count", "comment_count"])),
      created_at: nullableString(firstField(row, ["created_at", "createdAt", "inserted_at"])),
      updated_at: nullableString(firstField(row, ["updated_at", "updatedAt", "modified_at"])),
      owner_id: creatorId,
      creator: creatorId ? userMap.get(creatorId) || serializeAdminActor(null, creatorId) : null,
      public_deep_link: `https://www.exploreapphq.com/v/${encodeURIComponent(contentId)}`,
      target_unavailable: false,
    };

    return {
      ...target,
      visibility_label: visibilityLabelForTarget(target),
      globally_visible: isGloballyVisibleTarget(target),
      is_publicly_visible: isGloballyVisibleTarget(target),
    };
  }

  if (contentType === "user") {
    return {
      type: "user",
      id: contentId,
      ...targetVisibilityFields(row),
      username: firstField(row, ["username", "handle"]),
      display_name: firstField(row, ["display_name", "full_name", "name"]),
      avatar_url: publicMediaUrl(firstField(row, ["avatar_url", "avatarUrl", "photo_url", "image_url"])),
    };
  }

  if (contentType === "place") {
    return {
      type: "place",
      id: contentId,
      ...targetVisibilityFields(row),
      place_name: firstField(row, ["place_name", "name", "title"]),
      city: firstField(row, ["city", "locality", "municipality"]),
      category: firstField(row, ["category", "category_name", "type"]),
    };
  }

  return {
    type: "place_photo",
    id: contentId,
    ...targetVisibilityFields(row),
    photo_url: publicMediaUrl(firstField(row, ["photo_url", "image_url", "url", "media_url"])),
    place_id: firstField(row, ["place_id", "location_id"]),
  };
}

function serializeReport(
  report,
  previewMap,
  reportCountMap = new Map(),
  actionMap = new Map(),
  userMap = new Map(),
  relatedMap = new Map(),
  reporterHiddenMap = new Map(),
) {
  const row = previewMap.get(`${report.content_type}:${report.content_id}`);
  const targetKey = reportTargetKey(report.content_type, report.content_id);
  const target = targetPreview(report.content_type, report.content_id, row, userMap);
  const reporter = userMap.get(report.reporter_id) || serializeAdminActor(null, report.reporter_id);
  const relatedReports = (relatedMap.get(targetKey) || [])
    .filter((relatedReport) => relatedReport.id !== report.id)
    .slice(0, 12);
  const actions = (actionMap.get(report.id) || []).slice(0, 12);
  const reporterHidden = reporterHiddenMap.get(`${report.reporter_id}:${report.content_type}:${report.content_id}`) || false;

  return {
    id: report.id,
    content_type: report.content_type,
    content_id: report.content_id,
    reason: report.reason,
    details: report.details,
    metadata: report.metadata || {},
    status: report.status,
    reporter_id: report.reporter_id,
    created_at: report.created_at,
    reviewed_by: report.reviewed_by,
    reviewed_at: report.reviewed_at,
    reporter,
    target,
    target_report_count: reportCountMap.get(targetKey) || 1,
    report_count_for_target: reportCountMap.get(targetKey) || 1,
    previous_reports_for_target: relatedReports,
    related_reports: relatedReports,
    recent_moderation_actions: actions,
    actions,
    reporter_hidden_for_target: reporterHidden,
  };
}

async function serializeReportsWithContext(supabase, reports) {
  if (reports.length === 0) return [];

  const previewMap = await fetchTargetPreviewMaps(supabase, reports);
  const [reportCountMap, actionMap, userMap, relatedMap, reporterHiddenMap] = await Promise.all([
    fetchReportCountsByTarget(supabase, reports),
    fetchActionHistoryForReports(supabase, reports),
    fetchUserSummaryMapForReports(supabase, reports, previewMap),
    fetchRelatedReportsForTargets(supabase, reports),
    fetchReporterHiddenTargets(supabase, reports),
  ]);

  return reports.map((report) =>
    serializeReport(report, previewMap, reportCountMap, actionMap, userMap, relatedMap, reporterHiddenMap),
  );
}

export async function handleAdminReports(request) {
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed();

    const { supabase } = await requireAdmin(request);
    const url = new URL(request.url);
    const status = parseEnumParam(url, "status", ADMIN_REPORT_STATUSES, "pending");
    const contentType = parseEnumParam(
      url,
      "content_type",
      new Set([...CONTENT_TYPES, "all"]),
      "all",
    );
    const reason = parseEnumParam(url, "reason", ADMIN_REPORT_REASON_FILTERS, "all");
    const sort = parseEnumParam(url, "sort", ADMIN_REPORT_SORTS, "newest");
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));

    let query = supabase
      .from("content_reports")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: sort === "oldest" });

    if (status !== "all") query = query.eq("status", status);
    if (contentType !== "all") query = query.eq("content_type", contentType);
    if (reason !== "all") query = query.eq("reason", reason);

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    const reports = data || [];
    const serializedReports = await serializeReportsWithContext(supabase, reports);

    return jsonResponse(200, {
      reports: serializedReports,
      total: count || 0,
    });
  } catch (error) {
    return handleError(error, request);
  }
}

function startOfLast24Hours() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

async function countRows(supabase, table, buildQuery, { optional = false } = {}) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (buildQuery) query = buildQuery(query);

  const { count, error } = await query;
  if (error) {
    if (optional) return null;
    throw error;
  }

  return count || 0;
}

async function countReports(supabase, buildQuery) {
  return countRows(supabase, "content_reports", buildQuery);
}

async function visibilitySummaryForTable(supabase, table) {
  const counts = await Promise.all(
    VISIBILITY_STATUSES.map((status) =>
      countRows(
        supabase,
        table,
        (query) => query.eq("moderation_status", status),
        { optional: true },
      ),
    ),
  );

  const available = counts.every((value) => value !== null);
  return VISIBILITY_STATUSES.reduce(
    (summary, status, index) => {
      summary[status] = counts[index] ?? 0;
      return summary;
    },
    { available },
  );
}

async function countActions(supabase, buildQuery) {
  return countRows(supabase, "moderation_actions", buildQuery, { optional: true }).then((value) => value ?? 0);
}

async function fetchRecentModerationActions(supabase) {
  try {
    const { data, error } = await supabase
      .from("moderation_actions")
      .select("id, admin_id, report_id, target_type, target_id, action_type, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) return [];
    return (data || []).map(actionHistoryRow);
  } catch {
    return [];
  }
}

async function countActionsByType(supabase) {
  const actionTypes = [...ACTION_TYPES, "mark_removed"];
  const entries = await Promise.all(
    actionTypes.map(async (actionType) => ({
      action_type: actionType,
      count: await countActions(supabase, (query) => query.eq("action_type", actionType)),
    })),
  );

  return entries.filter((entry) => entry.count > 0);
}

async function oldestPendingReportDate(supabase) {
  const { data, error } = await supabase
    .from("content_reports")
    .select("created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0]?.created_at ?? null;
}

export async function handleAdminModerationSummary(request) {
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed();

    const { supabase } = await requireAdmin(request);
    const last24h = startOfLast24Hours();

    const [
      totalReports,
      pendingReports,
      reviewedReports,
      dismissedReports,
      removedReports,
      reviewedLast24h,
      oldestPendingAt,
      videosVisibility,
      placesVisibility,
      actionsTotal,
      actionsLast24h,
      removeContentActions,
      recentActions,
      actionsByType,
      byContentType,
      byReason,
    ] = await Promise.all([
      countReports(supabase),
      countReports(supabase, (query) => query.eq("status", "pending")),
      countReports(supabase, (query) => query.eq("status", "reviewed")),
      countReports(supabase, (query) => query.eq("status", "dismissed")),
      countReports(supabase, (query) => query.eq("status", "removed")),
      countReports(supabase, (query) => query.eq("status", "reviewed").gte("reviewed_at", last24h)),
      oldestPendingReportDate(supabase),
      visibilitySummaryForTable(supabase, "videos"),
      visibilitySummaryForTable(supabase, "places"),
      countActions(supabase),
      countActions(supabase, (query) => query.gte("created_at", last24h)),
      countActions(supabase, (query) => query.eq("action_type", "remove_content")),
      fetchRecentModerationActions(supabase),
      countActionsByType(supabase),
      Promise.all(
        [...CONTENT_TYPES].map(async (contentType) => ({
          content_type: contentType,
          count: await countReports(supabase, (query) => query.eq("content_type", contentType)),
        })),
      ),
      Promise.all(
        [...REPORT_REASONS].map(async (reason) => ({
          reason,
          count: await countReports(supabase, (query) => query.eq("reason", reason)),
        })),
      ),
    ]);

    return jsonResponse(200, {
      ok: true,
      summary: {
        reports: {
          total: totalReports,
          pending: pendingReports,
          reviewed: reviewedReports,
          reviewed_last_24h: reviewedLast24h,
          dismissed: dismissedReports,
          removed: removedReports,
          removed_or_actions: removedReports + removeContentActions,
          oldest_pending_at: oldestPendingAt,
        },
        content_visibility: {
          videos: videosVisibility,
          places: placesVisibility,
        },
        by_content_type: byContentType,
        by_reason: byReason,
        actions: {
          total: actionsTotal,
          last_24h: actionsLast24h,
          remove_content: removeContentActions,
          by_type: actionsByType,
          recent: recentActions,
        },
      },
    });
  } catch (error) {
    return handleError(error, request);
  }
}

function addWarning(warnings, message) {
  if (!warnings.includes(message)) warnings.push(message);
}

function startOfLast7Days() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function environmentName() {
  const raw =
    process.env.VERCEL_ENV ||
    process.env.VITE_VERCEL_ENV ||
    process.env.NODE_ENV ||
    "";
  const normalized = raw.toLowerCase();
  if (normalized.includes("preview") || normalized.includes("staging")) return "staging";
  if (normalized.includes("development") || normalized.includes("local")) return "local";
  return "production";
}

async function safeCount(supabase, warnings, table, { label = table, buildQuery } = {}) {
  try {
    let query = supabase.from(table).select("*", { count: "exact", head: true });
    if (buildQuery) query = buildQuery(query);
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  } catch {
    addWarning(warnings, `${label} not available`);
    return null;
  }
}

async function safeCountFirstAvailable(supabase, warnings, label, candidates) {
  for (const candidate of candidates) {
    try {
      let query = supabase.from(candidate.table).select("*", { count: "exact", head: true });
      if (candidate.buildQuery) query = candidate.buildQuery(query);
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    } catch {
      // Try the next candidate before reporting unavailable.
    }
  }

  addWarning(warnings, `${label} not available`);
  return null;
}

async function safeOldestPendingReportDate(supabase, warnings) {
  try {
    const { data, error } = await supabase
      .from("content_reports")
      .select("created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) throw error;
    return data?.[0]?.created_at ?? null;
  } catch {
    addWarning(warnings, "oldest pending report not available");
    return null;
  }
}

async function safeRecent(supabase, warnings, table, { label = table, limit = 8, orderBy = "created_at" } = {}) {
  try {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderBy, { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch {
    try {
      const { data, error } = await supabase.from(table).select("*").limit(limit);
      if (error) throw error;
      return data || [];
    } catch {
      addWarning(warnings, `${label} not available`);
      return [];
    }
  }
}

async function fixedBreakdown(supabase, warnings, table, column, values, label) {
  const entries = await Promise.all(
    values.map(async (value) => ({
      key: value,
      count: await safeCount(supabase, warnings, table, {
        label,
        buildQuery: (query) => query.eq(column, value),
      }),
    })),
  );

  return entries
    .filter((entry) => entry.count !== null)
    .map((entry) => ({ value: entry.key, count: entry.count }));
}

function serializeAdminUser(row) {
  return {
    id: String(firstField(row, ["id", "user_id", "uid"]) || ""),
    display_name: firstField(row, ["display_name", "full_name", "name"]) || null,
    handle: firstField(row, ["username", "handle"]) || null,
    email: firstField(row, ["email"]) || null,
    avatar_url: firstField(row, ["avatar_url", "avatarUrl", "photo_url", "image_url"]) || null,
    created_at: firstField(row, ["created_at", "createdAt", "inserted_at"]) || null,
    status: firstField(row, ["status", "state"]) || null,
    is_active: firstField(row, ["is_active", "active"]) ?? null,
    is_deactivated:
      firstField(row, ["deactivated", "is_deactivated", "disabled", "is_disabled"]) ?? null,
    is_ghost: firstField(row, ["ghost", "is_ghost", "test_user", "is_test"]) ?? null,
  };
}

function userSearchText(user) {
  return [user.id, user.display_name, user.handle, user.email, user.status]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function serializeVideo(row) {
  return {
    id: String(firstField(row, ["id"]) || ""),
    title: firstField(row, ["title", "caption", "description", "name"]) || null,
    thumbnail_url: firstField(row, ["thumbnail_url", "thumbnailUrl", "thumbnail", "cover_url", "coverUrl"]) || null,
    creator_id: firstField(row, ["owner_id", "user_id", "profile_id", "creator_id"]) || null,
    state: firstField(row, ["state", "status"]) || null,
    moderation_status: firstField(row, ["moderation_status"]) || null,
    likes_count: firstField(row, ["likes_count", "like_count"]) ?? null,
    comments_count: firstField(row, ["comments_count", "comment_count"]) ?? null,
    created_at: firstField(row, ["created_at", "createdAt", "inserted_at"]) || null,
  };
}

function serializePlace(row) {
  return {
    id: String(firstField(row, ["id"]) || ""),
    name: firstField(row, ["place_name", "name", "title"]) || null,
    category: firstField(row, ["category", "category_name", "type"]) || null,
    creator_id: firstField(row, ["owner_id", "user_id", "profile_id", "creator_id"]) || null,
    state: firstField(row, ["state", "status"]) || null,
    moderation_status: firstField(row, ["moderation_status"]) || null,
    rating: firstField(row, ["rating", "avg_rating", "average_rating"]) ?? null,
    created_at: firstField(row, ["created_at", "createdAt", "inserted_at"]) || null,
  };
}

function serializeRoute(row) {
  return {
    id: String(firstField(row, ["id"]) || ""),
    name: firstField(row, ["name", "title"]) || null,
    category: firstField(row, ["category", "category_name", "type"]) || null,
    difficulty: firstField(row, ["difficulty", "difficulty_level"]) || null,
    creator_id: firstField(row, ["owner_id", "user_id", "profile_id", "creator_id"]) || null,
    state: firstField(row, ["state", "status"]) || null,
    is_public: firstField(row, ["is_public", "public"]) ?? null,
    created_at: firstField(row, ["created_at", "createdAt", "inserted_at"]) || null,
  };
}

function serializeRecentReport(row) {
  return {
    id: row.id,
    content_type: row.content_type,
    content_id: row.content_id,
    reason: row.reason,
    status: row.status,
    reporter_id: row.reporter_id,
    created_at: row.created_at,
  };
}

function serializeRecentAction(row) {
  return actionHistoryRow(row);
}

async function fetchOpsUsers(supabase, warnings, { limit = 8, query = "" } = {}) {
  const candidates = ["profiles", "users"];
  for (const table of candidates) {
    const rows = await safeRecent(supabase, warnings, table, {
      label: `${table} table`,
      limit: query ? Math.max(limit * 4, 50) : limit,
    });

    if (rows.length === 0) continue;

    const users = rows.map(serializeAdminUser).filter((user) => user.id);
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? users.filter((user) => userSearchText(user).includes(normalizedQuery))
      : users;

    return {
      table,
      users: filtered.slice(0, limit),
      total: await safeCount(supabase, warnings, table, { label: `${table} table` }),
    };
  }

  addWarning(warnings, "users table not available");
  return { table: null, users: [], total: null };
}

export async function handleAdminUsers(request) {
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed();

    const { supabase } = await requireAdmin(request);
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit"));
    const query = (url.searchParams.get("query") || "").trim().slice(0, 80);
    const warnings = [];
    const result = await fetchOpsUsers(supabase, warnings, { limit, query });

    return jsonResponse(200, {
      ok: true,
      users: result.users,
      total: result.total,
      source: result.table,
      warnings,
    });
  } catch (error) {
    return handleError(error, request);
  }
}

export async function handleAdminOpsSummary(request) {
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed();

    const { supabase } = await requireAdmin(request);
    const warnings = [];
    const last24h = startOfLast24Hours();
    const last7d = startOfLast7Days();

    const [
      usersResult,
      usersNew24h,
      usersNew7d,
      usersDeactivated,
      usersGhost,
      videosTotal,
      videosPublished,
      videosProcessing,
      videosLegacyReported,
      videosActive,
      videosUnderReview,
      videosHidden,
      videosRemoved,
      videosCreated7d,
      placesTotal,
      placesPublished,
      placesDeleted,
      placesActive,
      placesUnderReview,
      placesHidden,
      placesRemoved,
      placesCreated7d,
      routesTotal,
      routesPublished,
      routesPublic,
      routesDraft,
      likesTotal,
      commentsTotal,
      followersTotal,
      hiddenContentTotal,
      reportsTotal,
      reportsPending,
      reportsReviewed,
      reportsDismissed,
      reportsRemoved,
      oldestPendingAt,
      actionsTotal,
      actions24h,
      removeContentActions,
      reportsByContentType,
      reportsByReason,
      videosByState,
      placesByState,
      videosByModerationStatus,
      placesByModerationStatus,
      recentUsers,
      recentVideos,
      recentPlaces,
      recentRoutes,
      recentReports,
      recentActions,
      analyticsEventsTotal,
    ] = await Promise.all([
      fetchOpsUsers(supabase, warnings, { limit: 6 }),
      safeCountFirstAvailable(supabase, warnings, "new users last 24h", [
        { table: "profiles", buildQuery: (query) => query.gte("created_at", last24h) },
        { table: "users", buildQuery: (query) => query.gte("created_at", last24h) },
      ]),
      safeCountFirstAvailable(supabase, warnings, "new users last 7d", [
        { table: "profiles", buildQuery: (query) => query.gte("created_at", last7d) },
        { table: "users", buildQuery: (query) => query.gte("created_at", last7d) },
      ]),
      safeCountFirstAvailable(supabase, warnings, "deactivated users", [
        { table: "profiles", buildQuery: (query) => query.eq("status", "deactivated") },
        { table: "profiles", buildQuery: (query) => query.eq("is_active", false) },
        { table: "users", buildQuery: (query) => query.eq("status", "deactivated") },
        { table: "users", buildQuery: (query) => query.eq("is_active", false) },
      ]),
      safeCountFirstAvailable(supabase, warnings, "ghost/test users", [
        { table: "profiles", buildQuery: (query) => query.eq("is_ghost", true) },
        { table: "profiles", buildQuery: (query) => query.eq("test_user", true) },
        { table: "users", buildQuery: (query) => query.eq("is_ghost", true) },
        { table: "users", buildQuery: (query) => query.eq("test_user", true) },
      ]),
      safeCount(supabase, warnings, "videos", { label: "videos table" }),
      safeCountFirstAvailable(supabase, warnings, "published videos", [
        { table: "videos", buildQuery: (query) => query.eq("state", "published") },
        { table: "videos", buildQuery: (query) => query.eq("status", "published") },
      ]),
      safeCountFirstAvailable(supabase, warnings, "processing videos", [
        { table: "videos", buildQuery: (query) => query.eq("state", "processing") },
        { table: "videos", buildQuery: (query) => query.eq("status", "processing") },
      ]),
      safeCountFirstAvailable(supabase, warnings, "legacy reported videos", [
        { table: "videos", buildQuery: (query) => query.eq("state", "reported") },
        { table: "videos", buildQuery: (query) => query.eq("status", "reported") },
      ]),
      safeCount(supabase, warnings, "videos", {
        label: "videos moderation_status",
        buildQuery: (query) => query.eq("moderation_status", "active"),
      }),
      safeCount(supabase, warnings, "videos", {
        label: "videos moderation_status",
        buildQuery: (query) => query.eq("moderation_status", "under_review"),
      }),
      safeCount(supabase, warnings, "videos", {
        label: "videos moderation_status",
        buildQuery: (query) => query.eq("moderation_status", "hidden"),
      }),
      safeCount(supabase, warnings, "videos", {
        label: "videos moderation_status",
        buildQuery: (query) => query.eq("moderation_status", "removed"),
      }),
      safeCount(supabase, warnings, "videos", {
        label: "videos created_at",
        buildQuery: (query) => query.gte("created_at", last7d),
      }),
      safeCount(supabase, warnings, "places", { label: "places table" }),
      safeCountFirstAvailable(supabase, warnings, "published places", [
        { table: "places", buildQuery: (query) => query.eq("state", "published") },
        { table: "places", buildQuery: (query) => query.eq("status", "published") },
      ]),
      safeCountFirstAvailable(supabase, warnings, "deleted places", [
        { table: "places", buildQuery: (query) => query.eq("state", "deleted") },
        { table: "places", buildQuery: (query) => query.not("deleted_at", "is", null) },
      ]),
      safeCount(supabase, warnings, "places", {
        label: "places moderation_status",
        buildQuery: (query) => query.eq("moderation_status", "active"),
      }),
      safeCount(supabase, warnings, "places", {
        label: "places moderation_status",
        buildQuery: (query) => query.eq("moderation_status", "under_review"),
      }),
      safeCount(supabase, warnings, "places", {
        label: "places moderation_status",
        buildQuery: (query) => query.eq("moderation_status", "hidden"),
      }),
      safeCount(supabase, warnings, "places", {
        label: "places moderation_status",
        buildQuery: (query) => query.eq("moderation_status", "removed"),
      }),
      safeCount(supabase, warnings, "places", {
        label: "places created_at",
        buildQuery: (query) => query.gte("created_at", last7d),
      }),
      safeCount(supabase, warnings, "routes", { label: "routes table" }),
      safeCountFirstAvailable(supabase, warnings, "published routes", [
        { table: "routes", buildQuery: (query) => query.eq("state", "published") },
        { table: "routes", buildQuery: (query) => query.eq("status", "published") },
      ]),
      safeCountFirstAvailable(supabase, warnings, "public routes", [
        { table: "routes", buildQuery: (query) => query.eq("is_public", true) },
        { table: "routes", buildQuery: (query) => query.eq("public", true) },
      ]),
      safeCountFirstAvailable(supabase, warnings, "draft routes", [
        { table: "routes", buildQuery: (query) => query.eq("state", "draft") },
        { table: "routes", buildQuery: (query) => query.eq("status", "draft") },
      ]),
      safeCountFirstAvailable(supabase, warnings, "likes total", [
        { table: "likes" },
        { table: "video_likes" },
      ]),
      safeCountFirstAvailable(supabase, warnings, "comments total", [
        { table: "comments" },
        { table: "video_comments" },
      ]),
      safeCountFirstAvailable(supabase, warnings, "followers total", [
        { table: "followers" },
        { table: "user_followers" },
        { table: "follows" },
      ]),
      safeCount(supabase, warnings, "user_hidden_content", { label: "user_hidden_content table" }),
      safeCount(supabase, warnings, "content_reports", { label: "content_reports table" }),
      safeCount(supabase, warnings, "content_reports", {
        label: "pending reports",
        buildQuery: (query) => query.eq("status", "pending"),
      }),
      safeCount(supabase, warnings, "content_reports", {
        label: "reviewed reports",
        buildQuery: (query) => query.eq("status", "reviewed"),
      }),
      safeCount(supabase, warnings, "content_reports", {
        label: "dismissed reports",
        buildQuery: (query) => query.eq("status", "dismissed"),
      }),
      safeCount(supabase, warnings, "content_reports", {
        label: "removed reports",
        buildQuery: (query) => query.eq("status", "removed"),
      }),
      safeOldestPendingReportDate(supabase, warnings),
      countActions(supabase),
      countActions(supabase, (query) => query.gte("created_at", last24h)),
      countActions(supabase, (query) => query.eq("action_type", "remove_content")),
      Promise.all(
        [...CONTENT_TYPES].map(async (contentType) => ({
          content_type: contentType,
          count: await safeCount(supabase, warnings, "content_reports", {
            label: "reports by content type",
            buildQuery: (query) => query.eq("content_type", contentType),
          }),
        })),
      ),
      Promise.all(
        [...REPORT_REASONS].map(async (reason) => ({
          reason,
          count: await safeCount(supabase, warnings, "content_reports", {
            label: "reports by reason",
            buildQuery: (query) => query.eq("reason", reason),
          }),
        })),
      ),
      fixedBreakdown(
        supabase,
        warnings,
        "videos",
        "state",
        ["published", "processing", "reported", "draft", "deleted"],
        "videos state",
      ),
      fixedBreakdown(
        supabase,
        warnings,
        "places",
        "state",
        ["published", "active", "reported", "draft", "deleted"],
        "places state",
      ),
      fixedBreakdown(supabase, warnings, "videos", "moderation_status", VISIBILITY_STATUSES, "videos moderation_status"),
      fixedBreakdown(supabase, warnings, "places", "moderation_status", VISIBILITY_STATUSES, "places moderation_status"),
      fetchOpsUsers(supabase, warnings, { limit: 6 }),
      safeRecent(supabase, warnings, "videos", { label: "recent videos", limit: 6 }),
      safeRecent(supabase, warnings, "places", { label: "recent places", limit: 6 }),
      safeRecent(supabase, warnings, "routes", { label: "recent routes", limit: 6 }),
      safeRecent(supabase, warnings, "content_reports", { label: "recent reports", limit: 6 }),
      safeRecent(supabase, warnings, "moderation_actions", { label: "recent admin actions", limit: 8 }),
      safeCount(supabase, warnings, "analytics_events", { label: "analytics_events table" }),
    ]);

    return jsonResponse(200, {
      ok: true,
      summary: {
        health: {
          api_connected: true,
          supabase_configured: Boolean(getSupabaseUrl() && getSupabasePublishableKey()),
          secret_key_configured: Boolean(getSupabaseSecretKey()),
          admin_authorized: true,
          environment: environmentName(),
        },
        users: {
          total: usersResult.total,
          new_24h: usersNew24h,
          new_7d: usersNew7d,
          deactivated: usersDeactivated,
          ghost: usersGhost,
          active_24h: analyticsEventsTotal === null ? null : null,
          active_7d: analyticsEventsTotal === null ? null : null,
        },
        content: {
          videos: {
            total: videosTotal,
            published: videosPublished,
            processing: videosProcessing,
            reported_legacy: videosLegacyReported,
            active: videosActive,
            under_review: videosUnderReview,
            hidden: videosHidden,
            removed: videosRemoved,
            created_7d: videosCreated7d,
          },
          places: {
            total: placesTotal,
            published: placesPublished,
            deleted: placesDeleted,
            active: placesActive,
            under_review: placesUnderReview,
            hidden: placesHidden,
            removed: placesRemoved,
            created_7d: placesCreated7d,
          },
          routes: {
            total: routesTotal,
            published: routesPublished,
            public: routesPublic,
            draft: routesDraft,
          },
        },
        engagement: {
          likes: likesTotal,
          comments: commentsTotal,
          followers: followersTotal,
          user_hidden_content: hiddenContentTotal,
          analytics_events: analyticsEventsTotal,
        },
        moderation: {
          reports_total: reportsTotal,
          pending: reportsPending,
          reviewed: reportsReviewed,
          dismissed: reportsDismissed,
          removed: reportsRemoved,
          removed_or_actions: reportsRemoved === null ? removeContentActions : reportsRemoved + removeContentActions,
          oldest_pending_at: oldestPendingAt,
          actions_total: actionsTotal,
          actions_24h: actions24h,
          remove_content_actions: removeContentActions,
        },
        breakdowns: {
          reports_by_content_type: reportsByContentType.filter((entry) => entry.count !== null),
          reports_by_reason: reportsByReason.filter((entry) => entry.count !== null),
          videos_by_state: videosByState,
          places_by_state: placesByState,
          videos_by_moderation_status: videosByModerationStatus,
          places_by_moderation_status: placesByModerationStatus,
        },
        recent: {
          users: recentUsers.users,
          videos: recentVideos.map(serializeVideo),
          places: recentPlaces.map(serializePlace),
          routes: recentRoutes.map(serializeRoute),
          reports: recentReports.map(serializeRecentReport),
          admin_actions: recentActions.map(serializeRecentAction),
        },
        warnings,
      },
    });
  } catch (error) {
    return handleError(error, request);
  }
}

export async function handleAdminMe(request) {
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") return methodNotAllowed();

    const { user, role, email, fallback } = await requireAdmin(request);
    return jsonResponse(200, {
      ok: true,
      user: {
        id: user.id,
        email,
      },
      role,
      fallback: Boolean(fallback),
    });
  } catch (error) {
    return handleError(error, request);
  }
}

function reportIdFromRequest(request, explicitId) {
  if (explicitId) return explicitId;
  const pathname = new URL(request.url).pathname;
  const id = pathname.split("/").filter(Boolean).pop();
  return id || "";
}

function validateReportStatusBody(body) {
  if (!isPlainObject(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const status = typeof body.status === "string" ? body.status.trim() : "";
  if (!["reviewed", "dismissed", "removed"].includes(status)) {
    throw new HttpError(400, "status must be reviewed, dismissed, or removed.");
  }

  return {
    status,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 4000) : null,
  };
}

function actionTypeForReportStatus(status) {
  if (status === "dismissed") return "dismiss_report";
  if (status === "removed") return "mark_removed";
  return "mark_reviewed";
}

async function insertModerationAction(supabase, action) {
  const { data, error } = await supabase
    .from("moderation_actions")
    .insert(action)
    .select("id, admin_id, report_id, target_type, target_id, action_type, notes, created_at")
    .single();

  if (error) throw error;
  return data;
}

export async function handleAdminReportById(request, explicitId) {
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET" && request.method !== "PATCH") return methodNotAllowed();

    const id = reportIdFromRequest(request, explicitId);
    if (!id) throw new HttpError(400, "Report id is required.");

    const { supabase, user, email } = await requireAdmin(request);

    if (request.method === "GET") {
      const current = await supabase.from("content_reports").select("*").eq("id", id).maybeSingle();
      if (current.error) throw current.error;
      if (!current.data) throw new HttpError(404, "Report not found.");

      const [report] = await serializeReportsWithContext(supabase, [current.data]);
      return jsonResponse(200, {
        ok: true,
        report,
        target: report.target,
        reporter: report.reporter,
        creator: report.target?.creator || null,
        related_reports: report.related_reports || [],
        moderation_actions: report.recent_moderation_actions || [],
        moderation_actions_timeline: [
          {
            id: `report_created:${report.id}`,
            action_type: "report_created",
            report_id: report.id,
            target_type: report.content_type,
            target_id: report.content_id,
            admin_id: report.reporter_id,
            notes: report.details,
            created_at: report.created_at,
          },
          ...(report.recent_moderation_actions || []),
        ],
      });
    }

    const input = validateReportStatusBody(await readJson(request));

    const current = await supabase.from("content_reports").select("*").eq("id", id).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) throw new HttpError(404, "Report not found.");

    const reviewedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("content_reports")
      .update({
        status: input.status,
        reviewed_by: user.id,
        reviewed_at: reviewedAt,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    const actionType = actionTypeForReportStatus(input.status);
    const action = await insertModerationAction(supabase, {
      admin_id: user.id,
      report_id: id,
      target_type: current.data.content_type,
      target_id: current.data.content_id,
      action_type: actionType,
      notes: input.notes,
    });

    recordAdminAction({ action: actionType, targetType: current.data.content_type });
    recordModerationAction({ action: actionType, targetType: current.data.content_type });
    logger.info("Admin report status updated", {
      ...requestLogMeta(request, "admin/reports/:id"),
      admin_user_id: user.id,
      admin_email: email,
      action_type: actionType,
      action_id: action.id,
      target_type: current.data.content_type,
      target_id: current.data.content_id,
      report_id: id,
      previous_state: { status: current.data.status },
      next_state: { status: input.status },
    });

    return jsonResponse(200, { ok: true, report: data });
  } catch (error) {
    return handleError(error, request);
  }
}

function validateModerationActionBody(body) {
  if (!isPlainObject(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const reportId = typeof body.report_id === "string" && body.report_id.trim() ? body.report_id.trim() : null;
  const targetType = typeof body.target_type === "string" ? body.target_type.trim() : "";
  const targetId = typeof body.target_id === "string" ? body.target_id.trim() : "";
  const actionType =
    typeof body.action_type === "string"
      ? body.action_type.trim()
      : typeof body.action === "string"
        ? body.action.trim()
        : "";

  if (!CONTENT_TYPES.has(targetType)) {
    throw new HttpError(400, "target_type must be video, user, place, or place_photo.");
  }

  if (!targetId || targetId.length > 256) {
    throw new HttpError(400, "target_id is required and must be 256 characters or fewer.");
  }

  if (!ACTION_TYPES.has(actionType)) {
    throw new HttpError(400, "action_type is invalid.");
  }

  if (actionType === "reopen_report" && !reportId) {
    throw new HttpError(400, "report_id is required for reopen_report.");
  }

  if ((actionType === "hide_video" || actionType === "restore_video") && targetType !== "video") {
    throw new HttpError(400, `${actionType} can only be used with target_type video.`);
  }

  if ((actionType === "hide_place" || actionType === "restore_place") && targetType !== "place") {
    throw new HttpError(400, `${actionType} can only be used with target_type place.`);
  }

  if ((actionType === "suspend_user" || actionType === "unsuspend_user") && targetType !== "user") {
    throw new HttpError(400, `${actionType} can only be used with target_type user.`);
  }

  if (actionType === "remove_content" && targetType === "user") {
    throw new HttpError(400, "remove_content cannot be used with target_type user. Use suspend_user instead.");
  }

  return {
    report_id: reportId,
    target_type: targetType,
    target_id: targetId,
    action_type: actionType,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 4000) : null,
  };
}

function hasField(row, field) {
  return Object.prototype.hasOwnProperty.call(row, field);
}

function timestamp() {
  return new Date().toISOString();
}

function moderationStatusUpdate(row, status) {
  if (hasField(row, "moderation_status")) return { moderation_status: status };
  return null;
}

function contentRemoveUpdate(row) {
  if (hasField(row, "deleted_at")) return { deleted_at: timestamp() };
  if (hasField(row, "removed_at")) return { removed_at: timestamp() };
  if (hasField(row, "is_deleted")) return { is_deleted: true };
  if (hasField(row, "is_hidden")) return { is_hidden: true };
  if (hasField(row, "visibility")) return { visibility: "removed" };
  if (hasField(row, "status")) return { status: "removed" };
  if (hasField(row, "state")) return { state: "removed" };
  return null;
}

function userSuspendUpdate(row, suspended) {
  if (hasField(row, "suspended")) return { suspended };
  if (hasField(row, "is_suspended")) return { is_suspended: suspended };
  if (hasField(row, "banned")) return { banned: suspended };
  if (hasField(row, "is_banned")) return { is_banned: suspended };
  if (hasField(row, "is_active")) return { is_active: !suspended };
  if (hasField(row, "status")) return { status: suspended ? "suspended" : "active" };
  if (hasField(row, "state")) return { state: suspended ? "suspended" : "active" };
  if (hasField(row, "deleted_at")) return { deleted_at: suspended ? timestamp() : null };
  return null;
}

function tablesForTargetType(targetType) {
  if (targetType === "video") return ["videos"];
  if (targetType === "user") return ["profiles", "users"];
  if (targetType === "place") return ["places"];
  return ["place_photos", "photos"];
}

function buildUpdateForAction(input, row) {
  if (input.target_type === "video") {
    if (input.action_type === "hide_video") return moderationStatusUpdate(row, "hidden");
    if (input.action_type === "restore_video") return moderationStatusUpdate(row, "active");
    if (input.action_type === "remove_content") return moderationStatusUpdate(row, "removed");
  }

  if (input.target_type === "place") {
    if (input.action_type === "hide_place") return moderationStatusUpdate(row, "hidden");
    if (input.action_type === "restore_place") return moderationStatusUpdate(row, "active");
    if (input.action_type === "remove_content") return moderationStatusUpdate(row, "removed");
  }

  const actionType = input.action_type;
  if (actionType === "suspend_user") return userSuspendUpdate(row, true);
  if (actionType === "unsuspend_user") return userSuspendUpdate(row, false);
  if (actionType === "remove_content") return contentRemoveUpdate(row);
  return {};
}

async function applyModerationAction(supabase, input) {
  if (
    input.action_type === "dismiss_report" ||
    input.action_type === "mark_reviewed" ||
    input.action_type === "reopen_report"
  ) {
    return { applied: true, table: null, fields: [] };
  }

  for (const table of tablesForTargetType(input.target_type)) {
    const { data, error } = await supabase.from(table).select("*").eq("id", input.target_id).maybeSingle();
    if (error || !data) continue;

    const update = buildUpdateForAction(input, data);
    if (!update || Object.keys(update).length === 0) {
      return {
        applied: false,
        status: 400,
        message: `Target table ${table} does not expose a supported moderation field for ${input.action_type}.`,
        table,
      };
    }

    const result = await supabase.from(table).update(update).eq("id", input.target_id);
    if (result.error) throw result.error;

    const fields = Object.keys(update);
    return {
      applied: true,
      table,
      fields,
      previous_state: Object.fromEntries(fields.map((field) => [field, data[field] ?? null])),
      next_state: Object.fromEntries(fields.map((field) => [field, update[field] ?? null])),
    };
  }

  return {
    applied: false,
    status: 404,
    message: "Target content was not found in the expected table(s).",
  };
}

function reportStatusForAction(actionType) {
  if (actionType === "dismiss_report") return "dismissed";
  if (actionType === "mark_reviewed") return "reviewed";
  if (actionType === "reopen_report") return "pending";
  return null;
}

function appendOutcomeToNotes(notes, outcome) {
  if (outcome.applied) return notes;
  const suffix = `Action not applied: ${outcome.message}`;
  return notes ? `${notes}\n\n${suffix}` : suffix;
}

export async function handleAdminModerationAction(request) {
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "POST") return methodNotAllowed();

    const { supabase, user, email } = await requireAdmin(request);
    const input = validateModerationActionBody(await readJson(request));
    const outcome = await applyModerationAction(supabase, input);

    const action = await insertModerationAction(supabase, {
      admin_id: user.id,
      report_id: input.report_id,
      target_type: input.target_type,
      target_id: input.target_id,
      action_type: input.action_type,
      notes: appendOutcomeToNotes(input.notes, outcome),
    });

    const actionStatus = outcome.applied ? "success" : "failed";
    recordAdminAction({ action: input.action_type, targetType: input.target_type, status: actionStatus });
    recordModerationAction({ action: input.action_type, targetType: input.target_type, status: actionStatus });
    logger.info("Admin moderation action recorded", {
      ...requestLogMeta(request, "admin/moderation/action"),
      admin_user_id: user.id,
      admin_email: email,
      action_type: input.action_type,
      action_id: action.id,
      target_type: input.target_type,
      target_id: input.target_id,
      report_id: input.report_id,
      previous_state: outcome.previous_state || null,
      next_state: outcome.next_state || null,
      applied: Boolean(outcome.applied),
      table: outcome.table || null,
    });

    if (!outcome.applied) {
      return jsonResponse(outcome.status || 400, {
        ok: false,
        error: outcome.message,
        action_id: action.id,
      });
    }

    let report = null;
    if (input.report_id) {
      const nextReportStatus = reportStatusForAction(input.action_type);
      const reportUpdate =
        input.action_type === "reopen_report"
          ? {
              status: "pending",
              reviewed_by: null,
              reviewed_at: null,
            }
          : nextReportStatus
            ? {
                status: nextReportStatus,
                reviewed_by: user.id,
                reviewed_at: timestamp(),
              }
            : null;
      const reportQuery = nextReportStatus
        ? supabase
            .from("content_reports")
            .update(reportUpdate)
            .eq("id", input.report_id)
            .select("*")
            .single()
        : supabase.from("content_reports").select("*").eq("id", input.report_id).maybeSingle();

      const { data, error } = await reportQuery;
      if (error) throw error;
      report = data;
    }

    let serializedReport = report;
    if (report) {
      const [withContext] = await serializeReportsWithContext(supabase, [report]);
      serializedReport = withContext || report;
    }

    return jsonResponse(200, {
      ok: true,
      action_id: action.id,
      action: actionHistoryRow(action),
      applied: outcome,
      report: serializedReport,
      target: serializedReport?.target || null,
    });
  } catch (error) {
    return handleError(error, request);
  }
}
