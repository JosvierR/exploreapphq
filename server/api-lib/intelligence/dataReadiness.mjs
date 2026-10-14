import { INVESTOR_METRIC_CATALOG } from "./investorMetricCatalog.mjs";

export const DATA_READINESS_VERSION = "data-readiness-v1";

const HUMAN_STATUS = Object.freeze({
  verified: "Verified",
  partial: "Qualified / partial",
  delayed: "Delayed",
  unavailable: "Unavailable",
  under_investigation: "Under investigation",
});

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function availabilityFor(metricKey, dashboard, revenue) {
  const kpis = dashboard?.kpis || {};
  if (metricKey === "verified_revenue") return revenue?.total_verified_revenue;
  if (metricKey === "demand_index") return dashboard?.demand_index?.score;
  return kpis[metricKey] ?? (metricKey === "commercial_actions" ? kpis.commercial_intent : null);
}

function qualityDimensions(dashboard, confidence) {
  const quality = dashboard?.data_quality || {};
  const rejection = finite(quality.rejection_coverage_pct);
  const validityReady = Boolean(quality.validity_view_active) && finite(quality.aggregation_failures || 0) === 0;
  const completeness = rejection == null
    ? { status: "partial", label: HUMAN_STATUS.partial, explanation: "Matched-window rejection coverage is unavailable for this filtered view." }
    : rejection >= 20
      ? { status: "under_investigation", label: HUMAN_STATUS.under_investigation, explanation: `${rejection}% of observed ingestion outcomes in the window were rejected; retries may repeat event IDs.` }
      : rejection > 0
        ? { status: "partial", label: HUMAN_STATUS.partial, explanation: `${rejection}% of observed ingestion outcomes in the window were rejected.` }
        : { status: "verified", label: HUMAN_STATUS.verified, explanation: "No matched-window dead letters were observed for this snapshot." };

  return {
    pipeline_operational_readiness: validityReady
      ? { status: "verified", label: "Operational", explanation: "The canonical normalized view is active and no aggregation failure is reported." }
      : { status: "under_investigation", label: HUMAN_STATUS.under_investigation, explanation: "The normalized view or aggregation pipeline is not fully healthy." },
    data_completeness: completeness,
    metric_correctness: validityReady
      ? { status: "verified", label: HUMAN_STATUS.verified, explanation: "Metrics use the versioned canonical formulas and normalized reporting source." }
      : { status: "under_investigation", label: HUMAN_STATUS.under_investigation, explanation: "Canonical correctness cannot be asserted while the normalized source is degraded." },
    reporting_confidence: {
      status: confidence?.overall || "unavailable",
      label: HUMAN_STATUS[confidence?.overall] || HUMAN_STATUS.unavailable,
      explanation: confidence?.overall === "verified"
        ? "Headline behavioral metrics may be used with their definitions and period context."
        : "Headline conclusions require the qualifications attached to each metric.",
    },
    historical_coverage: completeness,
  };
}

export function buildDataReadiness(dashboard, revenue, confidence) {
  const dataAsOf = dashboard?.data_as_of || null;
  const range = dashboard?.range || null;
  const metrics = Object.fromEntries(Object.entries(INVESTOR_METRIC_CATALOG).map(([key, definition]) => {
    const confidenceEntry = confidence?.metrics?.[key] || {
      status: availabilityFor(key, dashboard, revenue) == null ? "unavailable" : confidence?.overall || "partial",
      reason: "A dedicated metric-confidence result is not available.",
      source: definition.source,
    };
    const value = availabilityFor(key, dashboard, revenue);
    const status = value == null ? "unavailable" : confidenceEntry.status;
    const qualified = status === "verified" || status === "partial";
    return [key, {
      metric: key,
      label: definition.label,
      business_question: definition.business_question,
      canonical_source: definition.source,
      contract: definition.contract,
      reporting_available: value != null,
      instrumentation_start_date: definition.instrumentation_start_date,
      reporting_period: range,
      data_freshness: { data_as_of: dataAsOf, status: dataAsOf ? "observed" : "unavailable" },
      identity_requirements: definition.identity_requirements,
      known_coverage_gaps: definition.known_coverage_gaps,
      privacy_classification: definition.privacy_classification,
      export_eligibility: definition.export_eligibility,
      reliability_status: status,
      reliability_label: HUMAN_STATUS[status] || HUMAN_STATUS.unavailable,
      reliability_reason: confidenceEntry.reason,
      investor_headline_eligible: status === "verified",
      investor_qualified_eligible: qualified,
      interpretation: definition.interpretation,
    }];
  }));

  return {
    version: DATA_READINESS_VERSION,
    metrics,
    quality_dimensions: qualityDimensions(dashboard, confidence),
    policy: {
      verified: "May support primary conclusions with normal definition and period context.",
      partial: "May appear only with an obvious limitation that does not invalidate the conclusion.",
      delayed: "Must disclose the delayed cutoff and avoid current-period claims.",
      under_investigation: "Must not support an unqualified growth or demand headline.",
      unavailable: "Must be omitted or shown as unavailable; never replaced with zero.",
    },
  };
}
