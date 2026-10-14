export const METRIC_CONFIDENCE_VERSION = "metric-confidence-v3";

const BEHAVIOR_METRICS = [
  "active_users",
  "sessions",
  "place_views",
  "route_views",
  "route_starts",
  "route_completions",
  "commercial_actions",
  "demand_index",
];

const STATUS_RANK = Object.freeze({
  verified: 0,
  partial: 1,
  delayed: 2,
  unavailable: 3,
  under_investigation: 4,
});

function statusEntry(status, reason, source = "analytics_normalized_events") {
  return { status, reason, source };
}

function behavioralBaseConfidence(dashboard) {
  if (!dashboard || dashboard.state === "zero") {
    return statusEntry("unavailable", "No valid events exist in the selected reporting window.");
  }
  if (dashboard.data_quality?.status === "degraded" || Number(dashboard.data_quality?.aggregation_failures || 0) > 0) {
    return statusEntry("under_investigation", "The validity view or aggregation pipeline reports a failure.");
  }
  const rejectionRate = Number(dashboard.data_quality?.rejection_coverage_pct);
  if (Number.isFinite(rejectionRate) && rejectionRate >= 20) {
    return statusEntry(
      "under_investigation",
      `${rejectionRate}% of observed ingestion outcomes in the selected window were rejected. Dead letters are not dimensionally complete enough to quantify per-metric undercount.`,
    );
  }
  if (Number.isFinite(rejectionRate) && rejectionRate > 0) {
    return statusEntry("partial", `${rejectionRate}% operational rejection coverage affects the selected window.`);
  }
  if (dashboard.data_quality?.rejected_events_in_range == null) {
    return statusEntry("partial", "Matched-window rejection coverage is unavailable for this filtered view.");
  }

  const cutoff = Date.parse(String(dashboard.data_as_of || ""));
  const end = Date.parse(String(dashboard.range?.end || ""));
  if (Number.isFinite(cutoff) && Number.isFinite(end) && end - cutoff > 6 * 60 * 60 * 1000) {
    return statusEntry("delayed", "The latest valid event is more than six hours behind the reporting-window end.");
  }
  return statusEntry("verified", "Canonical definitions and matched-window quality checks are available.");
}

export function buildMetricConfidence(dashboard, revenue) {
  const base = behavioralBaseConfidence(dashboard);
  const metrics = Object.fromEntries(BEHAVIOR_METRICS.map((key) => [key, { ...base }]));
  if (dashboard?.demand_index?.score == null) {
    metrics.demand_index = statusEntry("unavailable", "Reliable demand-index components or minimum sample are missing.", "Business Analytics Core");
  } else {
    metrics.demand_index.source = "Business Analytics Core";
  }
  metrics.verified_revenue = revenue?.total_verified_revenue == null
    ? statusEntry("unavailable", revenue?.unavailable_reason || "No reconciled financial source is connected.", "authorized financial source")
    : statusEntry("verified", "Value was supplied by an authorized and reconciled financial source.", "authorized financial source");

  const behavioralOverall = BEHAVIOR_METRICS.map((key) => metrics[key]).reduce(
    (worst, item) => STATUS_RANK[item.status] > STATUS_RANK[worst] ? item.status : worst,
    "verified",
  );
  const includingRevenue = Object.values(metrics).reduce(
    (worst, item) => STATUS_RANK[item.status] > STATUS_RANK[worst] ? item.status : worst,
    "verified",
  );
  return { version: METRIC_CONFIDENCE_VERSION, overall: behavioralOverall, including_revenue: includingRevenue, metrics };
}
