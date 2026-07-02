import type {
  AdminReportActor,
  AdminReport,
  ModerationActionType,
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

export function formatDurationSeconds(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Not available";

  const totalSeconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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

export function actorDisplayName(actor: AdminReportActor | null | undefined, fallback = "Not available") {
  if (!actor) return fallback;
  if (actor.handle) return `@${actor.handle}`;
  return actor.display_name || actor.email || actor.id || fallback;
}

export function videoVisibilitySummary(report: AdminReport) {
  const status = report.target.moderation_status || report.target.visibility || "unknown";
  const state = report.target.state || "unknown";
  const globallyVisible = Boolean(report.target.is_publicly_visible ?? report.target.globally_visible);

  if (status === "hidden") {
    return {
      title: "Hidden globally",
      body: "This video is hidden from Explore for everyone.",
      globallyVisible,
    };
  }

  if (status === "removed") {
    return {
      title: "Removed from public visibility",
      body: "This video is removed from public visibility and has not been hard-deleted.",
      globallyVisible,
    };
  }

  if (status === "under_review") {
    return {
      title: state === "published" ? "Published and under review" : "Under review",
      body:
        state === "published"
          ? "Published videos remain visible while they are under review."
          : "Visibility depends on the publication state while review is active.",
      globallyVisible,
    };
  }

  if (status === "active" && state === "published") {
    return {
      title: "Published and active",
      body: "This video is visible publicly to normal users.",
      globallyVisible,
    };
  }

  if (report.reporter_hidden_for_target) {
    return {
      title: "Hidden for the reporter",
      body: "The reporter has this content hidden through user_hidden_content. That does not hide it globally.",
      globallyVisible,
    };
  }

  return {
    title: `${formatVisibilityLabel(String(status))} / ${fallbackLabel(String(state))}`,
    body: globallyVisible
      ? "This video appears globally visible based on its state and moderation status."
      : "This video does not appear publicly visible based on its state and moderation status.",
    globallyVisible,
  };
}

export function videoActionAvailability(report: AdminReport) {
  return getVideoModerationActionMatrix(report).video;
}

export function getVideoModerationActionMatrix(report: AdminReport) {
  const status = String(report.target.moderation_status || report.target.visibility || "").toLowerCase();
  const state = String(report.target.state || "").toLowerCase();
  const isVideo = report.target.type === "video" || report.content_type === "video";
  const isClosedReport = report.status === "reviewed" || report.status === "dismissed" || report.status === "removed";
  const notPublished = Boolean(state && !["published", "active", "public", "ready"].includes(state));
  const showRestore = restoreVideoActionCopy(report);

  return {
    report: {
      canMarkReviewed: report.status !== "reviewed",
      canDismiss: report.status !== "dismissed",
      canReopen: isClosedReport,
      isClosed: isClosedReport,
      lifecycleLabel: isClosedReport ? "Closed" : "Open",
    },
    video: {
      canHide: isVideo && (status === "active" || status === "under_review" || !status),
      canRemove: isVideo && status !== "removed",
      canRestore: isVideo && (status === "hidden" || status === "removed"),
      restoreLabel: showRestore.label,
      restoreHelp: showRestore.help,
      alreadyVisibleNote:
        status === "active" || status === "under_review" ? "Video is already visible." : "",
      publicationNote: notPublished
        ? "Restoring moderation_status will not make this public unless the video state is published."
        : "",
    },
  };
}

export function restoreVideoActionCopy(report: AdminReport) {
  const status = String(report.target.moderation_status || report.target.visibility || "").toLowerCase();

  if (status === "hidden") {
    return {
      label: "Show video",
      help: "Make this hidden video visible again to users.",
      result: "Video is visible again.",
    };
  }

  if (status === "removed") {
    return {
      label: "Restore video",
      help: "Restore this removed video to active visibility.",
      result: "Video restored to active visibility.",
    };
  }

  return {
    label: "Restore video",
    help: "Video is already visible.",
    result: "Video is visible again.",
  };
}

export function actionResultMessage(actionType: ModerationActionType, report?: AdminReport) {
  if (actionType === "hide_video") return "Video hidden globally.";
  if (actionType === "remove_content" && report?.content_type === "video") {
    return "Video removed from public visibility.";
  }
  if (actionType === "restore_video") return report ? restoreVideoActionCopy(report).result : "Video is visible again.";
  if (actionType === "mark_reviewed") return "Report marked reviewed.";
  if (actionType === "dismiss_report") return "Report dismissed.";
  if (actionType === "reopen_report") return "Report reopened for review.";
  return "Moderation action completed.";
}

export function recoveryActionFor(actionType: ModerationActionType): ModerationActionType | null {
  if (actionType === "hide_video") return "restore_video";
  if (actionType === "remove_content") return "restore_video";
  if (actionType === "restore_video") return "hide_video";
  if (actionType === "mark_reviewed" || actionType === "dismiss_report") return "reopen_report";
  return null;
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
    return report.target.title || report.target.description || report.target.video_url || "Video";
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
    if (report.target.creator) return `Creator ${actorDisplayName(report.target.creator)}`;
    return report.target.owner_id ? `Creator ${shortId(report.target.owner_id)}` : shortId(report.content_id);
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
