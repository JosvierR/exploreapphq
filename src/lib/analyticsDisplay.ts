export const METRIC_LABELS: Record<string, string> = {
  active_users_estimate: "Active users estimate",
  active_sessions: "Sessions",
  sessions: "Sessions",
  app_opens: "App opens",
  content_views_total: "Content views",
  content_views: "Content views",
  searches_total: "Searches",
  searches: "Searches",
  engagement_actions: "Engagement actions",
  dead_letters_total: "Rejected events",
  dead_letters: "Rejected events",
  query_hash: "Search fingerprint",
  entity_id: "Content ID",
  entity_type: "Content type",
  source: "Source",
  platform: "Platform",
};

export const EVENT_LABELS: Record<string, string> = {
  app_open: "App opened",
  screen_view: "Screen viewed",
  video_view: "Video viewed",
  video_view_start: "Video viewed",
  place_view: "Place viewed",
  route_view: "Route viewed",
  profile_view: "Profile viewed",
  user_profile_view: "Profile viewed",
  search_submitted: "Search performed",
  search_performed: "Search performed",
  search_no_results: "Search with no results",
  video_like: "Liked",
  place_save: "Saved",
  video_share: "Shared",
  report_submitted: "Reported",
  follow_user: "Followed",
};

export const ENTITY_LABELS: Record<string, string> = {
  video: "Video",
  place: "Place",
  route: "Route",
  user: "Profile",
  profile: "Profile",
  search: "Search",
  screen: "Screen",
  system: "System",
};

export const WARNING_COPY: Record<string, { title: string; body: string; action?: string }> = {
  no_mobile_events_in_range: {
    title: "Waiting for mobile analytics",
    body: "DATA-003 has not produced mobile events in this period yet. Release a mobile build with analytics enabled, ask testers to use the app, then refresh this dashboard.",
    action: "Expected events: app_open, screen_view, content views, search, save, like, share.",
  },
  no_events_in_range: {
    title: "Waiting for analytics activity",
    body: "No analytics events were found in the selected range. Release a mobile build with analytics enabled and ask testers to use the app.",
    action: "Expected events: app_open, screen_view, content views, search, save, like, share.",
  },
  creator_id_not_in_analytics_events: {
    title: "Creator insights need creator metadata",
    body: "Analytics events are being received, but creator_id is not included yet. Add creator_id to safe event properties for videos, places, and routes.",
  },
  location_metadata_missing: {
    title: "Market insights need safe location metadata",
    body: "Events do not include country, region, or city yet. Do not send exact lat/lng. Only send aggregated market metadata.",
  },
  no_content_entity_id: {
    title: "Content rankings need entity IDs",
    body: "Send entity_type and entity_id for content views and actions so videos, places, routes, and profiles can be ranked.",
  },
  missing_query_hash: {
    title: "Search fingerprints incomplete",
    body: "Some search events are missing query_hash. Search privacy is still protected because raw queries are never shown.",
  },
};

export function metricLabel(key: string) {
  return METRIC_LABELS[key] || key.replaceAll("_", " ");
}

export function eventLabel(key: string) {
  return EVENT_LABELS[key] || key.replaceAll("_", " ");
}

export function entityLabel(key: string) {
  return ENTITY_LABELS[key] || key;
}

export function warningCopy(code: string, fallbackMessage?: string) {
  return (
    WARNING_COPY[code] || {
      title: "Data note",
      body: fallbackMessage || "Additional instrumentation may improve this section.",
    }
  );
}

export function formatNumber(value: unknown) {
  if (value == null) return "0";
  if (typeof value === "string") return value;
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return new Intl.NumberFormat().format(value);
}

export function formatPercent(value: unknown) {
  if (value == null || typeof value !== "number" || Number.isNaN(value)) return "0%";
  return `${value}%`;
}

export function formatCompact(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatRangeLabel(start?: string, end?: string, preset?: string) {
  if (start && end) return `${start} – ${end}`;
  return preset || "Selected period";
}

export function formatTrend(delta?: { percent: number | null; absolute: number; label?: string | null }) {
  if (!delta) return null;
  if (delta.label) return delta.label;
  if (delta.percent == null) return "No previous data";
  const sign = delta.percent > 0 ? "+" : "";
  return `${sign}${delta.percent}%`;
}

export function shortenId(value: unknown) {
  if (!value || typeof value !== "string") return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
