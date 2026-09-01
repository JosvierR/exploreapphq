import type { FeedbackCategory, FeedbackStatus, LabTab } from "../types";

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  listening: "Listening",
  considering: "Under review",
  planned: "Planned",
  building: "Building",
  shipped: "Shipped",
  not_now: "Not right now",
};

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  discover: "Discover",
  places: "Places",
  routes: "Routes",
  community: "Community",
  ai: "AI",
  profile: "Profile",
  events: "Events",
  other: "Other",
};

/** Forum feed filters */
export const LAB_TABS: { id: LabTab; label: string }[] = [
  { id: "trending", label: "Trending" },
  { id: "newest", label: "Newest" },
];

export const PROGRESS_STEPS: FeedbackStatus[] = ["listening", "planned", "building", "shipped"];

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}
