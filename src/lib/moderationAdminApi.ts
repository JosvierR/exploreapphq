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
  target_report_count?: number;
  actions?: AdminModerationAction[];
  target: {
    title?: string;
    thumbnail_url?: string;
    video_url?: string;
    owner_id?: string;
    username?: string;
    display_name?: string;
    avatar_url?: string;
    place_name?: string;
    city?: string;
    category?: string;
    photo_url?: string;
    place_id?: string;
    moderation_status?: ModerationVisibilityStatus | string;
    state?: string;
    visibility?: string;
  };
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

export type ReportsResponse = {
  reports: AdminReport[];
  total: number;
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
  supabaseUrlConfigured: boolean;
  publishableKeyConfigured: boolean;
  secretKeyConfigured: boolean;
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
  | "remove_content";

async function accessToken() {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Sign in to Supabase admin first.");
  }
  return data.session.access_token;
}

async function apiFetch<T>(path: string, init: RequestInit = {}, tokenOverride?: string): Promise<T> {
  const token = tokenOverride ?? (await accessToken());
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    const error = new Error(data.error ?? `Request failed (${response.status}).`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return data;
}

async function publicApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    const error = new Error(data.error ?? `Request failed (${response.status}).`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return data;
}

export function fetchAdminMe(token: string) {
  return apiFetch<AdminMe>("/api/admin/me", undefined, token);
}

export function fetchApiHealth() {
  return publicApiFetch<AdminHealth>("/api/health");
}

export function fetchReports(filters: {
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

export async function fetchModerationSummary(): Promise<AdminModerationSummary> {
  const data = await apiFetch<{ ok: true; summary: AdminModerationSummary }>("/api/admin/moderation/summary");
  return data.summary;
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

export function applyModerationAction(payload: {
  report_id?: string;
  target_type: ReportContentType;
  target_id: string;
  action_type: ModerationActionType;
  notes?: string;
}) {
  return apiFetch<{ ok: true; action_id: string; report: AdminReport | null }>(
    "/api/admin/moderation/action",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
