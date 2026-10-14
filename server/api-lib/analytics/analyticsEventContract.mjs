/**
 * Canonical server-side analytics ingestion contract.
 *
 * Keep this module dependency-free so mobile/web producers can mirror it in
 * generated documentation and contract tests without importing the router.
 */
export const ANALYTICS_EVENT_CONTRACT_VERSION = "analytics-ingestion-v2";

export const ANALYTICS_EVENT_NAMES = Object.freeze([
  "app_open",
  "app_background",
  "app_foreground",
  "session_start",
  "session_end",
  "screen_view",
  "search_submitted",
  "search_performed",
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
  "place_view",
  "place_click",
  "place_save",
  "place_unsave",
  "place_open_map",
  "place_map_open",
  "place_get_directions",
  "place_share",
  "place_call",
  "place_website_click",
  "route_impression",
  "route_view",
  "route_click",
  "route_save",
  "route_unsave",
  "route_start",
  "route_record_start",
  "route_recorded_choice",
  "route_step_view",
  "route_stop_view",
  "route_complete",
  "route_share",
  "route_publish_step_view",
  "route_publish_step_complete",
  "route_publish_exit",
  "route_publish_complete",
  "route_difficulty_corrected",
  "route_transport_corrected",
  "content_impression",
  "content_view",
  "content_save",
  "content_share",
  "share",
  "rating_submit",
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
]);

export const ANALYTICS_ENTITY_TYPES = Object.freeze([
  "video",
  "content",
  "post",
  "place",
  "route",
  "profile",
  "user",
  "search",
  "session",
  "screen",
  "notification",
  "business",
  "system",
  null,
]);

export const ANALYTICS_PLATFORMS = Object.freeze(["ios", "android", "web", "server", null]);
export const ANALYTICS_SOURCES = Object.freeze(["mobile", "web", "backend", "admin"]);
export const ANALYTICS_ATTRIBUTION_SOURCE_TYPES = Object.freeze([
  "search",
  "map",
  "feed",
  "video",
  "post",
  "content",
  "route",
  "creator",
  "recommendation",
  "profile",
  "direct_link",
  null,
]);

const ROUTE_AUTHORING_EVENTS = new Set([
  "route_record_start",
  "route_recorded_choice",
  "route_publish_step_view",
  "route_publish_step_complete",
  "route_publish_exit",
  "route_publish_complete",
  "route_difficulty_corrected",
  "route_transport_corrected",
]);

const EVENT_PROFILES = Object.freeze({
  app_open: { entities: ["system", "session", null], entity_id_required: false, family: "app_lifecycle" },
  app_background: { entities: ["session", "system"], entity_id_required: false, family: "app_lifecycle" },
  app_foreground: { entities: ["session", "system"], entity_id_required: false, family: "app_lifecycle" },
  session_start: { entities: ["session"], entity_id_required: true, family: "session_lifecycle" },
  session_end: { entities: ["session"], entity_id_required: true, family: "session_lifecycle" },
  ...Object.fromEntries(
    [...ROUTE_AUTHORING_EVENTS].map((eventName) => [
      eventName,
      { entities: ["route"], entity_id_required: true, family: "route_authoring" },
    ]),
  ),
});

export const ANALYTICS_REJECTION_DIAGNOSTICS = Object.freeze({
  "event_name is not allowed": "Producer sent an event outside the canonical allowlist.",
  "entity_type is invalid": "Producer entity_type does not match the canonical entity vocabulary.",
  "entity_type does not match event contract": "Producer used a valid entity_type that is incompatible with this event.",
  "entity_id is required for this event": "Producer omitted the entity identifier required to reconcile this event.",
  invalid_source: "Producer source is missing or outside mobile, web, backend, and admin.",
});

export function analyticsEventProfile(eventName) {
  const profile = EVENT_PROFILES[eventName];
  return profile
    ? { ...profile, entities: [...profile.entities] }
    : { entities: [...ANALYTICS_ENTITY_TYPES], entity_id_required: false, family: "general" };
}

export function analyticsEventProfileIssue(eventName, entityType, entityId) {
  const profile = EVENT_PROFILES[eventName];
  if (!profile) return null;
  if (!profile.entities.includes(entityType ?? null)) return "entity_type does not match event contract";
  if (profile.entity_id_required && !entityId) return "entity_id is required for this event";
  return null;
}

export function analyticsEventContractManifest() {
  return {
    version: ANALYTICS_EVENT_CONTRACT_VERSION,
    event_names: [...ANALYTICS_EVENT_NAMES],
    entity_types: [...ANALYTICS_ENTITY_TYPES],
    platforms: [...ANALYTICS_PLATFORMS],
    sources: [...ANALYTICS_SOURCES],
    attribution_source_types: [...ANALYTICS_ATTRIBUTION_SOURCE_TYPES],
    profiled_events: Object.fromEntries(
      Object.keys(EVENT_PROFILES).sort().map((eventName) => [eventName, analyticsEventProfile(eventName)]),
    ),
  };
}
