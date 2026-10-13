import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ADMIN_METRIC_REGISTRY, type MetricDataState } from "@/features/admin/analytics/metricRegistry";
import { ChartDataTable } from "@/features/admin/components/analytics/ChartDataTable";
import { TimeRangeSelector, type ExecutiveRange } from "@/features/admin/components/analytics/TimeRangeSelector";
import { EmptyState, ErrorState } from "@/features/admin/components/AdminPrimitives";
import { ChartCard } from "@/features/admin/components/charts/ChartCard";
import { HorizontalBarChart } from "@/features/admin/components/charts/HorizontalBarChart";
import { KpiTrendCard, type KpiDelta } from "@/features/admin/components/charts/KpiTrendCard";
import { LineTrendChart } from "@/features/admin/components/charts/LineTrendChart";
import { chartColors } from "@/features/admin/components/charts/chartTheme";
import {
  fetchAnalyticsHealth,
  getBusinessIntelligenceDashboard,
  type BusinessIntelDashboard,
  type BusinessIntelParams,
} from "@/lib/adminAnalyticsApi";
import { formatNumber, formatPercent, formatRangeLabel } from "@/lib/analyticsDisplay";
import type { AdminOpsSummary, AdminReport } from "@/lib/moderationAdminApi";

type HealthResponse = Awaited<ReturnType<typeof fetchAnalyticsHealth>>;
type ChartMetric = "active_users" | "sessions" | "route_starts";

const CHART_METRICS: Array<{ key: ChartMetric; label: string }> = [
  { key: "active_users", label: "Active users" },
  { key: "sessions", label: "Sessions" },
  { key: "route_starts", label: "Route starts" },
];

const VALID_RANGES = new Set<ExecutiveRange>(["24h", "7d", "30d", "90d", "custom"]);

export function ExecutiveOverview({
  operations,
  pendingReports,
  operationsLoading,
  onRefreshOperations,
}: {
  operations: AdminOpsSummary | null;
  pendingReports: AdminReport[];
  operationsLoading: boolean;
  onRefreshOperations?: () => Promise<void>;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [dashboard, setDashboard] = useState<BusinessIntelDashboard | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<ChartMetric>("active_users");

  const range = readRange(searchParams.get("range"));
  const compare = searchParams.get("compare") !== "none";
  const customEnd = validDay(searchParams.get("end")) || todayUtc();
  const customStart = validDay(searchParams.get("start")) || addUtcDays(customEnd, -6);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local timezone";
  const hasRangeParam = searchParams.has("range");
  const hasCompareParam = searchParams.has("compare");

  useEffect(() => {
    if (hasRangeParam && hasCompareParam) return;
    const next = new URLSearchParams(window.location.search);
    if (!hasRangeParam) next.set("range", range);
    if (!hasCompareParam) next.set("compare", compare ? "previous" : "none");
    setSearchParams(next, { replace: true });
  }, [compare, hasCompareParam, hasRangeParam, range, setSearchParams]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    const params: BusinessIntelParams = {
      compare: compare ? "previous" : "none",
      granularity: range === "90d" ? "weekly" : "daily",
      signal,
    };
    if (range === "custom") {
      params.date_from = customStart;
      params.date_to = customEnd;
    } else {
      params.range = range;
    }

    const [dashboardResult, healthResult] = await Promise.allSettled([
      getBusinessIntelligenceDashboard(params),
      fetchAnalyticsHealth(signal),
    ]);
    if (signal?.aborted) return;

    setDashboard(dashboardResult.status === "fulfilled" ? dashboardResult.value : null);
    setHealth(healthResult.status === "fulfilled" ? healthResult.value : null);
    if (dashboardResult.status === "rejected") {
      setError(
        healthResult.status === "rejected"
          ? "Executive analytics and telemetry health are temporarily unavailable. Operational data remains visible."
          : "Executive analytics are unavailable for the selected reporting period. Telemetry health remains visible below.",
      );
    }
    setLoading(false);
  }, [compare, customEnd, customStart, range]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("admin:refresh", refresh);
    return () => window.removeEventListener("admin:refresh", refresh);
  }, [load]);

  const metricState = useMemo(() => resolveMetricState(dashboard), [dashboard]);
  const periodLabel = formatRangeLabel(dashboard?.range.start, dashboard?.range.end, range);
  const dataThrough = dashboard?.data_as_of || health?.health.last_successful_received_at || null;
  const deltas = dashboard?.comparison?.deltas || {};
  const kpis = dashboard?.kpis || {};

  const activitySeries = useMemo(
    () => (dashboard?.timeseries || []).map((point) => ({
      ...point,
      period: String(point.period || point.date || ""),
      active_users: numberOrZero(point.users),
      sessions: numberOrZero(point.sessions),
      route_starts: numberOrZero(point.route_starts),
      previous_active_users: numberOrZero(point.previous_users),
      previous_sessions: numberOrZero(point.previous_sessions),
      previous_route_starts: numberOrZero(point.previous_route_starts),
    })),
    [dashboard?.timeseries],
  );

  const adoption = useMemo(
    () => [
      { label: "Place views", value: numberOrZero(kpis.place_views) },
      { label: "Saved places", value: numberOrZero(kpis.place_saves ?? kpis.saves) },
      { label: "Route starts", value: numberOrZero(kpis.route_starts) },
      { label: "Commercial actions", value: numberOrZero(kpis.commercial_actions ?? kpis.commercial_intent) },
    ],
    [kpis],
  );

  const operationalIssues = useMemo(
    () => buildOperationalIssues({ operations, pendingReports, health, dashboard, healthUnavailable: !loading && !health }),
    [dashboard, health, loading, operations, pendingReports],
  );

  const contextualHref = useCallback((pathname: string, tab?: string) => {
    const query = new URLSearchParams();
    if (range !== "custom") query.set("range", range);
    if (tab) query.set("tab", tab);
    return `${pathname}?${query.toString()}`;
  }, [range]);

  function updateParams(mutator: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(window.location.search);
    mutator(next);
    setSearchParams(next);
  }

  function handleRangeChange(nextRange: ExecutiveRange) {
    updateParams((next) => {
      next.set("range", nextRange);
      if (nextRange === "custom") {
        next.set("start", customStart);
        next.set("end", customEnd);
      } else {
        next.delete("start");
        next.delete("end");
      }
    });
  }

  async function handleRefresh() {
    await Promise.allSettled([load(), onRefreshOperations?.() || Promise.resolve()]);
  }

  const selectedMetric = CHART_METRICS.find((item) => item.key === chartMetric) || CHART_METRICS[0];
  const chartSeries = [
    { key: chartMetric, label: selectedMetric.label, color: chartColors.primary },
    ...(compare && dashboard?.comparison
      ? [{ key: `previous_${chartMetric}`, label: "Previous period", color: chartColors.slate, strokeDasharray: "5 5" }]
      : []),
  ];
  const growthInsight = deterministicGrowthInsight(dashboard);

  return (
    <div className="admin-executive admin-executive--v3" aria-busy={loading || operationsLoading}>
      <TimeRangeSelector
        range={range}
        customStart={customStart}
        customEnd={customEnd}
        compare={compare}
        timezone={timezone}
        lastUpdated={dataThrough}
        loading={loading || operationsLoading}
        onRangeChange={handleRangeChange}
        onCustomStartChange={(value) => updateParams((next) => { next.set("range", "custom"); next.set("start", value); })}
        onCustomEndChange={(value) => updateParams((next) => { next.set("range", "custom"); next.set("end", value); })}
        onCompareChange={(enabled) => updateParams((next) => next.set("compare", enabled ? "previous" : "none"))}
        onRefresh={() => void handleRefresh()}
      />

      {error ? <ErrorState title="Analytics unavailable" message={error} onRetry={() => void handleRefresh()} /> : null}

      <section className="admin-executive__kpis" aria-label="Executive key performance indicators">
        <KpiTrendCard
          metricKey="active_users"
          value={kpis.active_users}
          delta={asDelta(deltas.active_users)}
          periodLabel={range}
          loading={loading}
          description={ADMIN_METRIC_REGISTRY.active_users.description}
          state={metricState}
          compact
          comparisonEnabled={compare}
          to={contextualHref("/admin/analytics/data", "growth")}
        />
        <KpiTrendCard
          metricKey="sessions"
          value={kpis.sessions}
          delta={asDelta(deltas.sessions)}
          periodLabel={range}
          loading={loading}
          description={ADMIN_METRIC_REGISTRY.sessions.description}
          state={metricState}
          compact
          comparisonEnabled={compare}
          to={contextualHref("/admin/analytics/data", "growth")}
        />
        <KpiTrendCard
          metricKey="route_starts"
          value={kpis.route_starts}
          delta={asDelta(deltas.route_starts)}
          periodLabel={range}
          loading={loading}
          description={ADMIN_METRIC_REGISTRY.route_starts.description}
          state={metricState}
          compact
          comparisonEnabled={compare}
          to={contextualHref("/admin/analytics/data", "overview")}
        />
        <KpiTrendCard
          metricKey="commercial_actions"
          value={kpis.commercial_actions ?? kpis.commercial_intent}
          delta={asDelta(deltas.commercial_actions ?? deltas.commercial_intent)}
          periodLabel={range}
          loading={loading}
          description={ADMIN_METRIC_REGISTRY.commercial_actions.description}
          state={metricState}
          compact
          comparisonEnabled={compare}
          to={contextualHref("/admin/analytics/business", "demand")}
        />
      </section>

      <ChartCard
        title="Product activity"
        subtitle={`${periodLabel} · canonical normalized events`}
        insight={growthInsight}
        loading={loading}
        empty={!activitySeries.length}
        className="admin-executive__activity"
        actions={(
          <div className="admin-chart-metric-selector" aria-label="Product activity metric">
            {CHART_METRICS.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={chartMetric === item.key}
                className={chartMetric === item.key ? "is-active" : undefined}
                onClick={() => setChartMetric(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      >
        <LineTrendChart
          data={activitySeries}
          series={chartSeries}
          xKey="period"
          height={330}
          ariaLabel={`${selectedMetric.label} over the selected reporting period`}
        />
        <ChartDataTable
          caption={`${selectedMetric.label} by reporting period`}
          rows={activitySeries}
          columns={[
            { key: "period", label: "Period", format: "date" },
            { key: chartMetric, label: selectedMetric.label, format: "number" },
            ...(compare && dashboard?.comparison
              ? [{ key: `previous_${chartMetric}`, label: "Previous period", format: "number" as const }]
              : []),
          ]}
        />
      </ChartCard>

      <div className="admin-executive__secondary-grid">
        <ChartCard
          title="Engagement & feature adoption"
          subtitle="Observed product actions in the selected period"
          insight="Counts are event totals from the same normalized analytics scope; they are not unique-user conversion rates."
          loading={loading}
          empty={!dashboard || dashboard.state === "zero"}
        >
          <HorizontalBarChart
            data={adoption}
            valueLabel="Observed actions"
            color={chartColors.secondary}
            height={250}
            ariaLabel="Observed engagement and feature adoption actions"
          />
        </ChartCard>

        <section className="admin-panel admin-executive__growth-retention" aria-labelledby="growth-retention-title">
          <header className="admin-panel__header">
            <div>
              <p className="admin-panel__kicker">Growth & retention</p>
              <h3 id="growth-retention-title">Period-over-period signals</h3>
              <p>Growth uses equivalent UTC windows from the canonical analytics core.</p>
            </div>
          </header>
          <div className="admin-growth-signals">
            <GrowthSignal label="Active users" delta={asDelta(deltas.active_users)} />
            <GrowthSignal label="Sessions" delta={asDelta(deltas.sessions)} />
            <GrowthSignal label="Route starts" delta={asDelta(deltas.route_starts)} />
            <div className="admin-growth-signal admin-growth-signal--unavailable">
              <span>Returning-user retention</span>
              <strong>Unavailable</strong>
              <small>Stable cross-period identity cohorts are not exposed by this contract, so no retention rate is inferred.</small>
            </div>
          </div>
          <Link to={contextualHref("/admin/analytics/data", "growth")} className="admin-text-link">Open growth analytics →</Link>
        </section>
      </div>

      <section className="admin-panel admin-executive__operations" aria-labelledby="operational-attention-title">
        <header className="admin-panel__header">
          <div>
            <p className="admin-panel__kicker">Operations</p>
            <h3 id="operational-attention-title">Operational attention</h3>
          </div>
          <Link to="/admin/analytics" className="admin-text-link">Analytics health →</Link>
        </header>
        {operationalIssues.length ? (
          <div className="admin-executive__alerts">
            {operationalIssues.map((issue) => <ExecutiveAlert key={issue.label} {...issue} />)}
          </div>
        ) : (
          <p className="admin-operational-clear">
            <strong>All systems operational.</strong>
            <span>No actionable moderation, ingestion, freshness, or service exceptions were returned.</span>
          </p>
        )}
      </section>

      {!loading && !dashboard && !operations ? (
        <EmptyState title="No executive data available" message="The analytics and operations endpoints returned no usable data. Check System Health and retry." />
      ) : null}
    </div>
  );
}

function GrowthSignal({ label, delta }: { label: string; delta?: KpiDelta }) {
  const text = delta?.percent == null ? delta?.label || "No comparable baseline" : `${delta.percent > 0 ? "+" : ""}${delta.percent}%`;
  const tone = delta?.percent == null || delta.percent === 0 ? "neutral" : delta.percent > 0 ? "positive" : "negative";
  return (
    <div className={`admin-growth-signal admin-growth-signal--${tone}`}>
      <span>{label}</span>
      <strong>{text}</strong>
      <small>{delta ? `${formatNumber(delta.current)} current · ${formatNumber(delta.previous)} previous` : "Comparison data unavailable"}</small>
    </div>
  );
}

type OperationalIssue = {
  label: string;
  value: string;
  detail: string;
  severity: "critical" | "warning" | "neutral";
  to: string;
};

function buildOperationalIssues({
  operations,
  pendingReports,
  health,
  dashboard,
  healthUnavailable,
}: {
  operations: AdminOpsSummary | null;
  pendingReports: AdminReport[];
  health: HealthResponse | null;
  dashboard: BusinessIntelDashboard | null;
  healthUnavailable: boolean;
}) {
  const issues: OperationalIssue[] = [];
  const pending = operations?.moderation.pending;
  if (typeof pending === "number" && pending > 0) {
    issues.push({
      label: "Moderation queue",
      value: `${formatNumber(pending)} pending`,
      detail: pendingReports[0]?.created_at ? `Oldest loaded ${formatDateTime(pendingReports[0].created_at)}` : "Pending reports require review",
      severity: "warning",
      to: "/admin/reports?status=pending&sort=priority",
    });
  }

  const analytics = health?.health;
  if (healthUnavailable) {
    issues.push({
      label: "Telemetry health",
      value: "Status unavailable",
      detail: "The health endpoint did not return a current ingestion or freshness state.",
      severity: "warning",
      to: "/admin/analytics",
    });
  }
  if (analytics && analytics.dead_letters_last_24h > 0) {
    const rate = analytics.dead_letter_rate_24h;
    const reason = analytics.rejection_reasons?.[0]?.value;
    issues.push({
      label: "Analytics ingestion",
      value: `${formatNumber(analytics.dead_letters_last_24h)} rejected in 24h`,
      detail: `${rate == null ? "Rate unavailable" : `${formatPercent(rate)} rejection rate`}${reason ? ` · Top reason: ${reason}` : ""}`,
      severity: analytics.status === "critical" ? "critical" : "warning",
      to: "/admin/analytics",
    });
  }

  const freshness = analytics?.aggregation_freshness;
  if (freshness && !freshness.is_today_aggregated && !freshness.is_yesterday_aggregated) {
    issues.push({
      label: "Analytics freshness",
      value: "Aggregation delayed",
      detail: `Latest aggregate ${analytics.latest_aggregation_day || "unavailable"}`,
      severity: "warning",
      to: "/admin/analytics",
    });
  }

  if (dashboard?.data_quality.status === "degraded" || dashboard?.warnings?.some((item) => item.severity === "critical")) {
    issues.push({
      label: "Data quality",
      value: "Coverage is partial",
      detail: dashboard.warnings?.[0]?.message || "The normalized analytics source reported degraded coverage.",
      severity: "critical",
      to: "/admin/analytics",
    });
  }

  const servicesHealthy = operations
    ? operations.health.api_connected && operations.health.supabase_configured && operations.health.admin_authorized
    : true;
  if (!servicesHealthy) {
    issues.push({
      label: "Service connectivity",
      value: "Check system health",
      detail: "One or more required admin services did not report a healthy state.",
      severity: "critical",
      to: "/admin?section=system",
    });
  }

  return issues.slice(0, 4);
}

function ExecutiveAlert({ label, value, detail, severity, to }: OperationalIssue) {
  return (
    <Link className={`admin-executive-alert admin-executive-alert--${severity}`} to={to}>
      <span aria-hidden="true" />
      <div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div>
      <b aria-hidden="true">→</b>
    </Link>
  );
}

function deterministicGrowthInsight(dashboard: BusinessIntelDashboard | null) {
  if (!dashboard?.comparison) return null;
  const delta = asDelta(dashboard.comparison.deltas.active_users);
  if (!delta || delta.percent == null || Math.abs(delta.percent) < 0.1 || Number(delta.current || 0) < 10) return null;
  const direction = delta.percent > 0 ? "increased" : "decreased";
  return `Active users ${direction} ${Math.abs(delta.percent)}% versus the preceding equivalent period.`;
}

function resolveMetricState(dashboard: BusinessIntelDashboard | null): MetricDataState {
  if (!dashboard) return "error";
  if (dashboard.state === "processing") return "delayed";
  if (dashboard.state === "zero") return "empty";
  if (dashboard.data_quality.status === "degraded") return "partial";
  if (dashboard.warnings?.some((item) => ["events_truncated", "analytics_validity_view_missing"].includes(item.code))) return "partial";
  return "available";
}

function asDelta(value: unknown): KpiDelta | undefined {
  if (!value || typeof value !== "object") return undefined;
  const delta = value as Partial<KpiDelta>;
  if (typeof delta.absolute !== "number") return undefined;
  return {
    current: typeof delta.current === "number" ? delta.current : undefined,
    previous: typeof delta.previous === "number" ? delta.previous : undefined,
    absolute: delta.absolute,
    percent: typeof delta.percent === "number" ? delta.percent : null,
    label: typeof delta.label === "string" ? delta.label : null,
  };
}

function readRange(value: string | null): ExecutiveRange {
  return value && VALID_RANGES.has(value as ExecutiveRange) ? value as ExecutiveRange : "7d";
}

function validDay(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function addUtcDays(day: string, delta: number) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function numberOrZero(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}
