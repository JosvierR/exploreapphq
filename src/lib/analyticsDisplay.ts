export const ANALYTICS_EVENT_ALLOWLIST = [
  "app_open",
  "session_start",
  "session_end",
  "screen_view",
  "search_submitted",
  "search_result_clicked",
  "search_no_results",
  "video_impression",
  "video_view_start",
  "video_view_3s",
  "video_view_25",
  "video_view_50",
  "video_view_75",
  "video_view_complete",
  "video_skip_fast",
  "video_like",
  "video_unlike",
  "video_comment",
  "video_share",
  "video_open_places_routes",
  "place_impression",
  "place_click",
  "place_save",
  "place_unsave",
  "place_open_map",
  "place_get_directions",
  "place_share",
  "place_call",
  "place_website_click",
  "route_impression",
  "route_click",
  "route_save",
  "route_unsave",
  "route_start",
  "route_step_view",
  "route_complete",
  "route_share",
  "profile_view",
  "follow_user",
  "unfollow_user",
  "report_submitted",
  "content_hidden",
  "content_unhidden",
  "block_user",
  "unblock_user",
  "push_notification_open",
  "deep_link_open",
  "error_boundary_shown",
] as const;

export const METRIC_LABELS: Record<string, string> = {
  active_users_estimate: "Active users (estimate)",
  active_sessions: "Sessions",
  sessions: "Sessions",
  sessions_in_range: "Sessions",
  app_opens: "App opens",
  content_views_total: "Content views",
  content_views: "Content views",
  searches_total: "Searches",
  searches: "Searches",
  total_searches: "Searches",
  no_result_searches: "No-result searches",
  no_result_rate: "No-result rate",
  result_clicks: "Result clicks",
  search_to_content_view_estimate: "Search-to-content view estimate",
  click_through_rate: "CTR",
  engagement_actions: "Engagement actions",
  engagement_rate_estimate: "Engagement rate estimate",
  dead_letters_total: "Rejected events",
  dead_letters: "Rejected events",
  dead_letters_last_1h: "Rejected events (1h)",
  dead_letters_last_24h: "Rejected events (24h)",
  dead_letters_in_range: "Rejected events",
  dead_letter_rate_24h: "Rejected-event rate (24h)",
  events: "Events",
  total_events: "Events",
  events_today: "Events today",
  events_last_5m: "Events (5m)",
  events_last_1h: "Events (1h)",
  events_last_24h: "Events (24h)",
  events_last_7d: "Events (7d)",
  events_last_30d: "Events (30d)",
  events_in_range: "Events",
  total_events_in_range: "Events",
  avg_events_per_session: "Avg events per session",
  active_anonymous_ids: "Anonymous users",
  active_authenticated_users: "Authenticated users",
  active_authenticated_users_in_range: "Authenticated users",
  anonymous_ids_in_range: "Anonymous users",
  authenticated_users_in_range: "Authenticated users",
  estimated_new_anonymous_ids: "Estimated new anonymous users",
  estimated_returning_anonymous_ids: "Estimated returning anonymous users",
  estimated_new_authenticated_users: "Estimated new authenticated users",
  estimated_returning_authenticated_users: "Estimated returning authenticated users",
  content_view_to_action: "Content view to action",
  app_open_to_content_view: "App open to content view",
  video_views: "Video views",
  place_views: "Place views",
  route_views: "Route views",
  profile_views: "Profile views",
  saves_total: "Saves",
  likes_total: "Likes",
  shares_total: "Shares",
  reports_total: "Reports",
  views: "Views",
  likes: "Likes",
  saves: "Saves",
  shares: "Shares",
  reports: "Reports",
  route_starts: "Route starts",
  engagement_score: "Engagement score",
  rank: "Rank",
  count: "Count",
  unique_sessions: "Sessions",
  dropoff_pct: "Dropoff",
  dropoff_percent: "Dropoff",
  users: "Users",
  top_of_funnel: "Top of funnel",
  bottom_of_funnel: "Bottom of funnel",
  steps: "Steps",
  videos_count: "Videos",
  places_count: "Places",
  routes_count: "Routes",
  profiles_count: "Profiles",
  creators_count: "Creators",
  creator_events: "Creator events",
  events_with_location: "Events with location",
  min_city_threshold: "Minimum city threshold",
  query_hash: "Search fingerprint",
  search_fingerprint: "Search fingerprint",
  entity_id: "Content ID",
  entity_id_short: "Content ID",
  entity_type: "Content type",
  content_id: "Content ID",
  creator_id: "Creator ID",
  creator_id_short: "Creator ID",
  source: "Source",
  platform: "Platform",
  day: "Day",
  period: "Period",
  period_start: "Period start",
  period_end: "Period end",
  rejected_events: "Rejected events",
  notes: "Notes",
  country: "Country",
  region: "Region",
  city: "City",
  ingestion_health: "Ingestion health",
  latest_received_at: "Latest received",
  latest_occurred_at: "Latest occurred",
  last_successful_received_at: "Last successful event",
  latest_aggregation_day: "Latest aggregate day",
  latest_admin_metrics_day: "Latest metrics day",
  latest_overview_day: "Latest overview day",
  is_today_aggregated: "Today aggregated",
  is_yesterday_aggregated: "Yesterday aggregated",
  rejection_reasons: "Rejection reasons",
  rejection_sources: "Rejection sources",
  top_event_names: "Top event names",
  top_platforms: "Top platforms",
  top_sources: "Top sources",
};

export const EVENT_LABELS: Record<string, string> = {
  app_open: "App opened",
  session_start: "Session started",
  session_end: "Session ended",
  screen_view: "Screen viewed",
  search_submitted: "Search submitted",
  search_performed: "Search performed",
  search_result_clicked: "Search result clicked",
  search_no_results: "Search with no results",
  video_impression: "Video impression",
  video_view: "Video viewed",
  video_view_start: "Video started",
  video_view_3s: "Video viewed for 3 seconds",
  video_view_25: "Video viewed 25%",
  video_view_50: "Video viewed 50%",
  video_view_75: "Video viewed 75%",
  video_view_complete: "Video completed",
  video_skip_fast: "Video skipped quickly",
  video_like: "Video liked",
  video_unlike: "Video unliked",
  video_comment: "Video commented",
  video_share: "Video shared",
  video_save: "Video saved",
  video_open_places_routes: "Video places/routes opened",
  place_impression: "Place impression",
  place_view: "Place viewed",
  place_click: "Place clicked",
  place_like: "Place liked",
  place_save: "Place saved",
  place_unsave: "Place unsaved",
  place_open_map: "Place map opened",
  place_get_directions: "Place directions requested",
  place_share: "Place shared",
  place_call: "Place called",
  place_website_click: "Place website clicked",
  place_photo_view: "Place photo viewed",
  place_photo_like: "Place photo liked",
  place_photo_save: "Place photo saved",
  place_photo_share: "Place photo shared",
  route_impression: "Route impression",
  route_view: "Route viewed",
  route_click: "Route clicked",
  route_like: "Route liked",
  route_save: "Route saved",
  route_unsave: "Route unsaved",
  route_start: "Route started",
  route_step_view: "Route step viewed",
  route_complete: "Route completed",
  route_share: "Route shared",
  content_view: "Content viewed",
  content_like: "Content liked",
  content_save: "Content saved",
  content_share: "Content shared",
  profile_view: "Profile viewed",
  user_profile_view: "Profile viewed",
  follow_user: "User followed",
  unfollow_user: "User unfollowed",
  report_submitted: "Report submitted",
  content_hidden: "Content hidden",
  content_unhidden: "Content restored",
  block_user: "User blocked",
  unblock_user: "User unblocked",
  push_notification_open: "Push notification opened",
  deep_link_open: "Deep link opened",
  error_boundary_shown: "Error boundary shown",
};

export const ENTITY_LABELS: Record<string, string> = {
  all: "All content",
  video: "Video",
  videos: "Videos",
  place: "Place",
  places: "Places",
  route: "Route",
  routes: "Routes",
  user: "Profile",
  users: "Profiles",
  profile: "Profile",
  profiles: "Profiles",
  creator: "Creator",
  creators: "Creators",
  search: "Search",
  screen: "Screen",
  system: "System",
  content: "Content",
  unknown: "Unknown content",
};

export const PLATFORM_LABELS: Record<string, string> = {
  all: "All platforms",
  ios: "iOS",
  android: "Android",
  web: "Web",
  server: "Server",
  unknown: "Unknown platform",
};

export const SOURCE_LABELS: Record<string, string> = {
  all: "All sources",
  mobile: "Mobile",
  web: "Web",
  backend: "Backend",
  admin: "Admin",
  server: "Server",
  unknown: "Unknown source",
};

export const PROPERTY_LABELS: Record<string, string> = {
  event_id: "Event ID",
  event_name: "Event",
  event_version: "Event version",
  user_id: "User ID",
  anonymous_id: "Anonymous ID",
  anonymous_id_short: "Anonymous ID",
  session_id: "Session ID",
  session_id_short: "Session ID",
  entity_id: "Content ID",
  entity_type: "Content type",
  content_id: "Content ID",
  creator_id: "Creator ID",
  producer_id: "Producer ID",
  owner_id: "Owner ID",
  author_id: "Author ID",
  screen_name: "Screen name",
  screen_time: "Screen time",
  duration_ms: "Duration",
  duration_seconds: "Duration",
  time_spent_ms: "Time spent",
  time_spent_seconds: "Time spent",
  query_hash: "Search fingerprint",
  search_query_hash: "Search fingerprint",
  result_count: "Result count",
  rank: "Rank",
  position: "Position",
  index: "Index",
  source: "Source",
  platform: "Platform",
  app_version: "App version",
  build_number: "Build number",
  device_os: "Device OS",
  locale: "Locale",
  timezone: "Timezone",
  country: "Country",
  region: "Region",
  city: "City",
  occurred_at: "Occurred",
  received_at: "Received",
  sent_at: "Sent",
  batch_id: "Batch ID",
  request_id: "Request ID",
  context: "Context",
  properties: "Properties",
  authenticated: "Authenticated",
  user_id_present: "Authenticated",
  has_user_id: "Authenticated",
  is_authenticated: "Authenticated",
  referrer: "Referrer",
  path: "Path",
  route: "Route",
  url: "URL",
  href: "URL",
  title: "Title",
  slug: "Slug",
  category: "Category",
  reason: "Reason",
  severity: "Severity",
  message: "Message",
  error: "Error",
  error_code: "Error code",
  error_message: "Error message",
  stack: "Stack",
};

export const WARNING_LABELS: Record<string, string> = {
  no_mobile_events_in_range: "Waiting for mobile analytics",
  no_events_in_range: "Waiting for analytics activity",
  creator_id_not_in_analytics_events: "Creator metadata missing",
  location_metadata_missing: "Location metadata missing",
  no_content_entity_id: "Content IDs missing",
  missing_query_hash: "Search fingerprints incomplete",
  sample_capped: "Sample capped",
  dead_letters_time_column_unavailable: "Rejected-event timestamp unavailable",
  dead_letters_unavailable: "Rejected events unavailable",
  dead_letters_source_unavailable: "Rejected-event source unavailable",
  funnel_taxonomy_incomplete: "Funnel taxonomy incomplete",
  content_entities_missing: "Content entities missing",
  analytics_cron_not_configured: "Analytics cron not configured",
  analytics_cron_unauthorized: "Analytics cron unauthorized",
  analytics_schema_missing: "Analytics schema missing",
  analytics_column_mismatch: "Analytics schema mismatch",
  analytics_permission_denied: "Analytics permission denied",
};

export const DEAD_LETTER_LABELS: Record<string, string> = {
  invalid_row: "Invalid event row",
  invalid_source: "Invalid source",
  "event_id is required": "Event ID is required",
  "session_id is required": "Session ID is required",
  "event_name is required": "Event name is required",
  "event_version is invalid": "Event version is invalid",
  "entity_type is invalid": "Content type is invalid",
  "platform is invalid": "Platform is invalid",
  "properties must be a JSON object": "Properties must be a JSON object",
  "context must be a JSON object": "Context must be a JSON object",
  "properties contain forbidden keys": "Properties contain forbidden keys",
  "context contains forbidden keys": "Context contains forbidden keys",
  analytics_schema_missing: "Analytics schema missing",
  analytics_column_mismatch: "Analytics schema mismatch",
  analytics_permission_denied: "Analytics permission denied",
  analytics_constraint_failed: "Analytics constraint failed",
  analytics_duplicate_conflict: "Duplicate event ID",
  analytics_service_role_missing: "Service role missing",
};

export const FILTER_LABELS: Record<string, string> = {
  all: "All",
  "range:24h": "Last 24 hours",
  "range:7d": "Last 7 days",
  "range:30d": "Last 30 days",
  "range:90d": "Last 90 days",
  "platform:all": "All platforms",
  "source:all": "All sources",
  "content:all": "All content",
  "entity:all": "All content",
  "auth:all": "All users",
};

export const AUTH_LABELS: Record<string, string> = {
  yes: "Authenticated",
  no: "Anonymous",
  true: "Authenticated",
  false: "Anonymous",
  anon: "Anonymous",
  anonymous: "Anonymous",
  authenticated: "Authenticated",
  all: "All users",
};

export const WARNING_COPY: Record<string, { title: string; body: string; action?: string }> = {
  no_mobile_events_in_range: {
    title: "Waiting for mobile analytics",
    body: "DATA-003 has not produced mobile events in this period yet. Release a mobile build with analytics enabled, ask testers to use the app, then refresh this dashboard.",
    action: "Expected events: app opened, screen viewed, content views, search, save, like, and share.",
  },
  no_events_in_range: {
    title: "Waiting for analytics activity",
    body: "No analytics events were found in the selected range. Release a mobile build with analytics enabled and ask testers to use the app.",
    action: "Expected events: app opened, screen viewed, content views, search, save, like, and share.",
  },
  creator_id_not_in_analytics_events: {
    title: "Creator insights need creator metadata",
    body: "Analytics events are being received, but creator IDs are not included yet. Add creator IDs to safe event properties for videos, places, and routes.",
  },
  location_metadata_missing: {
    title: "Market insights need safe location metadata",
    body: "Events do not include country, region, or city yet. Do not send exact lat/lng. Only send aggregated market metadata.",
  },
  no_content_entity_id: {
    title: "Content rankings need content IDs",
    body: "Send content type and content ID for content views and actions so videos, places, routes, and profiles can be ranked.",
  },
  missing_query_hash: {
    title: "Search fingerprints incomplete",
    body: "Some search events are missing search fingerprints. Search privacy is still protected because raw queries are never shown.",
  },
  sample_capped: {
    title: "Sample capped",
    body: "Insights are computed from the latest sampled events in range. Use a shorter range for more precise directional reads.",
  },
  dead_letters_time_column_unavailable: {
    title: "Rejected-event timestamp unavailable",
    body: "Rejected-event counts are limited because the timestamp column could not be read.",
  },
  dead_letters_unavailable: {
    title: "Rejected events unavailable",
    body: "Rejected-event counts could not be loaded for this range.",
  },
  funnel_taxonomy_incomplete: {
    title: "Funnel taxonomy incomplete",
    body: "App-open events are missing, so funnel estimates may be incomplete.",
  },
  content_entities_missing: {
    title: "Content entities missing",
    body: "No content type or content ID events were found in range.",
  },
};

const ACRONYMS: Record<string, string> = {
  api: "API",
  auth: "Auth",
  csv: "CSV",
  ctr: "CTR",
  dau: "DAU",
  db: "DB",
  gps: "GPS",
  id: "ID",
  ids: "IDs",
  ios: "iOS",
  ip: "IP",
  json: "JSON",
  os: "OS",
  rpc: "RPC",
  ui: "UI",
  uri: "URI",
  url: "URL",
  ux: "UX",
  uuid: "UUID",
  wau: "WAU",
};

export type AnalyticsJsonField = {
  key: string;
  label: string;
  value: string;
};

export function humanizeKey(key: string | null | undefined) {
  const value = String(key ?? "").trim();
  if (!value) return "Not available";
  if (value === "unknown") return "Unknown";
  if (!/[_-]/.test(value) && /\s|\//.test(value)) return sentenceCase(value);

  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => ACRONYMS[part.toLowerCase()] || sentenceCase(part))
    .join(" ");
}

export function metricLabel(key: string | null | undefined) {
  const value = String(key ?? "");
  return METRIC_LABELS[value] || propertyLabel(value);
}

export function eventLabel(key: string | null | undefined) {
  const value = String(key ?? "");
  return EVENT_LABELS[value] || humanizeKey(value);
}

export function entityLabel(key: string | null | undefined) {
  const value = String(key ?? "");
  return ENTITY_LABELS[value] || humanizeKey(value);
}

export function platformLabel(key: string | null | undefined) {
  const value = String(key ?? "");
  return PLATFORM_LABELS[value] || humanizeKey(value);
}

export function sourceLabel(key: string | null | undefined) {
  const value = String(key ?? "");
  return SOURCE_LABELS[value] || humanizeKey(value);
}

export function propertyLabel(key: string | null | undefined) {
  const value = String(key ?? "");
  return PROPERTY_LABELS[value] || humanizeKey(value);
}

export function warningCodeLabel(code: string | null | undefined) {
  const value = String(code ?? "");
  return WARNING_LABELS[value] || WARNING_COPY[value]?.title || humanizeKey(value);
}

export function deadLetterReasonLabel(reason: string | null | undefined) {
  const value = String(reason ?? "");
  return DEAD_LETTER_LABELS[value] || humanizeKey(value);
}

export function filterLabel(key: string | null | undefined) {
  const value = String(key ?? "");
  if (FILTER_LABELS[value]) return FILTER_LABELS[value];
  if (value.startsWith("platform:")) return platformLabel(value.slice("platform:".length));
  if (value.startsWith("source:")) return sourceLabel(value.slice("source:".length));
  if (value.startsWith("content:")) return entityLabel(value.slice("content:".length));
  if (value.startsWith("entity:")) return entityLabel(value.slice("entity:".length));
  if (value.startsWith("auth:")) return authLabel(value.slice("auth:".length));
  return humanizeKey(value);
}

export function authLabel(key: string | boolean | null | undefined) {
  const value = String(key ?? "");
  return AUTH_LABELS[value] || humanizeKey(value);
}

export function analyticsColumnLabel(key: string | null | undefined) {
  const value = String(key ?? "");
  return METRIC_LABELS[value] || PROPERTY_LABELS[value] || EVENT_LABELS[value] || ENTITY_LABELS[value] || humanizeKey(value);
}

export function warningCopy(code: string, fallbackMessage?: string) {
  return (
    WARNING_COPY[code] || {
      title: warningCodeLabel(code),
      body: fallbackMessage || "Additional instrumentation may improve this section.",
    }
  );
}

export function formatPropertyValue(key: string | null | undefined, value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not available";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return formatNumericPropertyValue(String(key ?? ""), value);
  if (typeof value === "string") {
    if (isIsoDate(value)) return new Date(value).toLocaleString();
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "No items";
    const primitives = value.filter((item) => ["string", "number", "boolean"].includes(typeof item));
    if (primitives.length === value.length && primitives.length <= 5) {
      return primitives.map((item) => formatPropertyValue(key, item)).join(", ");
    }
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (typeof value === "object") {
    const count = Object.keys(value as Record<string, unknown>).length;
    return count === 0 ? "No fields" : `${count} field${count === 1 ? "" : "s"}`;
  }
  return String(value);
}

export function formatAnalyticsJson(payload: unknown): AnalyticsJsonField[] {
  if (!isPlainObject(payload)) return [];
  return flattenAnalyticsJson(payload);
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
  if (start && end) return `${start} - ${end}`;
  return preset ? filterLabel(`range:${preset}`) : "Selected period";
}

export function formatTrend(delta?: { percent: number | null; absolute: number; label?: string | null }) {
  if (!delta) return null;
  if (delta.label) return delta.label;
  if (delta.percent == null) return "No previous data";
  const sign = delta.percent > 0 ? "+" : "";
  return `${sign}${delta.percent}%`;
}

export function shortenId(value: unknown) {
  if (!value || typeof value !== "string") return "Not available";
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function flattenAnalyticsJson(payload: Record<string, unknown>, parents: string[] = [], keyPath: string[] = []): AnalyticsJsonField[] {
  const rows: AnalyticsJsonField[] = [];
  for (const [key, value] of Object.entries(payload).filter(([, item]) => item !== undefined)) {
    const labelPath = [...parents, propertyLabel(key)];
    const nextKeyPath = [...keyPath, key];
    if (isPlainObject(value)) {
      const children = flattenAnalyticsJson(value, labelPath, nextKeyPath);
      if (children.length > 0) {
        rows.push(...children);
      } else {
        rows.push({ key: nextKeyPath.join("."), label: labelPath.join(" / "), value: "No fields" });
      }
      continue;
    }
    rows.push({
      key: nextKeyPath.join("."),
      label: labelPath.join(" / "),
      value: formatPropertyValue(key, value),
    });
  }
  return rows;
}

function formatNumericPropertyValue(key: string, value: number) {
  if (!Number.isFinite(value)) return "Not available";
  if (key.endsWith("_ms") || key === "duration_ms" || key === "time_spent_ms") {
    return formatSeconds(value / 1000);
  }
  if (key === "screen_time" || key.endsWith("_seconds") || key.endsWith("_sec")) {
    return formatSeconds(value);
  }
  if (key.endsWith("_pct") || key.endsWith("_percent") || key.endsWith("_rate")) {
    const percent = Math.abs(value) <= 1 ? value * 100 : value;
    return `${formatDecimal(percent)}%`;
  }
  return new Intl.NumberFormat().format(value);
}

function formatSeconds(value: number) {
  return `${formatDecimal(value)} s`;
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}

function sentenceCase(value: string) {
  if (!value) return value;
  const lower = value.toLowerCase();
  return ACRONYMS[lower] || `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}
