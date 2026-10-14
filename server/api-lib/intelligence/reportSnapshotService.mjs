import { createHash } from "node:crypto";
import { INVESTOR_METRIC_CATALOG_VERSION, investorMetricCatalogForClient } from "./investorMetricCatalog.mjs";
import { buildRevenueIntelligence } from "./revenueIntelligenceService.mjs";
import { buildMetricConfidence } from "./metricConfidence.mjs";

export const REPORT_CONTRACT_VERSION = "explore-intelligence-report-v2";
export const MIN_INVESTOR_COHORT = 5;

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function deltaFor(dashboard, key) {
  const value = dashboard?.comparison?.deltas?.[key];
  if (!value) return null;
  return {
    current: finite(value.current),
    previous: finite(value.previous),
    absolute: finite(value.absolute),
    percent: finite(value.percent),
  };
}

function safeRows(rows, countKey = "count", limit = 8) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => finite(row?.[countKey]) == null || row[countKey] >= MIN_INVESTOR_COHORT)
    .slice(0, limit)
    .map((row) => ({
      label: String(row.label || row.category || "Unlabeled").slice(0, 80),
      count: finite(row[countKey]),
      share_pct: finite(row.share_pct),
      growth_pct: finite(row.growth_pct),
      demand_index: finite(row.demand_index),
      opportunity_score: finite(row.opportunity_score),
    }));
}

function cleanText(value, max = 240) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function buildInvestorSafeSnapshot(dashboard, options = {}) {
  const revenue = buildRevenueIntelligence(dashboard, options.env);
  const metricConfidence = buildMetricConfidence(dashboard, revenue);
  const snapshot = {
    contract_version: REPORT_CONTRACT_VERSION,
    core_version: dashboard.core_version,
    metric_catalog_version: INVESTOR_METRIC_CATALOG_VERSION,
    classification: options.classification || "investor_safe",
    generated_by: options.generatedBy || { role: "admin", actor_ref: "not-recorded" },
    generated_at: options.generatedAt || new Date().toISOString(),
    timezone: "UTC",
    data_cutoff: dashboard.data_as_of || null,
    reporting_window: dashboard.range,
    data_as_of: dashboard.data_as_of || null,
    range: dashboard.range,
    filters: {
      country: dashboard.filters?.country || null,
      region: dashboard.filters?.region || null,
      city: dashboard.filters?.city || null,
      category: dashboard.filters?.category || null,
      platform: dashboard.filters?.platform || null,
      source: dashboard.filters?.source || null,
    },
    state: dashboard.state,
    headline: {
      active_users: finite(dashboard.kpis?.active_users),
      sessions: finite(dashboard.kpis?.sessions),
      route_starts: finite(dashboard.kpis?.route_starts),
      commercial_actions: finite(dashboard.kpis?.commercial_actions ?? dashboard.kpis?.commercial_intent),
      demand_index: finite(dashboard.demand_index?.score),
      verified_revenue: null,
    },
    metric_confidence: metricConfidence,
    comparison: {
      mode: dashboard.comparison?.mode || "none",
      period: dashboard.comparison?.previous_period || null,
      deltas: {
        active_users: deltaFor(dashboard, "active_users"),
        sessions: deltaFor(dashboard, "sessions"),
        route_starts: deltaFor(dashboard, "route_starts"),
        commercial_actions: deltaFor(dashboard, "commercial_actions") || deltaFor(dashboard, "commercial_intent"),
      },
    },
    narrative: {
      market: cleanText(dashboard.executive_summary?.market || "Global", 80),
      summary: cleanText(dashboard.executive_summary?.text, 420),
      statements: (dashboard.executive_summary?.statements || []).slice(0, 4).map((item) => cleanText(item, 220)),
    },
    claim_categories: {
      verified_observations: "Headline metrics are direct canonical observations subject to the attached confidence status.",
      business_interpretation: "Narrative and insights interpret observed behavior; they are not audited financial conclusions.",
      scenarios: "Opportunities are planning scenarios and do not constitute forecasts or commitments.",
    },
    trends: (dashboard.timeseries || []).slice(-31).map((point) => ({
      date: cleanText(point.date || point.period || point.label, 32),
      users: finite(point.users),
      sessions: finite(point.sessions),
      route_starts: finite(point.route_starts),
      commercial_actions: finite(point.commercial_actions),
    })),
    markets: safeRows(dashboard.geography?.children, "events"),
    categories: safeRows(dashboard.categories, "count"),
    opportunities: (dashboard.opportunities?.cards || []).slice(0, 5).map((item) => ({
      title: cleanText(item.title, 100),
      evidence: cleanText(item.evidence, 240),
      opportunity: cleanText(item.opportunity, 240),
      confidence: cleanText(item.confidence, 24),
    })),
    insights: (dashboard.insights || []).filter((item) => item.sample_size == null || item.sample_size >= MIN_INVESTOR_COHORT).slice(0, 6).map((item) => ({
      title: cleanText(item.title, 100),
      evidence: cleanText(item.evidence, 240),
      consideration: cleanText(item.consideration, 240),
      confidence: cleanText(item.confidence, 24),
    })),
    revenue,
    data_quality: {
      status: dashboard.data_quality?.status || "unknown",
      valid_events: finite(dashboard.data_quality?.valid_events),
      destination_geo_coverage_pct: finite(dashboard.data_quality?.destination_geo_coverage_pct),
      validity_view_active: Boolean(dashboard.data_quality?.validity_view_active),
      rejected_events_in_range: finite(dashboard.data_quality?.rejected_events_in_range),
      rejection_coverage_pct: finite(dashboard.data_quality?.rejection_coverage_pct),
      rejection_coverage_note: cleanText(dashboard.data_quality?.rejection_coverage_note, 300),
      warnings: (dashboard.warnings || []).slice(0, 8).map((item) => ({
        code: cleanText(item.code, 60),
        severity: cleanText(item.severity, 20),
        message: cleanText(item.message, 220),
      })),
    },
    methodology: {
      metric_catalog: investorMetricCatalogForClient(),
      privacy: `Aggregated investor-safe output; cohorts below ${MIN_INVESTOR_COHORT} are suppressed. Search text and user-level identifiers are excluded.`,
      revenue: "Only reconciled values from authorized financial sources qualify as revenue. Commercial actions remain intent signals.",
    },
  };

  const canonical = JSON.stringify(snapshot);
  return {
    ...snapshot,
    fingerprint: createHash("sha256").update(canonical).digest("hex").slice(0, 24),
  };
}
