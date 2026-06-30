import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type ReportStatus = "pending" | "reviewed" | "dismissed" | "removed";
export type ReportStatusFilter = ReportStatus | "all";
export type ReportContentType = "video" | "user" | "place" | "place_photo";
export type ReportContentTypeFilter = ReportContentType | "all";
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
  };
};

export type ReportsResponse = {
  reports: AdminReport[];
  total: number;
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

export function fetchAdminMe(token: string) {
  return apiFetch<AdminMe>("/api/admin/me", undefined, token);
}

export function fetchReports(filters: {
  status?: ReportStatusFilter;
  contentType?: ReportContentTypeFilter;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams({
    status: filters.status ?? "pending",
    content_type: filters.contentType ?? "all",
    limit: String(filters.limit ?? 50),
    offset: String(filters.offset ?? 0),
  });
  return apiFetch<ReportsResponse>(`/api/admin/reports?${params}`);
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [pending, video, user, place, placePhoto, reviewed, removed] = await Promise.all([
    fetchReports({ status: "pending", limit: 1 }),
    fetchReports({ status: "all", contentType: "video", limit: 1 }),
    fetchReports({ status: "all", contentType: "user", limit: 1 }),
    fetchReports({ status: "all", contentType: "place", limit: 1 }),
    fetchReports({ status: "all", contentType: "place_photo", limit: 1 }),
    fetchReports({ status: "reviewed", limit: 100 }),
    fetchReports({ status: "removed", limit: 1 }),
  ]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return {
    pending: pending.total,
    video: video.total,
    user: user.total,
    place: place.total + placePhoto.total,
    reviewedToday: reviewed.reports.filter((report) => {
      if (!report.reviewed_at) return false;
      return new Date(report.reviewed_at).getTime() >= startOfToday.getTime();
    }).length,
    removed: removed.total,
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
