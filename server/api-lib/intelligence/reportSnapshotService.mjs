import { createHash } from "node:crypto";
import { INVESTOR_METRIC_CATALOG_VERSION, investorMetricCatalogForClient } from "./investorMetricCatalog.mjs";
import { buildRevenueIntelligence } from "./revenueIntelligenceService.mjs";
import { buildMetricConfidence } from "./metricConfidence.mjs";
import { buildDataReadiness } from "./dataReadiness.mjs";
import { buildReportNarrative } from "./reportNarrative.mjs";

export const REPORT_CONTRACT_VERSION = "explore-intelligence-report-v3";
export const MIN_INVESTOR_COHORT = 5;

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ratio(numerator, denominator) {
  const top = finite(numerator);
  const bottom = finite(denominator);
  if (top == null || bottom == null || bottom <= 0) return null;
  return Math.round((top / bottom) * 100) / 100;
}

function deltaFor(dashboard, key) {
  const value = dashboard?.comparison?.deltas?.[key];
  if (!value) return null;
  return {
    current: finite(value.current),
    previous: finite(value.previous),
    absolute: finite(value.absolute),
    percent: finite(value.percent),
    reliable: value.reliable == null ? finite(value.previous) != null && value.previous >= 8 : Boolean(value.reliable),
  };
}

function safeRows(rows, countKey = "count", limit = 12) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => finite(row?.[countKey]) == null || row[countKey] >= MIN_INVESTOR_COHORT)
    .slice(0, limit)
    .map((row) => ({
      label: cleanText(row.label || row.category || "Unlabeled", 80),
      count: finite(row[countKey]),
      share_pct: finite(row.share_pct),
      growth_pct: finite(row.growth_pct),
      demand_index: finite(row.demand_index),
      supply_index: finite(row.supply_index),
      opportunity_score: finite(row.opportunity_score),
      unit: "observed events",
    }));
}

function safeEntityRows(rows, kind, limit = 30) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const sample = Math.max(0, Number(row.views || 0), Number(row.starts || 0), Number(row.actions || row.commercial_actions || 0));
      if (sample < MIN_INVESTOR_COHORT) return null;
      return {
        type: kind,
        name: cleanText(kind === "route" ? row.route_name : row.place_name, 90),
        category: cleanText(row.category || "Uncategorized", 60),
        market: cleanText(row.location || row.area || "", 90) || null,
        views: finite(row.views),
        starts: kind === "route" ? finite(row.starts) : null,
        completions: kind === "route" ? finite(row.completes) : null,
        commercial_actions: finite(row.actions ?? row.commercial_actions),
        saves: finite(row.saves),
        trend_pct: finite(row.trend_pct),
        sample_size: sample,
        data_quality: cleanText(row.data_quality || "unknown", 30),
      };
    })
    .filter(Boolean)
    .slice(0, limit);
}

function cleanText(value, max = 240) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function trendSummary(trends) {
  const eligible = trends.filter((point) => finite(point.users) != null);
  if (!eligible.length) return { average_users: null, highest: null, lowest: null };
  const average = eligible.reduce((sum, point) => sum + point.users, 0) / eligible.length;
  let highest = eligible[0];
  let lowest = eligible[0];
  for (const point of eligible.slice(1)) {
    if (point.users > highest.users) highest = point;
    if (point.users < lowest.users) lowest = point;
  }
  return {
    average_users: Math.round(average * 10) / 10,
    highest: { date: highest.date, value: highest.users },
    lowest: { date: lowest.date, value: lowest.users },
  };
}

export function buildInvestorSafeSnapshot(dashboard, options = {}) {
  const revenue = options.revenue || buildRevenueIntelligence(dashboard, options.env);
  const metricConfidence = buildMetricConfidence(dashboard, revenue);
  const trends = (dashboard.timeseries || []).slice(-366).map((point) => ({
    date: cleanText(point.date || point.period || point.label, 32),
    users: finite(point.users),
    sessions: finite(point.sessions),
    place_views: finite(point.place_views),
    route_views: finite(point.route_views),
    route_starts: finite(point.route_starts),
    commercial_actions: finite(point.commercial_actions),
    previous_users: finite(point.previous_users),
    previous_sessions: finite(point.previous_sessions),
    previous_route_starts: finite(point.previous_route_starts),
  }));
  const headline = {
    active_users: finite(dashboard.kpis?.active_users),
    sessions: finite(dashboard.kpis?.sessions),
    place_views: finite(dashboard.kpis?.place_views),
    route_views: finite(dashboard.kpis?.route_views),
    route_starts: finite(dashboard.kpis?.route_starts),
    route_completions: finite(dashboard.kpis?.route_completions),
    commercial_actions: finite(dashboard.kpis?.commercial_actions ?? dashboard.kpis?.commercial_intent),
    searches: finite(dashboard.kpis?.searches),
    sessions_per_active_user: ratio(dashboard.kpis?.sessions, dashboard.kpis?.active_users),
    demand_index: finite(dashboard.demand_index?.score),
    verified_revenue: finite(revenue?.total_verified_revenue),
  };

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
    headline,
    metric_confidence: metricConfidence,
    comparison: {
      mode: dashboard.comparison?.mode || "none",
      period: dashboard.comparison?.previous_period || null,
      deltas: {
        active_users: deltaFor(dashboard, "active_users"),
        sessions: deltaFor(dashboard, "sessions"),
        place_views: deltaFor(dashboard, "place_views"),
        route_views: deltaFor(dashboard, "route_views"),
        route_starts: deltaFor(dashboard, "route_starts"),
        route_completions: deltaFor(dashboard, "route_completions"),
        commercial_actions: deltaFor(dashboard, "commercial_actions") || deltaFor(dashboard, "commercial_intent"),
        searches: deltaFor(dashboard, "searches"),
      },
    },
    narrative: {
      market: cleanText(dashboard.executive_summary?.market || "Global", 80),
      summary: cleanText(dashboard.executive_summary?.text, 520),
      statements: (dashboard.executive_summary?.statements || []).slice(0, 4).map((item) => cleanText(item, 260)),
    },
    claim_categories: {
      verified_observations: "Direct canonical observations may be used only with the attached per-metric confidence status.",
      business_interpretation: "Interpretations describe observed associations; they do not establish causality.",
      scenarios: "Recommended investigations are planning steps, not forecasts, commitments, or guaranteed outcomes.",
    },
    trends,
    trend_summary: trendSummary(trends),
    markets: safeRows(dashboard.geography?.children, "events"),
    categories: safeRows(dashboard.categories, "count"),
    places: safeEntityRows(dashboard.places, "place"),
    routes: safeEntityRows(dashboard.routes, "route"),
    opportunities: (dashboard.opportunities?.cards || []).slice(0, 6).map((item) => ({
      title: cleanText(item.title, 100),
      question: cleanText(item.question || "What should Explore investigate?", 180),
      finding: cleanText(item.finding || item.evidence, 260),
      evidence: cleanText(item.evidence, 260),
      business_implication: cleanText(item.business_implication || "The observation may warrant additional analysis.", 260),
      recommended_investigation: cleanText(item.recommended_investigation || item.opportunity, 260),
      limitation: cleanText(item.limitation || "The observation is descriptive and does not establish causality.", 260),
      confidence: cleanText(item.confidence, 24),
    })),
    insights: (dashboard.insights || [])
      .filter((item) => item.sample_size == null || item.sample_size >= MIN_INVESTOR_COHORT)
      .slice(0, 8)
      .map((item) => ({
        title: cleanText(item.title, 100),
        question: cleanText(item.question || "What changed?", 180),
        finding: cleanText(item.finding || item.title, 260),
        evidence: cleanText(item.evidence, 260),
        interpretation: cleanText(item.interpretation || item.consideration, 260),
        next_step: cleanText(item.next_step || item.consideration, 260),
        limitation: cleanText(item.limitation || "This observation does not establish causality.", 260),
        confidence: cleanText(item.confidence, 24),
        sample_size: finite(item.sample_size),
      })),
    revenue,
    data_quality: {
      status: dashboard.data_quality?.status || "unknown",
      valid_events: finite(dashboard.data_quality?.valid_events),
      destination_geo_coverage_pct: finite(dashboard.data_quality?.destination_geo_coverage_pct),
      place_resolution_pct: finite(dashboard.data_quality?.place_resolution_pct),
      route_resolution_pct: finite(dashboard.data_quality?.route_resolution_pct),
      validity_view_active: Boolean(dashboard.data_quality?.validity_view_active),
      rejected_events_in_range: finite(dashboard.data_quality?.rejected_events_in_range),
      rejection_coverage_pct: finite(dashboard.data_quality?.rejection_coverage_pct),
      rejection_coverage_note: cleanText(dashboard.data_quality?.rejection_coverage_note, 400),
      warnings: (dashboard.warnings || []).slice(0, 8).map((item) => ({
        code: cleanText(item.code, 60),
        severity: cleanText(item.severity, 20),
        message: cleanText(item.message, 240),
      })),
    },
    methodology: {
      metric_catalog: investorMetricCatalogForClient(),
      privacy: `Aggregated investor-safe output; named rankings require at least ${MIN_INVESTOR_COHORT} observed events. Search text and user-level identifiers are excluded.`,
      revenue: "Estimated earnings, finalized earnings, recognized revenue, and cash collections remain distinct. Only authorized reconciled values qualify as verified revenue.",
      comparison: "Equivalent UTC windows; percentages are suppressed when the comparison baseline is absent and qualified when samples are small.",
    },
  };

  snapshot.data_readiness = buildDataReadiness(dashboard, revenue, metricConfidence);
  snapshot.report_narrative = buildReportNarrative(snapshot, {
    classification: snapshot.classification,
    reportType: options.reportType,
  });
  const canonical = JSON.stringify(snapshot);
  return {
    ...snapshot,
    fingerprint: createHash("sha256").update(canonical).digest("hex").slice(0, 24),
  };
}
