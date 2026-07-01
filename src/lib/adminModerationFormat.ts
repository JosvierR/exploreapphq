import type {
  AdminReport,
  ModerationVisibilityStatus,
  ReportContentType,
  ReportReason,
  ReportStatus,
} from "@/lib/moderationAdminApi";

export type ReportPriority = "high" | "medium" | "low";

const contentTypeLabels: Record<ReportContentType, string> = {
  video: "Video",
  user: "User",
  place: "Place",
  place_photo: "Place photo",
};

const reasonLabels: Record<ReportReason, string> = {
  spam: "Spam",
  inappropriate: "Inappropriate",
  harassment: "Harassment",
  violence: "Violence",
  sexual_content: "Sexual content",
  fake: "Fake",
  other: "Other",
};

const statusLabels: Record<ReportStatus, string> = {
  pending: "Pending",
  reviewed: "Reviewed",
  dismissed: "Dismissed",
  removed: "Removed",
};

const visibilityLabels: Record<ModerationVisibilityStatus, string> = {
  active: "Active",
  under_review: "Under review",
  hidden: "Hidden",
  removed: "Removed",
};

const priorityLabels: Record<ReportPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const highPriorityReasons = new Set<ReportReason>(["violence", "sexual_content", "harassment"]);
const mediumPriorityReasons = new Set<ReportReason>(["inappropriate", "fake"]);

function fallbackLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function validDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return "Not provided";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") return "Object";
  return String(value);
}

export function formatContentTypeLabel(type: ReportContentType | string) {
  return contentTypeLabels[type as ReportContentType] ?? fallbackLabel(type);
}

export function formatReasonLabel(reason: ReportReason | string) {
  return reasonLabels[reason as ReportReason] ?? fallbackLabel(reason);
}

export function formatStatusLabel(status: ReportStatus | string) {
  return statusLabels[status as ReportStatus] ?? fallbackLabel(status);
}

export function formatVisibilityLabel(status: ModerationVisibilityStatus | string) {
  return visibilityLabels[status as ModerationVisibilityStatus] ?? fallbackLabel(status);
}

export function formatPriorityLabel(priority: ReportPriority | string) {
  return priorityLabels[priority as ReportPriority] ?? fallbackLabel(priority);
}

export function formatDateTime(value: string | null | undefined) {
  const date = validDate(value);
  if (!date) return "Not available";

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfValue = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (startOfValue.getTime() === startOfToday.getTime()) {
    return `Today, ${time}`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatRelativeTime(value: string | null | undefined) {
  const date = validDate(value);
  if (!date) return "";

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const divisions = [
    { amount: 60, unit: "second" },
    { amount: 60, unit: "minute" },
    { amount: 24, unit: "hour" },
    { amount: 7, unit: "day" },
    { amount: 4.345, unit: "week" },
    { amount: 12, unit: "month" },
    { amount: Number.POSITIVE_INFINITY, unit: "year" },
  ] as const;

  let duration = diffSeconds;
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
        Math.round(duration),
        division.unit,
      );
    }
    duration /= division.amount;
  }

  return "";
}

export function reportAgeMs(value: string | null | undefined, now = Date.now()) {
  const date = validDate(value);
  if (!date) return 0;
  return Math.max(0, now - date.getTime());
}

export function reportAgeHours(value: string | null | undefined, now = Date.now()) {
  return reportAgeMs(value, now) / (60 * 60 * 1000);
}

export function formatAge(value: string | null | undefined, now = Date.now()) {
  const minutes = Math.floor(reportAgeMs(value, now) / (60 * 1000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function getReportPriority(report: AdminReport, now = Date.now()): ReportPriority {
  const ageHours = report.status === "pending" ? reportAgeHours(report.created_at, now) : 0;
  const reportCount = report.target_report_count ?? 1;

  if (highPriorityReasons.has(report.reason) || reportCount > 1 || ageHours >= 24) {
    return "high";
  }

  if (mediumPriorityReasons.has(report.reason) || ageHours >= 6) {
    return "medium";
  }

  return "low";
}

export function safeMetadataPreview(metadata: Record<string, unknown> | null | undefined, maxItems = 4) {
  const entries = Object.entries(metadata ?? {}).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return "No metadata";

  return entries
    .slice(0, maxItems)
    .map(([key, value]) => `${fallbackLabel(key)}: ${formatMetadataValue(value)}`)
    .join(" | ");
}

export function shortId(value: string | null | undefined, head = 8, tail = 4) {
  if (!value) return "Not available";
  return value.length > head + tail + 3 ? `${value.slice(0, head)}...${value.slice(-tail)}` : value;
}

export function targetTitle(report: AdminReport) {
  if (report.content_type === "video") {
    return report.target.title || report.target.video_url || "Video";
  }

  if (report.content_type === "user") {
    return report.target.username ? `@${report.target.username}` : report.target.display_name || "User";
  }

  if (report.content_type === "place") {
    return report.target.place_name || "Place";
  }

  return report.target.photo_url ? "Place photo" : "Place photo";
}

export function targetSubtitle(report: AdminReport) {
  if (report.content_type === "video") {
    return report.target.owner_id ? `Owner ${shortId(report.target.owner_id)}` : shortId(report.content_id);
  }

  if (report.content_type === "user") {
    return report.target.display_name && report.target.username
      ? report.target.display_name
      : shortId(report.content_id);
  }

  if (report.content_type === "place") {
    const location = [report.target.city, report.target.category].filter(Boolean).join(" / ");
    return location || shortId(report.content_id);
  }

  return report.target.place_id ? `Place ${shortId(report.target.place_id)}` : shortId(report.content_id);
}

export function targetImage(report: AdminReport) {
  return report.target.thumbnail_url || report.target.avatar_url || report.target.photo_url || "";
}
