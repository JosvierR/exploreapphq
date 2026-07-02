import type {
  ModerationVisibilityStatus,
  ReportContentTypeFilter,
  ReportReasonFilter,
  ReportsSort,
  ReportStatusFilter,
} from "@/lib/moderationAdminApi";

export type VisibilityFilter = ModerationVisibilityStatus | "all" | "hidden_removed" | "unknown";

export const statusFilters: { value: ReportStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "reviewed", label: "Reviewed" },
  { value: "dismissed", label: "Dismissed" },
  { value: "removed", label: "Removed" },
];

export const contentTypeFilters: { value: ReportContentTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "video", label: "Video" },
  { value: "user", label: "User" },
  { value: "place", label: "Place" },
  { value: "place_photo", label: "Place photo" },
];

export const reportViewTabs: { value: ReportContentTypeFilter; label: string }[] = [
  { value: "video", label: "Video Reports" },
  { value: "all", label: "All Reports" },
  { value: "place", label: "Place Reports" },
  { value: "user", label: "User Reports" },
  { value: "place_photo", label: "Photo Reports" },
];

export const reasonFilters: { value: ReportReasonFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Inappropriate" },
  { value: "harassment", label: "Harassment" },
  { value: "violence", label: "Violence" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "fake", label: "Fake" },
  { value: "other", label: "Other" },
];

export const visibilityFilters: { value: VisibilityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "under_review", label: "Under review" },
  { value: "hidden", label: "Hidden" },
  { value: "removed", label: "Removed" },
  { value: "hidden_removed", label: "Hidden or removed" },
  { value: "unknown", label: "Not available" },
];

export const sortOptions: { value: ReportsSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "priority", label: "Priority first" },
];

export function readStatus(params: URLSearchParams): ReportStatusFilter {
  const value = params.get("status") ?? "pending";
  return statusFilters.some((filter) => filter.value === value) ? (value as ReportStatusFilter) : "pending";
}

export function readContentType(params: URLSearchParams): ReportContentTypeFilter {
  const value = params.get("content_type") ?? "video";
  return contentTypeFilters.some((filter) => filter.value === value) ? (value as ReportContentTypeFilter) : "video";
}

export function readReason(params: URLSearchParams): ReportReasonFilter {
  const value = params.get("reason") ?? "all";
  return reasonFilters.some((filter) => filter.value === value) ? (value as ReportReasonFilter) : "all";
}

export function readVisibility(params: URLSearchParams): VisibilityFilter {
  const value = params.get("visibility") ?? "all";
  return visibilityFilters.some((filter) => filter.value === value) ? (value as VisibilityFilter) : "all";
}

export function readSort(params: URLSearchParams): ReportsSort {
  const value = params.get("sort") ?? "priority";
  return sortOptions.some((option) => option.value === value) ? (value as ReportsSort) : "priority";
}
