export type MetricDataState = "available" | "empty" | "unavailable" | "delayed" | "error" | "partial";

export type MetricDefinition = {
  id: string;
  label: string;
  description: string;
  source: string;
  formula: string;
  timestamp: string;
  identity: string;
  timezone: string;
  filtering: string;
  availability: string;
  freshness: string;
  comparisonEligible: boolean;
  format: "number" | "percent";
};

export const ADMIN_METRIC_REGISTRY = {
  active_users: {
    id: "active_users",
    label: "Active users",
    description: "Distinct observed identities active in the selected period.",
    source: "analytics_normalized_events via GET /api/admin/business/dashboard",
    formula: "count(distinct user_id when present, otherwise anonymous_id)",
    timestamp: "received_at within the reporting window",
    identity: "Authenticated IDs take precedence per event; anonymous-to-account linkage is not inferred.",
    timezone: "UTC reporting boundaries; event-local timezone is retained only for local-time analysis.",
    filtering: "Valid, analytics-eligible events after platform/source filters.",
    availability: "Available when the normalized analytics view is readable; zero means no observed identities.",
    freshness: "data_as_of returned by the canonical Business Analytics Core.",
    comparisonEligible: true,
    format: "number",
  },
  sessions: {
    id: "sessions",
    label: "Sessions",
    description: "Distinct valid session identifiers observed in the selected period.",
    source: "analytics_normalized_events via GET /api/admin/business/dashboard",
    formula: "count(distinct session_id)",
    timestamp: "received_at within the reporting window",
    identity: "Uses the emitted normalized session ID; it does not mix reconstructed timeout sessions.",
    timezone: "UTC reporting boundaries.",
    filtering: "Valid, analytics-eligible events after platform/source filters.",
    availability: "Available when normalized events are readable and contain the required session contract.",
    freshness: "data_as_of returned by the canonical Business Analytics Core.",
    comparisonEligible: true,
    format: "number",
  },
  route_starts: {
    id: "route_starts",
    label: "Route starts",
    description: "Validated route-start events, counted as total starts rather than distinct routes or users.",
    source: "analytics_normalized_events.event_name = route_start",
    formula: "count(*) where event_name = 'route_start'",
    timestamp: "received_at within the reporting window",
    identity: "Event count; identity does not change the aggregation.",
    timezone: "UTC reporting boundaries.",
    filtering: "Valid, analytics-eligible events after platform/source filters.",
    availability: "Zero is shown only after the normalized source returns a complete valid result.",
    freshness: "data_as_of returned by the canonical Business Analytics Core.",
    comparisonEligible: true,
    format: "number",
  },
  commercial_actions: {
    id: "commercial_actions",
    label: "Commercial actions",
    description: "Observed directions, call, website, and map-open actions; this is not revenue or sales.",
    source: "analytics_normalized_events canonical commercial-action taxonomy",
    formula: "place_get_directions + place_call + place_website_click + place_open_map/place_map_open",
    timestamp: "received_at within the reporting window",
    identity: "Event count; repeated valid actions remain separate observations.",
    timezone: "UTC reporting boundaries.",
    filtering: "Valid, analytics-eligible events after platform/source filters.",
    availability: "Zero is shown only after the normalized source returns a complete valid result.",
    freshness: "data_as_of returned by the canonical Business Analytics Core.",
    comparisonEligible: true,
    format: "number",
  },
  app_opens: {
    id: "app_opens",
    label: "App opens",
    description: "Supported app-open or session-start events when lifecycle instrumentation is present.",
    source: "analytics_events lifecycle event taxonomy",
    formula: "count(app_open, session_start)",
    timestamp: "received_at within the reporting window",
    identity: "Event count.",
    timezone: "UTC reporting boundaries.",
    filtering: "Valid events only.",
    availability: "Unavailable when lifecycle instrumentation coverage cannot be verified.",
    freshness: "Latest accepted event timestamp.",
    comparisonEligible: true,
    format: "number",
  },
  place_views: {
    id: "place_views",
    label: "Place views",
    description: "Validated place-detail view observations.",
    source: "analytics_normalized_events canonical place-view taxonomy",
    formula: "count(valid place view events)",
    timestamp: "received_at within the reporting window",
    identity: "Event count.",
    timezone: "UTC reporting boundaries.",
    filtering: "Valid, analytics-eligible events after platform/source filters.",
    availability: "Unavailable when place-view instrumentation coverage cannot be verified.",
    freshness: "data_as_of returned by the canonical Business Analytics Core.",
    comparisonEligible: true,
    format: "number",
  },
} as const satisfies Record<string, MetricDefinition>;

export type AdminMetricId = keyof typeof ADMIN_METRIC_REGISTRY;
