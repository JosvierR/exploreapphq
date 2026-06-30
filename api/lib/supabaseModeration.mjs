import { createClient } from "@supabase/supabase-js";

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
const ACTION_TYPES = new Set([
  "hide_video",
  "restore_video",
  "suspend_user",
  "unsuspend_user",
  "dismiss_report",
  "mark_reviewed",
  "remove_content",
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      ...headers,
    },
  });
}

export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function methodNotAllowed() {
  return jsonResponse(405, { ok: false, error: "Method not allowed." });
}

function handleError(error) {
  if (error instanceof HttpError) {
    return jsonResponse(error.status, { ok: false, error: error.message });
  }

  console.error("[moderation-api]", error);
  return jsonResponse(500, { ok: false, error: "Unexpected server error." });
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

  return jsonResponse(200, {
    ok: true,
    supabaseUrlConfigured: Boolean(getSupabaseUrl()),
    publishableKeyConfigured: Boolean(getSupabasePublishableKey()),
    secretKeyConfigured: Boolean(getSupabaseSecretKey()),
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

  return {
    content_type: contentType,
    content_id: contentId,
    reason,
    details,
    metadata,
  };
}

function duplicateError(error) {
  return error?.code === "23505" || /duplicate key/i.test(error?.message || "");
}

export async function handleReports(request) {
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "POST") return methodNotAllowed();

    const { supabase, user } = await requireUser(request);
    const input = validateReportBody(await readJson(request));

    const existing = await supabase
      .from("content_reports")
      .select("id")
      .eq("reporter_id", user.id)
      .eq("content_type", input.content_type)
      .eq("content_id", input.content_id)
      .maybeSingle();

    if (existing.data) {
      return jsonResponse(200, { ok: true, already_reported: true });
    }

    if (existing.error) {
      throw existing.error;
    }

    const { data, error } = await supabase
      .from("content_reports")
      .insert({
        ...input,
        reporter_id: user.id,
        status: "pending",
      })
      .select("id, status")
      .single();

    if (duplicateError(error)) {
      return jsonResponse(200, { ok: true, already_reported: true });
    }

    if (error) throw error;

    return jsonResponse(201, {
      ok: true,
      report_id: data.id,
      status: data.status,
    });
  } catch (error) {
    return handleError(error);
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

function targetPreview(contentType, contentId, row) {
  if (!row) return { title: contentId };

  if (contentType === "video") {
    return {
      title: firstField(row, ["title", "caption", "description", "name"]),
      thumbnail_url: firstField(row, [
        "thumbnail_url",
        "thumbnailUrl",
        "thumbnail",
        "cover_url",
        "coverUrl",
        "cover_image_url",
      ]),
      video_url: firstField(row, ["video_url", "videoUrl", "url", "media_url"]),
      owner_id: firstField(row, ["owner_id", "user_id", "profile_id", "creator_id"]),
    };
  }

  if (contentType === "user") {
    return {
      username: firstField(row, ["username", "handle"]),
      display_name: firstField(row, ["display_name", "full_name", "name"]),
      avatar_url: firstField(row, ["avatar_url", "avatarUrl", "photo_url", "image_url"]),
    };
  }

  if (contentType === "place") {
    return {
      place_name: firstField(row, ["place_name", "name", "title"]),
      city: firstField(row, ["city", "locality", "municipality"]),
      category: firstField(row, ["category", "category_name", "type"]),
    };
  }

  return {
    photo_url: firstField(row, ["photo_url", "image_url", "url", "media_url"]),
    place_id: firstField(row, ["place_id", "location_id"]),
  };
}

function serializeReport(report, previewMap) {
  const row = previewMap.get(`${report.content_type}:${report.content_id}`);
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
    target: targetPreview(report.content_type, report.content_id, row),
  };
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
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));

    let query = supabase
      .from("content_reports")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (status !== "all") query = query.eq("status", status);
    if (contentType !== "all") query = query.eq("content_type", contentType);

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    const reports = data || [];
    const previewMap = await fetchTargetPreviewMaps(supabase, reports);

    return jsonResponse(200, {
      reports: reports.map((report) => serializeReport(report, previewMap)),
      total: count || 0,
    });
  } catch (error) {
    return handleError(error);
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
    return handleError(error);
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
  if (status === "removed") return "remove_content";
  return "mark_reviewed";
}

async function insertModerationAction(supabase, action) {
  const { data, error } = await supabase
    .from("moderation_actions")
    .insert(action)
    .select("id, created_at")
    .single();

  if (error) throw error;
  return data;
}

export async function handleAdminReportById(request, explicitId) {
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "PATCH") return methodNotAllowed();

    const id = reportIdFromRequest(request, explicitId);
    if (!id) throw new HttpError(400, "Report id is required.");

    const { supabase, user } = await requireAdmin(request);
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

    await insertModerationAction(supabase, {
      admin_id: user.id,
      report_id: id,
      target_type: current.data.content_type,
      target_id: current.data.content_id,
      action_type: actionTypeForReportStatus(input.status),
      notes: input.notes,
    });

    return jsonResponse(200, { ok: true, report: data });
  } catch (error) {
    return handleError(error);
  }
}

function validateModerationActionBody(body) {
  if (!isPlainObject(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const reportId = typeof body.report_id === "string" && body.report_id.trim() ? body.report_id.trim() : null;
  const targetType = typeof body.target_type === "string" ? body.target_type.trim() : "";
  const targetId = typeof body.target_id === "string" ? body.target_id.trim() : "";
  const actionType = typeof body.action_type === "string" ? body.action_type.trim() : "";

  if (!CONTENT_TYPES.has(targetType)) {
    throw new HttpError(400, "target_type must be video, user, place, or place_photo.");
  }

  if (!targetId || targetId.length > 256) {
    throw new HttpError(400, "target_id is required and must be 256 characters or fewer.");
  }

  if (!ACTION_TYPES.has(actionType)) {
    throw new HttpError(400, "action_type is invalid.");
  }

  if ((actionType === "hide_video" || actionType === "restore_video") && targetType !== "video") {
    throw new HttpError(400, `${actionType} can only be used with target_type video.`);
  }

  if ((actionType === "suspend_user" || actionType === "unsuspend_user") && targetType !== "user") {
    throw new HttpError(400, `${actionType} can only be used with target_type user.`);
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

function videoHideUpdate(row, hidden) {
  if (hasField(row, "is_hidden")) return { is_hidden: hidden };
  if (hasField(row, "hidden")) return { hidden };
  if (hasField(row, "visibility")) return { visibility: hidden ? "hidden" : "public" };
  if (hasField(row, "status")) return { status: hidden ? "hidden" : "active" };
  if (hasField(row, "state")) return { state: hidden ? "hidden" : "active" };
  if (hasField(row, "deleted_at")) return { deleted_at: hidden ? timestamp() : null };
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

function buildUpdateForAction(actionType, row) {
  if (actionType === "hide_video") return videoHideUpdate(row, true);
  if (actionType === "restore_video") return videoHideUpdate(row, false);
  if (actionType === "suspend_user") return userSuspendUpdate(row, true);
  if (actionType === "unsuspend_user") return userSuspendUpdate(row, false);
  if (actionType === "remove_content") return contentRemoveUpdate(row);
  return {};
}

async function applyModerationAction(supabase, input) {
  if (input.action_type === "dismiss_report" || input.action_type === "mark_reviewed") {
    return { applied: true, table: null, fields: [] };
  }

  for (const table of tablesForTargetType(input.target_type)) {
    const { data, error } = await supabase.from(table).select("*").eq("id", input.target_id).maybeSingle();
    if (error || !data) continue;

    const update = buildUpdateForAction(input.action_type, data);
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

    return { applied: true, table, fields: Object.keys(update) };
  }

  return {
    applied: false,
    status: 404,
    message: "Target content was not found in the expected table(s).",
  };
}

function reportStatusForAction(actionType) {
  if (actionType === "dismiss_report") return "dismissed";
  if (actionType === "hide_video" || actionType === "suspend_user" || actionType === "remove_content") {
    return "removed";
  }
  return "reviewed";
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

    const { supabase, user } = await requireAdmin(request);
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

    if (!outcome.applied) {
      return jsonResponse(outcome.status || 400, {
        ok: false,
        error: outcome.message,
        action_id: action.id,
      });
    }

    let report = null;
    if (input.report_id) {
      const { data, error } = await supabase
        .from("content_reports")
        .update({
          status: reportStatusForAction(input.action_type),
          reviewed_by: user.id,
          reviewed_at: timestamp(),
        })
        .eq("id", input.report_id)
        .select("*")
        .single();

      if (error) throw error;
      report = data;
    }

    return jsonResponse(200, {
      ok: true,
      action_id: action.id,
      applied: outcome,
      report,
    });
  } catch (error) {
    return handleError(error);
  }
}
