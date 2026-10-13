import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, StatusBadge } from "@/features/admin/components/AdminPrimitives";
import { AreaTrendChart } from "@/features/admin/components/charts/AreaTrendChart";
import { ChartCard } from "@/features/admin/components/charts/ChartCard";
import { FunnelChart, type FunnelDatum } from "@/features/admin/components/charts/FunnelChart";
import { HorizontalBarChart } from "@/features/admin/components/charts/HorizontalBarChart";
import { KpiTrendCard, type KpiDelta } from "@/features/admin/components/charts/KpiTrendCard";
import { chartColors } from "@/features/admin/components/charts/chartTheme";
import {
  getBusinessFunnel,
  getBusinessGrowth,
  getBusinessLocations,
  getBusinessOverview,
  type BusinessRangePreset,
} from "@/lib/adminAnalyticsApi";
import { formatNumber, formatRangeLabel } from "@/lib/analyticsDisplay";
import type { AdminOpsSummary, AdminReport } from "@/lib/moderationAdminApi";

type OverviewData = Awaited<ReturnType<typeof getBusinessOverview>>;
type GrowthData = Awaited<ReturnType<typeof getBusinessGrowth>>;
type FunnelData = Awaited<ReturnType<typeof getBusinessFunnel>>;
type LocationData = Awaited<ReturnType<typeof getBusinessLocations>>;

type ExecutiveData = {
  overview: OverviewData | null;
  growth: GrowthData | null;
  funnel: FunnelData | null;
  locations: LocationData | null;
};

const RANGE_OPTIONS: Array<{ value: BusinessRangePreset; label: string }> = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

const EMPTY_DATA: ExecutiveData = { overview: null, growth: null, funnel: null, locations: null };

function metric(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function uniqueWarnings(data: ExecutiveData) {
  const warnings = [data.overview, data.growth, data.funnel, data.locations]
    .flatMap((item) => item?.warnings || [])
    .filter((item, index, items) => items.findIndex((candidate) => candidate.code === item.code) === index);
  return warnings;
}

function loadResult<T>(result: PromiseSettledResult<T>) {
  return result.status === "fulfilled" ? result.value : null;
}

export function ExecutiveOverview({
  operations,
  pendingReports,
  operationsLoading,
}: {
  operations: AdminOpsSummary | null;
  pendingReports: AdminReport[];
  operationsLoading: boolean;
}) {
  const [range, setRange] = useState<BusinessRangePreset>("7d");
  const [data, setData] = useState<ExecutiveData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    const params = { range, compare: "previous" as const, signal };
    const results = await Promise.allSettled([
      getBusinessOverview(params),
      getBusinessGrowth(params),
      getBusinessFunnel(params),
      getBusinessLocations(params),
    ]);
    if (signal?.aborted) return;

    const next: ExecutiveData = {
      overview: loadResult(results[0]),
      growth: loadResult(results[1]),
      funnel: loadResult(results[2]),
      locations: loadResult(results[3]),
    };
    setData(next);
    setLoading(false);
    setLastUpdated(new Date().toISOString());
    if (results.every((result) => result.status === "rejected")) {
      setError("Executive analytics are unavailable. Operational data remains visible below.");
    }
  }, [range]);

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

  const summary = data.overview?.summary;
  const deltas = (data.overview?.comparison?.deltas || {}) as Record<string, KpiDelta>;
  const warnings = useMemo(() => uniqueWarnings(data), [data]);
  const periodLabel = formatRangeLabel(data.overview?.range.start, data.overview?.range.end, range);
  const series = useMemo(
    () =>
      (data.growth?.series || []).map((point) => ({
        ...point,
        active_users_estimate:
          Number(point.active_anonymous_ids || 0) + Number(point.active_authenticated_users || 0),
        active_sessions: Number(point.sessions || 0),
      })),
    [data.growth?.series],
  );
  const funnel = useMemo<FunnelDatum[]>(
    () =>
      (data.funnel?.funnel || []).map((step) => ({
        key: step.key,
        label: step.label,
        value: step.count,
        sessions: step.unique_sessions,
        dropoff: step.dropoff_pct,
      })),
    [data.funnel?.funnel],
  );
  const markets = useMemo(
    () =>
      (data.locations?.countries || [])
        .slice(0, 6)
        .map((row) => ({ label: String(row.country || "Unknown"), value: Number(row.events || 0) })),
    [data.locations?.countries],
  );

  const servicesHealthy = Boolean(
    operations?.health.api_connected && operations.health.supabase_configured && operations.health.admin_authorized,
  );
  const pendingCount = operations?.moderation.pending;
  const deadLetters = metric(summary, "dead_letters_total");
  const attentionCount =
    (servicesHealthy ? 0 : 1) +
    (typeof pendingCount === "number" && pendingCount > 0 ? 1 : 0) +
    (deadLetters && deadLetters > 0 ? 1 : 0) +
    warnings.filter((warning) => warning.severity === "critical" || warning.severity === "warning").length;

  return (
    <div className="admin-executive" aria-busy={loading || operationsLoading}>
      <section className="admin-executive__hero">
        <div>
          <p className="admin-eyebrow">Explore pulse</p>
          <h2>{attentionCount ? `${attentionCount} signal${attentionCount === 1 ? "" : "s"} need attention` : "Explore is operating normally"}</h2>
          <p>
            A decision-ready view of product usage, traveler intent, market demand, and operational health.
          </p>
        </div>
        <div className="admin-executive__period">
          <span>Reporting period</span>
          <div className="admin-segmented" aria-label="Executive reporting period">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={range === option.value ? "is-active" : undefined}
                aria-pressed={range === option.value}
                onClick={() => setRange(option.value)}
              >
                {option.label.replace(" hours", "h").replace(" days", "d")}
              </button>
            ))}
          </div>
          <small>{lastUpdated ? `Updated ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(lastUpdated))}` : "Waiting for analytics"}</small>
        </div>
      </section>

      {error ? <ErrorState title="Analytics unavailable" message={error} onRetry={() => void load()} /> : null}

      <section className="admin-executive__kpis" aria-label="Executive key performance indicators">
        <KpiTrendCard metricKey="active_users_estimate" value={metric(summary, "active_users_estimate")} delta={deltas.active_users_estimate} periodLabel={range} loading={loading} sparkline={series} />
        <KpiTrendCard metricKey="active_sessions" value={metric(summary, "active_sessions")} delta={deltas.active_sessions} periodLabel={range} loading={loading} sparkline={series} />
        <KpiTrendCard metricKey="app_opens" value={metric(summary, "app_opens")} delta={deltas.app_opens} periodLabel={range} loading={loading} sparkline={series} />
        <KpiTrendCard metricKey="place_views" value={metric(summary, "place_views")} periodLabel={range} loading={loading} />
        <KpiTrendCard metricKey="route_starts" value={metric(summary, "route_starts")} periodLabel={range} loading={loading} />
        <KpiTrendCard metricKey="commercial_actions" value={metric(summary, "place_commerce_actions")} periodLabel={range} loading={loading} />
      </section>

      <div className="admin-executive__primary-grid">
        <ChartCard
          title="Growth and product activity"
          subtitle={`${periodLabel} · observed users, sessions, and app opens`}
          insight={series.length ? "Observed activity by day; active users combine distinct authenticated and anonymous identifiers without equating them to registered profiles." : null}
          loading={loading}
          empty={!series.length}
          className="admin-executive__growth"
        >
          <AreaTrendChart
            data={series}
            series={[
              { key: "active_users_estimate", label: "Active users", color: chartColors.primary },
              { key: "active_sessions", label: "Sessions", color: chartColors.secondary },
              { key: "app_opens", label: "App opens", color: chartColors.positive },
            ]}
            height={320}
            ariaLabel="Daily active users, sessions, and app opens"
          />
        </ChartCard>

        <section className="admin-executive__operations admin-panel">
          <header className="admin-panel__header">
            <div><p className="admin-panel__kicker">Operations</p><h3>Needs attention</h3></div>
            <StatusBadge label={servicesHealthy ? "Services online" : "Check services"} tone={servicesHealthy ? "green" : "red"} />
          </header>
          <div className="admin-executive__alerts">
            <ExecutiveAlert
              label="Moderation queue"
              value={typeof pendingCount === "number" ? formatNumber(pendingCount) : "Data unavailable"}
              detail={pendingCount ? "Pending reports require review" : pendingCount === 0 ? "Queue is clear" : "Operations summary did not return a count"}
              tone={pendingCount ? "warning" : pendingCount === 0 ? "positive" : "neutral"}
              to="/admin/reports?status=pending&sort=priority"
            />
            <ExecutiveAlert
              label="Analytics ingestion"
              value={deadLetters == null ? "Data unavailable" : deadLetters === 0 ? "Healthy" : `${formatNumber(deadLetters)} rejected`}
              detail={warnings[0]?.message || "No high-priority tracking warning returned"}
              tone={deadLetters && deadLetters > 0 ? "warning" : deadLetters === 0 ? "positive" : "neutral"}
              to="/admin/analytics"
            />
            <ExecutiveAlert
              label="Data freshness"
              value={data.overview?.range.end || "Processing"}
              detail={data.overview?.request_id ? `Request ${data.overview.request_id.slice(0, 12)}` : "Request trace unavailable"}
              tone={data.overview ? "positive" : "neutral"}
              to="/admin?section=system"
            />
          </div>
        </section>
      </div>

      <div className="admin-executive__secondary-grid">
        <ChartCard
          title="Engagement journey"
          subtitle="Observed events by step; not a user-level conversion funnel"
          insight={funnel.length ? "Counts may represent different users or sessions. Session counts are shown alongside each step for interpretation." : null}
          loading={loading}
          empty={!funnel.length}
        >
          <FunnelChart data={funnel} />
        </ChartCard>

        <ChartCard
          title="Leading markets"
          subtitle="Privacy-safe country aggregation by tracked activity"
          loading={loading}
          empty={!markets.length}
          emptyTitle="Markets unavailable"
          emptyMessage="No country-level activity met the current data contract for this period."
        >
          <HorizontalBarChart data={markets} valueLabel="Events" color={chartColors.secondary} height={280} ariaLabel="Top markets by analytics events" />
        </ChartCard>
      </div>

      <section className="admin-executive__quick-links">
        <header>
          <div><p className="admin-eyebrow">Investigate</p><h3>Go deeper without losing context</h3></div>
          <span>{pendingReports.length ? `${pendingReports.length} oldest pending reports loaded` : "No pending preview loaded"}</span>
        </header>
        <div>
          <QuickLink to="/admin/analytics/data?tab=growth" title="Growth & engagement" detail="Sessions, journeys, content, search, and quality" />
          <QuickLink to="/admin/analytics/business?tab=demand" title="Markets & demand" detail="Demand index, geography, places, and opportunity evidence" />
          <QuickLink to="/admin/reports?status=pending&sort=priority" title="Moderation queue" detail="Review the oldest and highest-priority reports" />
          <QuickLink to="/admin/analytics" title="Analytics operations" detail="Inspect ingestion, rejected events, and aggregation status" />
        </div>
      </section>

      {!loading && !data.overview && !operations ? (
        <EmptyState title="No executive data available" message="The analytics and operations endpoints returned no usable data. Check System Health and retry." />
      ) : null}
    </div>
  );
}

function ExecutiveAlert({
  label,
  value,
  detail,
  tone,
  to,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "positive" | "warning" | "neutral";
  to: string;
}) {
  return (
    <Link className={`admin-executive-alert admin-executive-alert--${tone}`} to={to}>
      <span aria-hidden="true" />
      <div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div>
      <b aria-hidden="true">→</b>
    </Link>
  );
}

function QuickLink({ to, title, detail }: { to: string; title: string; detail: string }) {
  return (
    <Link to={to} className="admin-executive-link">
      <span><strong>{title}</strong><small>{detail}</small></span>
      <b aria-hidden="true">↗</b>
    </Link>
  );
}
