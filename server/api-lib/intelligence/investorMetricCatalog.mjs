export const INVESTOR_METRIC_CATALOG_VERSION = "investor-metrics-v2";

const canonicalSource = "analytics_normalized_events via Business Analytics Core";

export const INVESTOR_METRIC_CATALOG = Object.freeze({
  active_users: {
    label: "Active users",
    definition: "Distinct observed identities active in the selected period.",
    formula: "count(distinct authenticated user_id, otherwise anonymous_id)",
    source: canonicalSource,
    unit: "users",
    availability: "available_when_canonical_source_is_readable",
    comparison: true,
    privacy: "aggregate; suppress cohorts below five",
    export_eligibility: ["executive_business", "investor_safe"],
  },
  sessions: {
    label: "Sessions",
    definition: "Distinct valid session identifiers observed in the selected period.",
    formula: "count(distinct session_id)",
    source: canonicalSource,
    unit: "sessions",
    availability: "available_when_session_contract_is_present",
    comparison: true,
    privacy: "aggregate",
    export_eligibility: ["executive_business", "investor_safe"],
  },
  route_starts: {
    label: "Route starts",
    definition: "Validated route-start events; not distinct routes or users.",
    formula: "count(*) where event_name = route_start",
    source: canonicalSource,
    unit: "events",
    availability: "available_when_canonical_source_is_readable",
    comparison: true,
    privacy: "aggregate",
    export_eligibility: ["executive_business", "investor_safe"],
  },
  commercial_actions: {
    label: "Commercial actions",
    definition: "Observed directions, call, website, and map-open actions. This is intent, not sales or revenue.",
    formula: "directions + calls + website clicks + map opens",
    source: canonicalSource,
    unit: "events",
    availability: "available_when_canonical_source_is_readable",
    comparison: true,
    privacy: "aggregate",
    export_eligibility: ["executive_business", "investor_safe"],
  },
  demand_index: {
    label: "Demand index",
    definition: "Versioned composite of observed demand, growth, intent, supply, and momentum.",
    formula: "Business Analytics Core Demand Index v1",
    source: "Business Analytics Core derived metric",
    unit: "index_0_100",
    availability: "requires_reliable_components_and_minimum_sample",
    comparison: true,
    privacy: "aggregate",
    export_eligibility: ["executive_business", "investor_safe"],
  },
  revenue: {
    label: "Verified revenue",
    definition: "Recognized or measured monetary value from an authorized revenue-system integration.",
    formula: "source-system recognized revenue in the selected period",
    source: "No authorized revenue source is currently configured",
    unit: "currency",
    availability: "unavailable_until_a_verified_financial_source_is_connected",
    comparison: false,
    privacy: "financial aggregate",
    export_eligibility: ["executive_business", "investor_safe"],
  },
});

export function investorMetricCatalogForClient() {
  return {
    version: INVESTOR_METRIC_CATALOG_VERSION,
    metrics: INVESTOR_METRIC_CATALOG,
  };
}
