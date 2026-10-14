export const REPORT_NARRATIVE_VERSION = "report-narrative-v1";

const MIN_TABLE_ROWS = 1;

function statusFor(snapshot, metric) {
  return snapshot?.data_readiness?.metrics?.[metric]?.reliability_status || "unavailable";
}

function hasRows(rows, minimum = MIN_TABLE_ROWS) {
  return Array.isArray(rows) && rows.length >= minimum;
}

function eligibleMetric(snapshot, metric, { allowQualified = true } = {}) {
  const readiness = snapshot?.data_readiness?.metrics?.[metric];
  if (!readiness?.reporting_available) return false;
  return allowQualified ? readiness.investor_qualified_eligible : readiness.investor_headline_eligible;
}

export function buildReportNarrative(snapshot, options = {}) {
  const isInvestor = options.classification === "investor_safe";
  const hasBehavior = ["active_users", "sessions", "route_starts", "commercial_actions"]
    .some((metric) => eligibleMetric(snapshot, metric));
  const marketEligible = hasRows(snapshot.markets) || hasRows(snapshot.categories);
  const demandEligible = eligibleMetric(snapshot, "demand_index") && snapshot.headline?.demand_index != null;
  const revenueAvailable = snapshot.revenue?.total_verified_revenue != null;
  const commercialAvailable = Number(snapshot.headline?.commercial_actions || 0) > 0;
  const insights = (snapshot.insights || []).filter((item) => item.evidence && item.finding).slice(0, 3);
  const opportunities = (snapshot.opportunities || []).filter((item) => item.evidence && item.finding).slice(0, 3);

  const sections = {
    executive: {
      eligible: hasBehavior,
      reason: hasBehavior ? "Canonical behavioral metrics are available." : "No eligible headline metric is available.",
    },
    engagement: {
      eligible: hasRows(snapshot.trends, 2) && hasBehavior,
      reason: hasRows(snapshot.trends, 2) ? "Time-series evidence is available." : "At least two time points are required.",
    },
    product: {
      eligible: hasRows(snapshot.routes) || hasRows(snapshot.places) || Number(snapshot.headline?.route_starts || 0) > 0,
      reason: "Shown only when route, place, or feature activity is available.",
    },
    markets: {
      eligible: marketEligible,
      reason: marketEligible ? "Eligible market or category aggregates are available." : "No privacy-safe market/category ranking is available.",
      demand_index_eligible: demandEligible,
    },
    commercial: {
      eligible: commercialAvailable || insights.length > 0 || opportunities.length > 0,
      reason: "Commercial activity and deterministic evidence-led insights are separated from revenue.",
    },
    revenue: {
      eligible: revenueAvailable || commercialAvailable,
      reason: revenueAvailable
        ? "An authorized financial value is available."
        : commercialAvailable
          ? "Commercial activity is available, while financial performance remains unavailable."
          : "No financial or commercial activity is eligible for a dedicated section.",
    },
    quality: {
      eligible: true,
      reason: "Material reporting qualifications always remain visible.",
    },
    analyst_tables: {
      eligible: hasRows(snapshot.trends) || hasRows(snapshot.routes) || hasRows(snapshot.places),
      reason: "Supporting tables are included for reproducibility when data exists.",
    },
    glossary: {
      eligible: true,
      reason: "Definitions remain available in detailed products.",
    },
    technical_appendix: {
      eligible: !isInvestor || options.reportType === "analyst_report",
      reason: "Internal identifiers are kept out of the primary investor narrative.",
    },
  };

  const omitted = Object.entries(sections)
    .filter(([, section]) => !section.eligible)
    .map(([id, section]) => ({ id, reason: section.reason }));

  return {
    version: REPORT_NARRATIVE_VERSION,
    sections,
    omitted,
    executive_insights: insights,
    executive_opportunities: opportunities,
    financial_state: revenueAvailable ? "verified_source_available" : "financial_data_unavailable",
    commercial_state: commercialAvailable ? "observed_activity_available" : "no_observed_activity",
    reliability_state: statusFor(snapshot, "active_users"),
  };
}
