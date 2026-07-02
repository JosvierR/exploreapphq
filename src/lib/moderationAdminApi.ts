import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type ReportStatus = "pending" | "reviewed" | "dismissed" | "removed";
export type ReportStatusFilter = ReportStatus | "all";
export type ReportContentType = "video" | "user" | "place" | "place_photo";
export type ReportContentTypeFilter = ReportContentType | "all";
export type ModerationVisibilityStatus = "active" | "under_review" | "hidden" | "removed";
export type ReportReasonFilter = ReportReason | "all";
export type ReportsSort = "newest" | "oldest" | "priority";
export type ReportReason =
  | "spam"
  | "inappropriate"
  | "harassment"
  | "violence"
  | "sexual_content"
  | "fake"
  | "other";

export type AdminMe = {
  ok: true;
  user: {
    id: string;
    email: string;
  };
  role: "admin" | "moderator";
  fallback?: boolean;
};

export type AdminReport = {
  id: string;
  content_type: ReportContentType;
  content_id: string;
  reason: ReportReason;
  details: string | null;
  metadata: Record<string, unknown>;
  status: ReportStatus;
  reporter_id: string;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reporter: AdminReportActor | null;
  target_report_count?: number;
  report_count_for_target?: number;
  previous_reports_for_target?: AdminRecentReport[];
  related_reports?: AdminRecentReport[];
  recent_moderation_actions?: AdminModerationAction[];
  reporter_hidden_for_target?: boolean;
  actions?: AdminModerationAction[];
  target: AdminReportTarget;
};

export type AdminReportActor = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
};

export type AdminReportTarget = {
  type?: ReportContentType;
  id?: string;
  title?: string | null;
  thumbnail_url?: string | null;
  video_url?: string | null;
  video_available?: boolean;
  unavailable_message?: string | null;
  target_unavailable?: boolean;
  description?: string | null;
  tags?: string[];
  duration_seconds?: number | null;
  total_likes?: number | null;
  total_comments?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  owner_id?: string | null;
  creator?: AdminReportActor | null;
  public_deep_link?: string | null;
  username?: string;
  display_name?: string;
  avatar_url?: string | null;
  place_name?: string;
  city?: string;
  category?: string;
  photo_url?: string | null;
  place_id?: string;
  moderation_status?: ModerationVisibilityStatus | string | null;
  state?: string | null;
  visibility?: string | null;
  visibility_label?: string | null;
  globally_visible?: boolean;
  is_publicly_visible?: boolean;
};

export type AdminModerationAction = {
  id: string;
  report_id: string | null;
  admin_id: string;
  target_type: ReportContentType;
  target_id: string;
  action_type: string;
  notes: string | null;
  created_at: string;
};

export type AdminUserSummary = {
  id: string;
  display_name: string | null;
  handle: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string | null;
  status: string | null;
  is_active: boolean | null;
  is_deactivated: boolean | null;
  is_ghost: boolean | null;
};

export type AdminContentSummaryItem = {
  id: string;
  title?: string | null;
  name?: string | null;
  thumbnail_url?: string | null;
  category?: string | null;
  difficulty?: string | null;
  creator_id?: string | null;
  state?: string | null;
  moderation_status?: string | null;
  is_public?: boolean | null;
  rating?: number | string | null;
  likes_count?: number | null;
  comments_count?: number | null;
  created_at: string | null;
};

export type AdminRecentReport = Pick<
  AdminReport,
  "id" | "content_type" | "content_id" | "reason" | "status" | "reporter_id" | "created_at"
>;

export type ReportsResponse = {
  reports: AdminReport[];
  total: number;
};

export type AdminReportDetailResponse = {
  ok: true;
  report: AdminReport;
  target: AdminReportTarget;
  reporter: AdminReportActor | null;
  creator: AdminReportActor | null;
  related_reports: AdminRecentReport[];
  moderation_actions: AdminModerationAction[];
  moderation_actions_timeline?: AdminModerationAction[];
};

export type ModerationVisibilitySummary = Record<ModerationVisibilityStatus, number> & {
  available?: boolean;
};

export type AdminModerationSummary = {
  reports: {
    total: number;
    pending: number;
    reviewed: number;
    reviewed_last_24h?: number;
    dismissed: number;
    removed: number;
    removed_or_actions?: number;
    oldest_pending_at: string | null;
  };
  content_visibility: {
    videos: ModerationVisibilitySummary;
    places: ModerationVisibilitySummary;
  };
  by_content_type: Array<{ content_type: ReportContentType; count: number }>;
  by_reason: Array<{ reason: ReportReason; count: number }>;
  actions: {
    total: number;
    last_24h: number;
    remove_content?: number;
    by_type?: Array<{ action_type: string; count: number }>;
    recent: AdminModerationAction[];
  };
};

export type AdminHealth = {
  ok: boolean;
  service?: string;
  environment?: string;
  version?: string;
  timestamp?: string;
  request_id?: string;
  checks?: {
    api: "ok" | string;
    supabase_url_configured: boolean;
    supabase_publishable_configured: boolean;
    supabase_service_configured: boolean;
    admin_routes: "ok" | string;
  };
  supabaseUrlConfigured: boolean;
  publishableKeyConfigured: boolean;
  secretKeyConfigured: boolean;
};

export type AdminSystemHealth = {
  ok: boolean;
  service: string;
  environment: string;
  version: string;
  timestamp: string;
  request_id: string;
  duration_ms: number;
  admin: {
    user_id: string;
    email: string;
    role: "admin" | "moderator";
    fallback: boolean;
  };
  checks: {
    api: "ok" | "warning" | string;
    admin_auth: "ok" | "warning" | string;
    supabase_connection: "ok" | "warning" | string;
    reports_table: "ok" | "warning" | string;
    videos_table: "ok" | "warning" | string;
    places_table: "ok" | "warning" | string;
    moderation_actions_table: "ok" | "warning" | string;
    metrics: "in_memory" | string;
    loki_configured: boolean;
    grafana_logs_enabled: boolean;
  };
  config: {
    supabase_url_configured: boolean;
    supabase_publishable_configured: boolean;
    supabase_service_configured: boolean;
    metrics_token_configured: boolean;
    loki_enabled: boolean;
    loki_url_configured: boolean;
    loki_username_configured: boolean;
    loki_token_configured: boolean;
    loki_ready: boolean;
    grafana_logs_enabled: boolean;
  };
  warnings: string[];
};

export type AdminMetricsSnapshot = {
  ok: true;
  request_id: string;
  generated_at: string;
  note: string;
  counters: Array<{ name: string; labels: Record<string, string>; value: number }>;
  timers: Array<{
    name: string;
    labels: Record<string, string>;
    count: number;
    sum: number;
    avg: number;
    p95: number;
  }>;
};

export type NullableMetric = number | null;

export type OpsBreakdownEntry = {
  value?: string;
  content_type?: ReportContentType;
  reason?: ReportReason;
  count: number;
};

export type AdminOpsSummary = {
  health: {
    api_connected: boolean;
    supabase_configured: boolean;
    secret_key_configured: boolean;
    admin_authorized: boolean;
    environment: string;
  };
  users: {
    total: NullableMetric;
    new_24h: NullableMetric;
    new_7d: NullableMetric;
    deactivated: NullableMetric;
    ghost: NullableMetric;
    active_24h: NullableMetric;
    active_7d: NullableMetric;
  };
  content: {
    videos: {
      total: NullableMetric;
      published: NullableMetric;
      processing: NullableMetric;
      reported_legacy: NullableMetric;
      active: NullableMetric;
      under_review: NullableMetric;
      hidden: NullableMetric;
      removed: NullableMetric;
      created_7d?: NullableMetric;
    };
    places: {
      total: NullableMetric;
      published: NullableMetric;
      deleted: NullableMetric;
      active: NullableMetric;
      under_review: NullableMetric;
      hidden: NullableMetric;
      removed: NullableMetric;
      created_7d?: NullableMetric;
    };
    routes: {
      total: NullableMetric;
      published: NullableMetric;
      public: NullableMetric;
      draft: NullableMetric;
    };
  };
  engagement: {
    likes: NullableMetric;
    comments: NullableMetric;
    followers: NullableMetric;
    user_hidden_content: NullableMetric;
    analytics_events?: NullableMetric;
  };
  moderation: {
    reports_total: NullableMetric;
    pending: NullableMetric;
    reviewed: NullableMetric;
    dismissed: NullableMetric;
    removed: NullableMetric;
    removed_or_actions?: NullableMetric;
    oldest_pending_at: string | null;
    actions_total: number;
    actions_24h: number;
    remove_content_actions?: number;
  };
  breakdowns: {
    reports_by_content_type: Array<{ content_type: ReportContentType; count: number }>;
    reports_by_reason: Array<{ reason: ReportReason; count: number }>;
    videos_by_state: OpsBreakdownEntry[];
    places_by_state: OpsBreakdownEntry[];
    videos_by_moderation_status: OpsBreakdownEntry[];
    places_by_moderation_status: OpsBreakdownEntry[];
  };
  recent: {
    users: AdminUserSummary[];
    videos: AdminContentSummaryItem[];
    places: AdminContentSummaryItem[];
    routes: AdminContentSummaryItem[];
    reports: AdminRecentReport[];
    admin_actions: AdminModerationAction[];
  };
  warnings: string[];
};

export type AdminUsersResponse = {
  ok: true;
  users: AdminUserSummary[];
  total: number | null;
  source: string | null;
  warnings: string[];
};

export type DashboardStats = {
  pending: number;
  video: number;
  user: number;
  place: number;
  reviewedToday: number;
  removed: number;
};

export type ModerationActionType =
  | "hide_video"
  | "restore_video"
  | "hide_place"
  | "restore_place"
  | "suspend_user"
  | "unsuspend_user"
  | "dismiss_report"
  | "mark_reviewed"
  | "reopen_report"
  | "remove_content";

async function accessToken() {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Sign in to Supabase admin first.");
  }
  return data.session.access_token;
}

export class AdminApiError extends Error {
  status?: number;
  requestId?: string;

  constructor(message: string, options: { status?: number; requestId?: string } = {}) {
    super(message);
    this.name = "AdminApiError";
    this.status = options.status;
    this.requestId = options.requestId;
  }
}

function createClientRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function withTimeout(init: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const cleanup = () => window.clearTimeout(timeout);

  if (init.signal) {
    init.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return { signal: controller.signal, cleanup };
}

function requestHeaders(init: RequestInit, token?: string) {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!headers.has("x-request-id")) headers.set("x-request-id", createClientRequestId());
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

function errorMessage(message: string, status?: number, requestId?: string) {
  const base =
    status === 401
      ? "Sign in to Supabase admin first."
      : status === 403
        ? "Your account is signed in, but it is not authorized for Explore Admin Console."
        : message || "Something went wrong.";
  return requestId ? `${base} Request ID: ${requestId}` : base;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    request_id?: string;
  };
  const requestId = response.headers.get("x-request-id") || data.request_id || undefined;

  if (!response.ok) {
    throw new AdminApiError(errorMessage(data.error ?? `Request failed (${response.status}).`, response.status, requestId), {
      status: response.status,
      requestId,
    });
  }

  return data;
}

async function apiFetch<T>(path: string, init: RequestInit = {}, tokenOverride?: string): Promise<T> {
  const token = tokenOverride ?? (await accessToken());
  const method = (init.method || "GET").toUpperCase();
  const canRetry = method === "GET";
  const attempts = canRetry ? 2 : 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { signal, cleanup } = withTimeout(init);
    try {
      const response = await fetch(path, {
        ...init,
        signal,
        headers: requestHeaders(init, token),
      });
      return await parseResponse<T>(response);
    } catch (error) {
      const status = error instanceof AdminApiError ? error.status : undefined;
      const retryable = canRetry && attempt < attempts && (!status || status === 502 || status === 503 || status === 504);
      if (!retryable) {
        if (error instanceof AdminApiError) throw error;
        throw new AdminApiError(error instanceof Error ? error.message : "Network request failed.");
      }
    } finally {
      cleanup();
    }
  }

  throw new AdminApiError("Network request failed.");
}

async function publicApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const canRetry = method === "GET";
  const attempts = canRetry ? 2 : 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { signal, cleanup } = withTimeout(init);
    try {
      const response = await fetch(path, {
        ...init,
        signal,
        headers: requestHeaders(init),
      });
      return await parseResponse<T>(response);
    } catch (error) {
      const status = error instanceof AdminApiError ? error.status : undefined;
      const retryable = canRetry && attempt < attempts && (!status || status === 502 || status === 503 || status === 504);
      if (!retryable) {
        if (error instanceof AdminApiError) throw error;
        throw new AdminApiError(error instanceof Error ? error.message : "Network request failed.");
      }
    } finally {
      cleanup();
    }
  }

  throw new AdminApiError("Network request failed.");
}

export function fetchAdminMe(token: string) {
  return apiFetch<AdminMe>("/api/admin/me", undefined, token);
}

export function fetchApiHealth() {
  return publicApiFetch<AdminHealth>("/api/health");
}

export function fetchAdminSystemHealth() {
  return apiFetch<AdminSystemHealth>("/api/admin/system/health");
}

export function fetchAdminSystemMetrics() {
  return apiFetch<AdminMetricsSnapshot>("/api/admin/system/metrics?format=json");
}

export function getAdminReports(filters: {
  status?: ReportStatusFilter;
  contentType?: ReportContentTypeFilter;
  reason?: ReportReasonFilter;
  sort?: Exclude<ReportsSort, "priority">;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams({
    status: filters.status ?? "pending",
    content_type: filters.contentType ?? "all",
    reason: filters.reason ?? "all",
    sort: filters.sort ?? "newest",
    limit: String(filters.limit ?? 50),
    offset: String(filters.offset ?? 0),
  });
  return apiFetch<ReportsResponse>(`/api/admin/reports?${params}`);
}

export const fetchReports = getAdminReports;

export function getAdminReportDetail(reportId: string) {
  return apiFetch<AdminReportDetailResponse>(`/api/admin/reports/${encodeURIComponent(reportId)}`);
}

export async function fetchModerationSummary(): Promise<AdminModerationSummary> {
  const data = await apiFetch<{ ok: true; summary: AdminModerationSummary }>("/api/admin/moderation/summary");
  return data.summary;
}

export async function fetchOpsSummary(): Promise<AdminOpsSummary> {
  const data = await apiFetch<{ ok: true; summary: AdminOpsSummary }>("/api/admin/ops/summary");
  return data.summary;
}

export function fetchAdminUsers(filters: { query?: string; limit?: number } = {}) {
  const params = new URLSearchParams({
    query: filters.query ?? "",
    limit: String(filters.limit ?? 25),
  });
  return apiFetch<AdminUsersResponse>(`/api/admin/users?${params}`);
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const summary = await fetchModerationSummary();
  const typeCount = (type: ReportContentType) =>
    summary.by_content_type.find((entry) => entry.content_type === type)?.count ?? 0;

  return {
    pending: summary.reports.pending,
    video: typeCount("video"),
    user: typeCount("user"),
    place: typeCount("place") + typeCount("place_photo"),
    reviewedToday: summary.reports.reviewed_last_24h ?? 0,
    removed: summary.reports.removed_or_actions ?? summary.reports.removed,
  };
}

export function updateReportStatus(id: string, status: Exclude<ReportStatus, "pending">, notes?: string) {
  return apiFetch<{ ok: true; report: AdminReport }>(`/api/admin/reports/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, notes }),
  });
}

export function markReportReviewed(reportId: string, notes?: string) {
  return updateReportStatus(reportId, "reviewed", notes);
}

export function dismissReport(reportId: string, notes?: string) {
  return updateReportStatus(reportId, "dismissed", notes);
}

export function applyModerationAction(payload: {
  report_id?: string;
  target_type: ReportContentType;
  target_id: string;
  action_type: ModerationActionType;
  notes?: string;
}) {
  return apiFetch<{
    ok: true;
    action_id: string;
    action: AdminModerationAction;
    report: AdminReport | null;
    target: AdminReportTarget | null;
  }>(
    "/api/admin/moderation/action",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function hideVideo(videoId: string, reportId?: string, notes?: string) {
  return applyModerationAction({
    report_id: reportId,
    target_type: "video",
    target_id: videoId,
    action_type: "hide_video",
    notes,
  });
}

export function reopenReport(report: AdminReport, notes?: string) {
  return applyModerationAction({
    report_id: report.id,
    target_type: report.content_type,
    target_id: report.content_id,
    action_type: "reopen_report",
    notes,
  });
}

export function removeVideo(videoId: string, reportId?: string, notes?: string) {
  return applyModerationAction({
    report_id: reportId,
    target_type: "video",
    target_id: videoId,
    action_type: "remove_content",
    notes,
  });
}

export function restoreVideo(videoId: string, reportId?: string, notes?: string) {
  return applyModerationAction({
    report_id: reportId,
    target_type: "video",
    target_id: videoId,
    action_type: "restore_video",
    notes,
  });
}
