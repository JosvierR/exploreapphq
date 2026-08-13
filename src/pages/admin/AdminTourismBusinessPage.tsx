import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, Fragment } from "react";
import { Link } from "react-router-dom";
import { AdminAuthGate } from "@/features/admin/components/AdminAuthGate";
import { AdminDataTable, AdminPageShell, EmptyState, ErrorState } from "@/features/admin/components/AdminPrimitives";
import { AreaTrendChart } from "@/features/admin/components/charts/AreaTrendChart";
import { ChartCard } from "@/features/admin/components/charts/ChartCard";
import { HorizontalBarChart } from "@/features/admin/components/charts/HorizontalBarChart";
import { chartColors } from "@/features/admin/components/charts/chartTheme";
import {
  type BusinessIntelCompare,
  type BusinessIntelDashboard,
  type BusinessIntelMapMetric,
  type BusinessIntelRange,
  getBusinessIntelligenceDashboard,
} from "@/lib/adminAnalyticsApi";
import { formatNumber, formatPercent, formatRangeLabel } from "@/lib/analyticsDisplay";
import { AdminApiError } from "@/lib/moderationAdminApi";
import { downloadCsv } from "@/lib/csvExport";

const TourismWorldMap = lazy(() =>
  import("@/features/admin/components/TourismWorldMap").then((mod) => ({ default: mod.TourismWorldMap })),
);

type GeoState = {
  country: string | null;
  region: string | null;
  city: string | null;
  neighborhood: string | null;
};

const RANGES: Array<{ value: BusinessIntelRange; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
];

const COMPARES: Array<{ value: BusinessIntelCompare; label: string }> = [
  { value: "previous", label: "Previous period" },
  { value: "previous_year", label: "Previous year" },
  { value: "none", label: "None" },
];

const MAP_METRICS: Array<{ value: BusinessIntelMapMetric; label: string }> = [
  { value: "demand", label: "Demand" },
  { value: "activity", label: "Activity" },
  { value: "users", label: "Users" },
  { value: "place_views", label: "Place views" },
  { value: "route_views", label: "Route views" },
  { value: "intent", label: "Intent" },
  { value: "saves", label: "Saves" },
  { value: "searches", label: "Searches" },
  { value: "growth", label: "Growth" },
  { value: "supply", label: "Supply" },
  { value: "opportunity", label: "Opportunity" },
];

const KPI_ORDER = [
  "active_users",
  "sessions",
  "place_discoveries",
  "place_views",
  "route_views",
  "route_starts",
  "saves",
  "commercial_intent",
] as const;

const KPI_LABELS: Record<string, string> = {
  active_users: "Active travelers",
  sessions: "Sessions",
  place_discoveries: "Place discoveries",
  place_views: "Place views",
  route_views: "Route views",
  route_starts: "Route starts",
  route_completions: "Route completions",
  saves: "Saves",
  commercial_intent: "Commercial intent",
};

const TREND_METRICS = [
  { value: "users", label: "Travelers" },
  { value: "sessions", label: "Sessions" },
  { value: "place_views", label: "Place views" },
  { value: "route_views", label: "Route views" },
  { value: "searches", label: "Searches" },
  { value: "saves", label: "Saves" },
  { value: "commercial_actions", label: "Intent actions" },
] as const;

/**
 * The dashboard has ~20 data sections. Showing them all in one long scroll is
 * overwhelming, so they're grouped into a small set of tabs. Grouping is
 * purely a display concern — every section, table, and chart below still
 * renders exactly the same data; only its visibility is gated by the active
 * tab. SECTION_TAB is also used to jump to the right tab when a "View
 * evidence" link references a section that lives in a different tab.
 */
type BiTab = "overview" | "geography" | "demand" | "places" | "audience" | "insights";

const BI_TABS: Array<{ value: BiTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "geography", label: "Geography" },
  { value: "demand", label: "Demand & intent" },
  { value: "places", label: "Places & routes" },
  { value: "audience", label: "Audience" },
  { value: "insights", label: "Insights & health" },
];

const SECTION_TAB: Record<string, BiTab> = {
  "executive-summary": "overview",
  "market-pulse": "overview",
  "demand-trend": "overview",
  movers: "overview",
  "geographic-intelligence": "geography",
  "market-comparison": "geography",
  "time-intelligence": "geography",
  "customer-intent": "demand",
  opportunities: "demand",
  "intent-funnel": "demand",
  places: "places",
  "business-performance": "places",
  routes: "places",
  "content-attribution": "places",
  audience: "audience",
  "discovery-attribution": "audience",
  "explore-insights": "insights",
  "analytics-health": "insights",
};

function Section({
  id,
  kicker,
  title,
  subtitle,
  action,
  children,
}: {
  id?: string;
  kicker: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="admin-executive-section">
      <header className="admin-executive-section__header">
        <div>
          <p>{kicker}</p>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
        {action ? <div>{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

function freshnessLabel(value?: string | null) {
  if (!value) return "Data freshness unavailable";
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60_000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `Updated ${hours}h ago`;
}

function DeltaText({ percent }: { percent: number | null | undefined }) {
  if (percent == null) return <small className="admin-bi-delta admin-bi-delta--flat">vs previous unavailable</small>;
  const up = percent > 0;
  const flat = percent === 0;
  return (
    <small className={`admin-bi-delta${flat ? " admin-bi-delta--flat" : up ? " admin-bi-delta--up" : " admin-bi-delta--down"}`}>
      {flat ? "→" : up ? "↑" : "↓"} {Math.abs(percent)}% vs previous
    </small>
  );
}

function MetricEmpty({ label }: { label: string }) {
  return (
    <div className="admin-bi-empty-metric">
      <strong>No {label} recorded</strong>
      <span>There isn&apos;t enough activity in this market during the selected period.</span>
    </div>
  );
}

export function AdminTourismBusinessPage() {
  return (
    <AdminAuthGate>
      <BusinessIntelligenceContent />
    </AdminAuthGate>
  );
}

function BusinessIntelligenceContent() {
  const [range, setRange] = useState<BusinessIntelRange>("30d");
  const [compare, setCompare] = useState<BusinessIntelCompare>("previous");
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily");
  const [trendMetric, setTrendMetric] = useState<(typeof TREND_METRICS)[number]["value"]>("place_views");
  const [mapMetric, setMapMetric] = useState<BusinessIntelMapMetric>("demand");
  const [category, setCategory] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoState>({ country: null, region: null, city: null, neighborhood: null });
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [data, setData] = useState<BusinessIntelDashboard | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Record<string, unknown> | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState<BiTab>("overview");
  const pendingScrollRef = useRef<string | null>(null);

  const query = useMemo(
    () => ({
      range,
      compare,
      granularity,
      map_metric: mapMetric,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      neighborhood: geo.neighborhood,
      category,
      platform,
      source,
    }),
    [range, compare, granularity, mapMetric, geo, category, platform, source],
  );

  const load = useCallback(
    (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      void getBusinessIntelligenceDashboard({ ...query, signal })
        .then((result) => {
          setData(result);
          setRequestId(result.request_id);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setLoading(false);
          setData(null);
          setError(err instanceof AdminApiError ? err.message : "Failed to load business intelligence.");
          setRequestId(err instanceof AdminApiError ? err.requestId ?? null : null);
        });
    },
    [query],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey]);

  // Runs after every tab switch so a cross-tab "View evidence" jump can land
  // once the target section has actually mounted in the new tab.
  useEffect(() => {
    if (!pendingScrollRef.current) return;
    const target = pendingScrollRef.current;
    pendingScrollRef.current = null;
    const frame = requestAnimationFrame(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab]);

  const jumpToAnchor = (anchor: string) => {
    const tab = SECTION_TAB[anchor];
    pendingScrollRef.current = anchor;
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    } else {
      // Already on the right tab — the section exists now, no tab-change re-render will fire.
      requestAnimationFrame(() => {
        document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      pendingScrollRef.current = null;
    }
  };

  const drillToChild = (child: { key: string; level: string }) => {
    setSelectedPlace(null);
    setSelectedRoute(null);
    if (child.level === "country") setGeo({ country: child.key, region: null, city: null, neighborhood: null });
    else if (child.level === "region") setGeo((prev) => ({ ...prev, region: child.key, city: null, neighborhood: null }));
    else if (child.level === "city") setGeo((prev) => ({ ...prev, city: child.key, neighborhood: null }));
    else if (child.level === "neighborhood") setGeo((prev) => ({ ...prev, neighborhood: child.key }));
  };

  const jumpBreadcrumb = (crumb: { level: string; key: string | null }) => {
    setSelectedPlace(null);
    setSelectedRoute(null);
    if (crumb.level === "global") setGeo({ country: null, region: null, city: null, neighborhood: null });
    else if (crumb.level === "country") setGeo({ country: crumb.key, region: null, city: null, neighborhood: null });
    else if (crumb.level === "region") setGeo((prev) => ({ country: prev.country, region: crumb.key, city: null, neighborhood: null }));
    else if (crumb.level === "city") setGeo((prev) => ({ ...prev, city: crumb.key, neighborhood: null }));
    else if (crumb.level === "neighborhood") setGeo((prev) => ({ ...prev, neighborhood: crumb.key }));
  };

  const periodLabel = formatRangeLabel(data?.range?.start, data?.range?.end, range);
  const geography = data?.geography;
  const marketChart =
    geography?.children.slice(0, 8).map((item) => ({
      label: item.label,
      value: item.metric,
    })) || [];
  const categoryChart =
    data?.categories.slice(0, 10).map((item) => ({
      label: `${item.category} — ${item.share_pct}%`,
      value: item.count,
    })) || [];
  const originChart =
    data?.traveler_origins.markets.slice(0, 8).map((item) => ({
      label: `${item.label} — ${item.share_pct}%`,
      value: item.events,
    })) || [];

  const peakMax = Math.max(
    1,
    ...Object.values(data?.peak_demand.matrix || {}).flatMap((row) => row),
  );

  return (
    <AdminPageShell
      eyebrow="Business"
      title="Business Intelligence"
      description="Geographic demand, commercial intent, and partner opportunities from Explore activity."
      compactHeader
      actions={
        <>
          <Link className="admin-btn admin-btn--ghost admin-btn--sm" to="/admin/analytics/data">
            App Data
          </Link>
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-btn--sm"
            disabled={!data}
            onClick={() =>
              downloadCsv(
                `explore-business-${range}-${data?.range.start || "report"}.csv`,
                KPI_ORDER.map((metric) => ({
                  market: data?.executive_summary.market,
                  period_start: data?.range.start,
                  period_end: data?.range.end,
                  metric,
                  value: data?.kpis[metric],
                  previous: data?.comparison?.deltas[metric]?.previous,
                  change_percent: data?.comparison?.deltas[metric]?.percent,
                  data_as_of: data?.data_as_of,
                })),
              )
            }
          >
            Export CSV
          </button>
          <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" disabled={!data} onClick={() => window.print()}>
            PDF report
          </button>
          <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => setRefreshKey((value) => value + 1)}>
            Refresh
          </button>
        </>
      }
    >
      <div className="admin-command-strip admin-bi-toolbar">
        <div className="admin-command-strip__period">
          <span>Geography</span>
          <strong>{geography?.breadcrumb.map((item) => item.label).join(" / ") || "Global"}</strong>
          <small>{periodLabel} · {freshnessLabel(data?.data_as_of)}</small>
        </div>
        <div className="admin-command-strip__filters">
          <label>
            <span>Range</span>
            <select value={range} onChange={(event) => setRange(event.target.value as BusinessIntelRange)}>
              {RANGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Compare to</span>
            <select value={compare} onChange={(event) => setCompare(event.target.value as BusinessIntelCompare)}>
              {COMPARES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Category</span>
            <select
              value={category || ""}
              onChange={(event) => setCategory(event.target.value || null)}
            >
              <option value="">All categories</option>
              {(data?.categories || []).map((item) => (
                <option key={item.category} value={item.category}>
                  {item.category}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Platform</span>
            <select value={platform || ""} onChange={(event) => setPlatform(event.target.value || null)}>
              <option value="">All platforms</option>
              <option value="ios">iOS</option>
              <option value="android">Android</option>
              <option value="web">Web</option>
              <option value="server">Server</option>
            </select>
          </label>
          <label>
            <span>Source</span>
            <select value={source || ""} onChange={(event) => setSource(event.target.value || null)}>
              <option value="">All sources</option>
              <option value="mobile">Mobile</option>
              <option value="web">Web</option>
              <option value="backend">Backend</option>
            </select>
          </label>
        </div>
      </div>

      {geography?.breadcrumb?.length ? (
        <nav className="admin-bi-breadcrumb" aria-label="Geography">
          {geography.breadcrumb.map((crumb, index) => (
            <button
              key={`${crumb.level}-${crumb.key || "global"}`}
              type="button"
              className={index === geography.breadcrumb.length - 1 ? "is-current" : undefined}
              onClick={() => jumpBreadcrumb(crumb)}
            >
              {crumb.label}
            </button>
          ))}
        </nav>
      ) : null}

      <nav className="admin-report-tabs admin-bi-tabs" aria-label="Business intelligence sections">
        {BI_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={activeTab === tab.value ? "is-active" : ""}
            aria-pressed={activeTab === tab.value}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {error ? (
        <ErrorState
          title="Business intelligence could not load"
          message={requestId ? `${error} Request ID ${requestId}.` : error}
          onRetry={() => setRefreshKey((value) => value + 1)}
        />
      ) : null}

      {(data?.warnings || []).slice(0, 3).map((warning) => (
        <aside key={warning.code} className="admin-insight-callout">
          <span className="admin-insight-callout__mark" aria-hidden="true" />
          <div>
            <strong>{warning.code}</strong>
            <p>{warning.message}</p>
          </div>
        </aside>
      ))}

      {activeTab === "overview" ? (
        <>
          <Section
            id="executive-summary"
            kicker="Executive summary"
            title={`${data?.executive_summary.market || "Market"} · ${periodLabel}`}
            subtitle="A deterministic interpretation of calculated metrics — no generated claims without evidence."
          >
            {loading ? (
              <div className="admin-skeleton admin-skeleton--block" aria-label="Loading executive summary" />
            ) : !data ? null : (
              <div className="admin-bi-summary-grid">
                <article className="admin-bi-summary-copy">
                  <p>{data.executive_summary.text}</p>
                  <small>Generated by verified rules · Core {data.core_version}</small>
                </article>
                <article className="admin-bi-index" title={data.metric_dictionary.metrics.demand_index?.description}>
                  <div>
                    <span>Explore Demand Index</span>
                    <strong>{data.demand_index.score == null ? "—" : data.demand_index.score}</strong>
                    <small>/ 100 · {data.demand_index.version}</small>
                  </div>
                  <dl>
                    <div><dt>Demand</dt><dd>{data.demand_index.demand}</dd></div>
                    <div><dt>Growth</dt><dd>{data.demand_index.growth}</dd></div>
                    <div><dt>Intent</dt><dd>{data.demand_index.intent}</dd></div>
                    <div><dt>Momentum</dt><dd>{data.demand_index.momentum}</dd></div>
                  </dl>
                  {data.demand_index.score == null ? (
                    <p>Need at least three signals with a reliable comparison baseline.</p>
                  ) : null}
                </article>
              </div>
            )}
          </Section>

          <Section id="market-pulse" kicker="Market pulse" title="What changed at a glance" subtitle="Canonical metrics for the selected geography and period, with comparison deltas.">
            <div className="admin-bi-kpi-grid">
              {KPI_ORDER.map((key) => {
                const value = data?.kpis?.[key];
                const delta = data?.comparison?.deltas?.[key];
                const canonicalKey = key === "active_users" ? "active_travelers" : key === "commercial_intent" ? "commercial_actions" : key;
                const definition = data?.metric_dictionary?.metrics?.[canonicalKey]?.description || data?.kpi_definitions?.[key];
                return (
                  <article key={key} className="admin-bi-kpi" title={definition || KPI_LABELS[key]}>
                    <span>{KPI_LABELS[key]}</span>
                    {loading ? (
                      <strong className="admin-skeleton admin-skeleton--number" aria-label="Loading" />
                    ) : value == null || value === 0 ? (
                      <MetricEmpty label={KPI_LABELS[key].toLowerCase()} />
                    ) : (
                      <>
                        <strong>{formatNumber(value)}</strong>
                        <DeltaText percent={delta?.percent} />
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </Section>

          <Section
            id="demand-trend"
            kicker="Demand trend"
            title="How demand is moving"
            subtitle="Users, place views, route views, and commercial actions over time."
            action={
              <div className="admin-bi-section-actions">
                <label className="admin-inline-field">
                  <span>Metric</span>
                  <select value={trendMetric} onChange={(event) => setTrendMetric(event.target.value as (typeof TREND_METRICS)[number]["value"])}>
                    {TREND_METRICS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="admin-inline-field">
                  <span>Grain</span>
                  <select value={granularity} onChange={(event) => setGranularity(event.target.value as "daily" | "weekly" | "monthly")}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
              </div>
            }
          >
            <ChartCard
              title="Demand trend"
              subtitle={`${granularity} · current vs ${compare === "none" ? "no comparison" : compare.replaceAll("_", " ")}`}
              loading={loading}
              empty={!data?.timeseries?.length}
              emptyTitle="No trend yet"
              emptyMessage="Timeseries appears after activity accumulates in the selected period."
            >
              <AreaTrendChart
                data={(data?.timeseries || []) as Array<Record<string, unknown>>}
                xKey="period"
                series={[
                  { key: trendMetric, label: TREND_METRICS.find((item) => item.value === trendMetric)?.label || trendMetric, color: chartColors.primary },
                  ...(compare === "none"
                    ? []
                    : [{ key: `previous_${trendMetric}`, label: "Comparison period", color: chartColors.secondary }]),
                ]}
                ariaLabel="Demand trend"
              />
            </ChartCard>
          </Section>

          <Section id="movers" kicker="Top movers" title="Rising and declining" subtitle="Requires ≥ previous volume threshold to avoid noisy percentages.">
            <div className="admin-tourism-inventory-grid">
              <div className="admin-panel">
                <h3>Rising</h3>
                {(data?.movers.rising || []).length ? (
                  <ul className="admin-bi-movers">
                    {data?.movers.rising.map((item) => (
                      <li key={`up-${item.type}-${item.label}`}>
                        ↑ {item.label} <strong>+{item.trend_pct}%</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No rising movers" message="Not enough prior-period volume to rank growth." />
                )}
              </div>
              <div className="admin-panel">
                <h3>Declining</h3>
                {(data?.movers.declining || []).length ? (
                  <ul className="admin-bi-movers">
                    {data?.movers.declining.map((item) => (
                      <li key={`down-${item.type}-${item.label}`}>
                        ↓ {item.label} <strong>{item.trend_pct}%</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No declining movers" message="Not enough prior-period volume to rank declines." />
                )}
              </div>
            </div>
          </Section>
        </>
      ) : null}

      {activeTab === "geography" ? (
        <>
          <Section
            id="geographic-intelligence"
            kicker="Travel demand"
            title="Where demand is happening"
            subtitle={`${geography?.child_label || "Markets"} for the current geography. Click the map or the list to drill down.`}
            action={
              <label className="admin-inline-field">
                <span>Map by</span>
                <select value={mapMetric} onChange={(event) => setMapMetric(event.target.value as BusinessIntelMapMetric)}>
                  {MAP_METRICS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            }
          >
            <div className="admin-tourism-map admin-tourism-map--hero">
              {loading ? (
                <div className="admin-tourism-map__loading" aria-label="Loading map" />
              ) : !geography?.children.length ? (
                <EmptyState
                  title="No geographic demand yet"
                  message={
                    geography?.missing_child_geo
                      ? `Events exist, but ${geography.child_label.toLowerCase()} metadata is missing for this filter.`
                      : "Country/region/city heat appears when analytics include market metadata."
                  }
                />
              ) : (
                <Suspense fallback={<div className="admin-tourism-map__loading" aria-label="Loading map" />}>
                  <TourismWorldMap
                    key={`${geo.country || "g"}-${geo.region || ""}-${geo.city || ""}-${geo.neighborhood || ""}-${mapMetric}-${geography.children.map((item) => item.key).join(",")}`}
                    zones={geography.children}
                    parentCountry={geo.country}
                    onSelect={(child) => drillToChild(child)}
                  />
                </Suspense>
              )}
            </div>
            <ChartCard
              title={`Top ${geography?.child_label || "markets"}`}
              subtitle={`Ranked by ${MAP_METRICS.find((item) => item.value === mapMetric)?.label || "activity"}`}
              loading={loading}
              empty={!marketChart.length}
              emptyTitle="No markets yet"
              emptyMessage="Markets appear after geo-tagged activity arrives."
              className="admin-tourism-map__ranking"
            >
              <HorizontalBarChart data={marketChart} valueLabel="Demand" ariaLabel="Top markets" />
              <div className="admin-bi-market-links">
                {(geography?.children || []).slice(0, 8).map((child) => (
                  <button key={child.key} type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => drillToChild(child)}>
                    {child.label} · {child.share_pct ?? 0}%
                  </button>
                ))}
              </div>
            </ChartCard>
          </Section>

          <Section
            id="market-comparison"
            kicker="Compare markets"
            title="How markets differ"
            subtitle="Up to five sibling markets, calculated with the same period, definitions, and minimum-volume rules."
          >
            {loading ? (
              <div className="admin-skeleton admin-skeleton--block" aria-label="Loading market comparison" />
            ) : !data?.market_comparison.length ? (
              <EmptyState title="No comparable markets" message="Comparison appears when at least one sibling market clears the privacy threshold." />
            ) : (
              <AdminDataTable label="Market comparison">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Demand Index</th>
                    <th>Demand growth</th>
                    <th>Restaurant intent</th>
                    <th>Route activity</th>
                    <th>Weekend demand</th>
                  </tr>
                </thead>
                <tbody>
                  {data.market_comparison.map((market) => (
                    <tr key={market.key}>
                      <td><strong>{market.label}</strong><small className="admin-bi-quality"> · n={formatNumber(market.sample_size)}</small></td>
                      <td>{market.demand_index == null ? "—" : `${market.demand_index}/100`}</td>
                      <td>{market.demand_growth_pct == null ? "—" : `${market.demand_growth_pct > 0 ? "+" : ""}${market.demand_growth_pct}%`}</td>
                      <td>{market.restaurant_intent_share_pct == null ? "—" : formatPercent(market.restaurant_intent_share_pct)}</td>
                      <td>{market.route_activity_share_pct == null ? "—" : formatPercent(market.route_activity_share_pct)}</td>
                      <td>{market.weekend_demand_pct == null ? "—" : formatPercent(market.weekend_demand_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </AdminDataTable>
            )}
          </Section>

          <Section id="time-intelligence" kicker="When travelers are active" title="Peak demand" subtitle="Destination/event timezone daypart × weekday heatmap for staffing and promo timing.">
            {!loading && !data?.peak_demand.available ? (
              <EmptyState title="Peak demand not available" message="Need timestamps on analytics events to build day/hour demand." />
            ) : (
              <div className="admin-bi-peak">
                <div className="admin-bi-peak__grid" role="table" aria-label="Peak demand heatmap">
                  <div className="admin-bi-peak__corner" />
                  {(data?.peak_demand.weekdays || []).map((day) => (
                    <div key={day} className="admin-bi-peak__head">
                      {day}
                    </div>
                  ))}
                  {(data?.peak_demand.dayparts || []).map((part) => (
                    <Fragment key={part}>
                      <div className="admin-bi-peak__label">
                        {part}
                      </div>
                      {(data?.peak_demand.matrix[part] || []).map((value, index) => (
                        <div
                          key={`${part}-${index}`}
                          className="admin-bi-peak__cell"
                          style={{ background: `rgba(59, 130, 246, ${0.08 + (value / peakMax) * 0.75})` }}
                          title={`${part} ${data?.peak_demand.weekdays[index]}: ${value}`}
                        >
                          {value || ""}
                        </div>
                      ))}
                    </Fragment>
                  ))}
                </div>
                {data?.peak_demand.peak_window ? (
                  <aside className="admin-insight-callout" style={{ marginTop: "1rem" }}>
                    <span className="admin-insight-callout__mark" aria-hidden="true" />
                    <div>
                      <strong>Peak opportunity · {data.peak_demand.peak_window.label}</strong>
                      <p>{data.peak_demand.peak_window.above_average_pct}% above the weekly window average.</p>
                      <small>Based on {formatNumber(data.peak_demand.peak_window.sample_size)} eligible events.</small>
                    </div>
                  </aside>
                ) : null}
              </div>
            )}
          </Section>
        </>
      ) : null}

      {activeTab === "demand" ? (
        <>
          <Section id="customer-intent" kicker="What travelers want" title="Category and search intelligence" subtitle="Demand, growth, supply, intent, and opportunity calculated from the same market filter.">
            <div className="admin-tourism-inventory-grid">
              <ChartCard
                title="Demand by category"
                subtitle="Click a category chip to filter the dashboard"
                loading={loading}
                empty={!categoryChart.length}
                emptyTitle="No category mix yet"
                emptyMessage="Categories appear when place metadata or event properties include category."
              >
                <HorizontalBarChart data={categoryChart} valueLabel="Demand" ariaLabel="Categories" />
                <div className="admin-bi-market-links">
                  {(data?.categories || []).slice(0, 10).map((item) => (
                    <button
                      key={item.category}
                      type="button"
                      className={`admin-btn admin-btn--ghost admin-btn--sm${category === item.category ? " is-active" : ""}`}
                      onClick={() => setCategory((current) => (current === item.category ? null : item.category))}
                    >
                      {item.category} · {item.share_pct}%
                    </button>
                  ))}
                </div>
              </ChartCard>
              <ChartCard
                title="What travelers search for"
                subtitle={data?.searches.privacy_note || "Privacy-safe search fingerprints"}
                loading={loading}
                empty={!data?.searches.available}
                emptyTitle="No search entity mix yet"
                emptyMessage="Search demand appears when search_performed / search_submitted events arrive."
              >
                {data?.searches.available ? (
                  <AdminDataTable label="Top searches">
                    <thead>
                      <tr>
                        <th>Search</th>
                        <th>Searches</th>
                        <th>CTR</th>
                        <th>Results</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.searches.top_searches.map((row) => (
                        <tr key={row.query_hash}>
                          <td>{row.label}</td>
                          <td>{formatNumber(row.count)}</td>
                          <td>{row.ctr == null ? "—" : formatPercent(row.ctr)}</td>
                          <td>{row.avg_results == null ? "—" : row.avg_results}</td>
                        </tr>
                      ))}
                    </tbody>
                  </AdminDataTable>
                ) : null}
                {(data?.searches.low_supply || []).map((item) => (
                  <aside key={String(item.signal)} className="admin-insight-callout" style={{ marginTop: "0.75rem" }}>
                    <span className="admin-insight-callout__mark" aria-hidden="true" />
                    <div>
                      <strong>Demand opportunity</strong>
                      <p>
                        {String(item.label)} · {formatNumber(item.searches)} searches
                      </p>
                      <small>{String(item.detail || "")}</small>
                    </div>
                  </aside>
                ))}
              </ChartCard>
            </div>
            {!loading && data?.categories.length ? (
              <AdminDataTable label="Category intelligence">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Demand</th>
                    <th>Growth</th>
                    <th>Supply</th>
                    <th>Intent rate</th>
                    <th>Save rate</th>
                    <th>Competition</th>
                    <th>Opportunity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categories.map((item) => (
                    <tr key={item.category}>
                      <td><strong>{item.category}</strong><small className="admin-bi-quality"> · n={formatNumber(item.demand)}</small></td>
                      <td>{item.demand_index == null ? "—" : `${item.demand_index}/100`}</td>
                      <td>{item.growth_pct == null ? "—" : `${item.growth_pct > 0 ? "+" : ""}${item.growth_pct}%`}</td>
                      <td>{item.supply_index == null ? "—" : `${item.supply_index}/100`}</td>
                      <td>{item.intent_rate == null ? "—" : formatPercent(item.intent_rate)}</td>
                      <td>{item.save_rate == null ? "—" : formatPercent(item.save_rate)}</td>
                      <td>{item.supply_index == null ? "—" : item.supply_index >= 67 ? "High" : item.supply_index >= 34 ? "Moderate" : "Low"}</td>
                      <td><strong>{item.opportunity_score == null ? "—" : `${item.opportunity_score}/100`}</strong><small className="admin-bi-quality"> · {item.opportunity_level}</small></td>
                    </tr>
                  ))}
                </tbody>
              </AdminDataTable>
            ) : null}
          </Section>

          <Section id="opportunities" kicker="Supply vs demand" title="Where gaps may exist" subtitle="Cohort-normalized demand and supply; signals are investigative, not financial predictions.">
            {!loading && !data?.supply_demand_matrix.length ? (
              <EmptyState title="Not enough category data" message="At least two reliable categories are needed to compare demand with observed supply." />
            ) : (
              <div className="admin-bi-matrix">
                {data?.supply_demand_matrix.map((item) => (
                  <article key={item.category} className={`admin-bi-matrix__item admin-bi-matrix__item--${item.quadrant}`}>
                    <p>{item.quadrant.replaceAll("_", " ")}</p>
                    <h3>{item.category}</h3>
                    <dl>
                      <div><dt>Demand</dt><dd>{item.demand}</dd></div>
                      <div><dt>Supply</dt><dd>{item.supply}</dd></div>
                      <div><dt>Opportunity</dt><dd>{item.opportunity_score}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </Section>

          <Section id="intent-funnel" kicker="From discovery to action" title="Commercial intent funnel" subtitle="Whether place discovery turns into saves and business actions.">
            {loading ? (
              <div className="admin-skeleton admin-skeleton--block" aria-label="Loading funnel" />
            ) : !data?.funnel?.some((step) => step.count > 0) ? (
              <EmptyState title="No commercial funnel yet" message="Place impressions, views, saves, and intent actions will appear here when instrumented." />
            ) : (
              <ol className="admin-bi-funnel">
                {data.funnel.map((step) => (
                  <li key={step.key}>
                    <strong>{formatNumber(step.count)}</strong>
                    <span>{step.label}</span>
                    {step.conversion_from_previous != null ? <small>{formatPercent(step.conversion_from_previous)} from previous</small> : null}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </>
      ) : null}

      {activeTab === "places" ? (
        <>
          <Section id="places" kicker="Places & competitive landscape" title="Who is capturing demand" subtitle="Names from catalog metadata — never UUIDs as primary text. Click a row for Place 360.">
            {loading ? (
              <div className="admin-skeleton admin-skeleton--block" aria-label="Loading places" />
            ) : !data?.places?.length ? (
              <EmptyState title="No place demand yet" message="Place rankings appear when place views/engagement include entity_id." />
            ) : (
              <AdminDataTable label="Places performance">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Place</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>Views</th>
                    <th>Visitors</th>
                    <th>Saves</th>
                    <th>Shares</th>
                    <th>Directions</th>
                    <th>Intent rate</th>
                    <th>Rating</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {data.places.slice(0, 20).map((row, index) => (
                    <tr key={String(row.place_id)} className={index < 3 ? "is-top-ranked" : ""} onClick={() => setSelectedPlace(row)} style={{ cursor: "pointer" }}>
                      <td>
                        <span className="admin-rank">{index + 1}</span>
                      </td>
                      <td>
                        <strong>{String(row.place_name)}</strong>
                        {!row.name_resolved ? <small className="admin-bi-quality"> · Unknown place</small> : null}
                      </td>
                      <td>{String(row.category || "—")}</td>
                      <td>{String(row.location || "—")}</td>
                      <td>{formatNumber(row.views)}</td>
                      <td>{formatNumber(row.unique_visitors)}</td>
                      <td>{formatNumber(row.saves)}</td>
                      <td>{formatNumber(row.shares)}</td>
                      <td>{formatNumber(row.directions)}</td>
                      <td>{row.intent_rate == null ? "—" : formatPercent(row.intent_rate)}</td>
                      <td>{row.rating == null ? "—" : Number(row.rating).toFixed(1)}</td>
                      <td>{row.trend_pct == null ? "—" : `${Number(row.trend_pct) > 0 ? "+" : ""}${row.trend_pct}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </AdminDataTable>
            )}
          </Section>

          <Section id="business-performance" kicker="Business performance" title="Places vs aggregated market cohorts" subtitle="Explore Business Score is performance; Opportunity Score is market potential. They are intentionally separate.">
            {loading ? (
              <div className="admin-skeleton admin-skeleton--block" aria-label="Loading benchmarks" />
            ) : !data?.places.length ? (
              <EmptyState title="No business cohort yet" message="Benchmarks require place views and at least four eligible places in the cohort." />
            ) : (
              <AdminDataTable label="Business performance benchmarks">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Business Score</th>
                    <th>Discovery</th>
                    <th>Engagement</th>
                    <th>Intent</th>
                    <th>Growth</th>
                    <th>Reputation</th>
                    <th>Cohort</th>
                  </tr>
                </thead>
                <tbody>
                  {data.places.slice(0, 12).map((row) => {
                    const benchmark = (row.benchmark || {}) as {
                      score?: number | null;
                      status?: string;
                      cohort_size?: number;
                      components?: Record<string, number | null>;
                    };
                    return (
                      <tr key={String(row.place_id)} onClick={() => setSelectedPlace(row)} style={{ cursor: "pointer" }}>
                        <td><strong>{String(row.place_name)}</strong><small className="admin-bi-quality"> · {String(row.category || "Uncategorized")}</small></td>
                        <td><strong>{benchmark.score == null ? "—" : `${benchmark.score}/100`}</strong></td>
                        <td>{benchmark.components?.discovery ?? "—"}</td>
                        <td>{benchmark.components?.engagement ?? "—"}</td>
                        <td>{benchmark.components?.intent ?? "—"}</td>
                        <td>{benchmark.components?.growth ?? "—"}</td>
                        <td>{benchmark.components?.reputation ?? "—"}</td>
                        <td>{benchmark.cohort_size ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </AdminDataTable>
            )}
          </Section>

          <Section id="routes" kicker="Routes & experiences" title="Which experiences work" subtitle="Tour and experience routes with completion quality, drop-off, and generated business intent.">
            {loading ? (
              <div className="admin-skeleton admin-skeleton--block" aria-label="Loading routes" />
            ) : !data?.routes?.length ? (
              <EmptyState title="No route demand yet" message="Route rankings appear when route views/starts include entity_id." />
            ) : (
              <AdminDataTable label="Routes performance">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Route</th>
                    <th>Area</th>
                    <th>Stops</th>
                    <th>Views</th>
                    <th>Saves</th>
                    <th>Starts</th>
                    <th>Completes</th>
                    <th>Completion</th>
                    <th>Intent generated</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {data.routes.slice(0, 20).map((row, index) => (
                    <tr key={String(row.route_id)} className={index < 3 ? "is-top-ranked" : ""} onClick={() => setSelectedRoute(row)} style={{ cursor: "pointer" }}>
                      <td>
                        <span className="admin-rank">{index + 1}</span>
                      </td>
                      <td>
                        <strong>{String(row.route_name)}</strong>
                        {!row.name_resolved ? <small className="admin-bi-quality"> · Unknown route</small> : null}
                      </td>
                      <td>{String(row.area || "—")}</td>
                      <td>{row.stops == null ? "—" : formatNumber(row.stops)}</td>
                      <td>{formatNumber(row.views)}</td>
                      <td>{formatNumber(row.saves)}</td>
                      <td>{formatNumber(row.starts)}</td>
                      <td>{formatNumber(row.completes)}</td>
                      <td>{row.completion_rate == null ? "—" : formatPercent(row.completion_rate)}</td>
                      <td>{formatNumber(row.commercial_actions)}</td>
                      <td>{row.trend_pct == null ? "—" : `${Number(row.trend_pct) > 0 ? "+" : ""}${row.trend_pct}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </AdminDataTable>
            )}
          </Section>

          <Section id="content-attribution" kicker="Content → business" title="Content driving discovery" subtitle="Explicit source links and same-session paths from content to place/route demand.">
            {!loading && !data?.content_attribution.available ? (
              <EmptyState title="No content attribution yet" message={data?.content_attribution.note || "Video entities with engagement unlock this section."} />
            ) : (
              <AdminDataTable label="Content attribution">
                <thead>
                  <tr>
                    <th>Content</th>
                    <th>Views</th>
                    <th>Place visits</th>
                    <th>Route visits</th>
                    <th>Intent</th>
                    <th>Directions</th>
                    <th>Attribution</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.content_attribution.items || []).map((row) => (
                    <tr key={String(row.content_id)}>
                      <td>
                        <strong>{String(row.content_name)}</strong>
                      </td>
                      <td>{formatNumber(row.views)}</td>
                      <td>{formatNumber(row.place_visits)}</td>
                      <td>{formatNumber(row.route_visits)}</td>
                      <td>{formatNumber(row.intent_actions)}</td>
                      <td>{formatNumber(row.directions)}</td>
                      <td>{String(row.attribution || "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </AdminDataTable>
            )}
            {data?.content_attribution.note ? <p className="admin-bi-note">{data.content_attribution.note}</p> : null}
          </Section>
        </>
      ) : null}

      {activeTab === "audience" ? (
        <>
          <Section id="audience" kicker="Audience" title="Who is showing intent" subtitle="Privacy-safe origin, traveler mix, and behavior segments — never individual location histories.">
            <div className="admin-tourism-inventory-grid">
              <ChartCard
                title="Traveler markets"
                subtitle={data?.traveler_origins.note || ""}
                loading={loading}
                empty={!data?.traveler_origins.available}
                emptyTitle="Select a destination"
                emptyMessage="Drill into a country/region/city to compare traveler market origins."
              >
                <HorizontalBarChart data={originChart} valueLabel="Events" ariaLabel="Traveler origins" />
              </ChartCard>
              <ChartCard
                title="Local vs traveler mix"
                subtitle={data?.audience.privacy_note || "Aggregated behavior only"}
                loading={loading}
                empty={!data?.audience.traveler_mix.some((item) => item.count > 0)}
                emptyTitle="Audience mix unavailable"
                emptyMessage="Origin-country or explicit traveler_segment instrumentation is required."
              >
                <HorizontalBarChart
                  data={(data?.audience.traveler_mix || []).map((item) => ({ label: `${item.segment.replaceAll("_", " ")} — ${item.share_pct}%`, value: item.count }))}
                  valueLabel="Events"
                  ariaLabel="Traveler mix"
                />
              </ChartCard>
            </div>
            {(data?.audience.behavior || []).length ? (
              <div className="admin-bi-source-grid">
                {data?.audience.behavior.map((item) => (
                  <article key={item.segment}>
                    <span>{item.segment}</span>
                    <strong>{item.share_pct}%</strong>
                    <small>{formatNumber(item.count)} demand signals</small>
                  </article>
                ))}
              </div>
            ) : null}
          </Section>

          <Section id="discovery-attribution" kicker="Discovery attribution" title="How travelers find businesses" subtitle="Source is carried on the event contract; unknown sources remain visible as Other.">
            {!loading && !data?.discovery_attribution.available ? (
              <EmptyState title="Discovery source tracking is missing" message="Send source_type / discovery_source on place and route interactions to unlock attribution." />
            ) : (
              <div className="admin-bi-source-grid">
                {data?.discovery_attribution.sources.map((item) => (
                  <article key={item.source}>
                    <span>{item.source.replaceAll("_", " ")}</span>
                    <strong>{item.share_pct}%</strong>
                    <small>{formatNumber(item.count)} attributed interactions</small>
                  </article>
                ))}
              </div>
            )}
          </Section>
        </>
      ) : null}

      {activeTab === "insights" ? (
        <>
          <Section id="explore-insights" kicker="Explore insights" title="What changed and why it matters" subtitle="Every recommendation includes evidence, confidence, sample size, period, and a link back to its metric.">
            {!loading && !data?.insights.length ? (
              <EmptyState title="No reliable insights yet" message="Insights are suppressed until minimum comparison and sample-size rules are met." />
            ) : (
              <div className="admin-bi-insights">
                {data?.insights.map((insight) => (
                  <article key={insight.id}>
                    <p>{insight.type.replaceAll("_", " ")} · {insight.confidence} confidence</p>
                    <h3>{insight.title}</h3>
                    <span>{insight.evidence}</span>
                    <strong>Consider: {insight.consideration}</strong>
                    <footer>
                      <small>n={insight.sample_size == null ? "—" : formatNumber(insight.sample_size)} · {insight.period.start} → {insight.period.end}</small>
                      <a
                        href={`#${insight.anchor}`}
                        onClick={(event) => {
                          event.preventDefault();
                          jumpToAnchor(insight.anchor);
                        }}
                      >
                        View evidence
                      </a>
                    </footer>
                  </article>
                ))}
              </div>
            )}
          </Section>

          <Section id="analytics-health" kicker="Admin only" title="Analytics health" subtitle="Operational quality behind this Business Intelligence response.">
            <div className="admin-bi-health-grid">
              <article><span>Eligible events</span><strong>{formatNumber(data?.data_quality.valid_events)}</strong></article>
              <article><span>Unknown places</span><strong>{formatNumber(data?.data_quality.unknown_places)}</strong></article>
              <article><span>Unknown routes</span><strong>{formatNumber(data?.data_quality.unknown_routes)}</strong></article>
              <article><span>Missing destination geography</span><strong>{formatNumber(data?.data_quality.missing_geography)}</strong></article>
              <article><span>Validity filter</span><strong>{data?.data_quality.validity_view_active ? "Active" : "Fallback"}</strong></article>
              <article><span>Destination-event geo</span><strong>{data?.data_quality.destination_geo_coverage_pct == null ? "—" : `${data.data_quality.destination_geo_coverage_pct}%`}</strong></article>
              <article><span>Traveler-origin country</span><strong>{data?.data_quality.traveler_origin_coverage_pct == null ? "—" : `${data.data_quality.traveler_origin_coverage_pct}%`}</strong></article>
              <article><span>Places with country</span><strong>{data?.data_quality.places_with_country_pct == null ? "—" : `${data.data_quality.places_with_country_pct}%`}</strong></article>
              <article><span>Places with region</span><strong>{data?.data_quality.places_with_region_pct == null ? "—" : `${data.data_quality.places_with_region_pct}%`}</strong></article>
              <article><span>Places with city</span><strong>{data?.data_quality.places_with_city_pct == null ? "—" : `${data.data_quality.places_with_city_pct}%`}</strong></article>
              <article><span>Routes with market</span><strong>{data?.data_quality.routes_with_market_pct == null ? "—" : `${data.data_quality.routes_with_market_pct}%`}</strong></article>
              <article><span>Place resolution</span><strong>{data?.data_quality.place_resolution_pct == null ? "—" : `${data.data_quality.place_resolution_pct}%`}</strong></article>
              <article><span>Route resolution</span><strong>{data?.data_quality.route_resolution_pct == null ? "—" : `${data.data_quality.route_resolution_pct}%`}</strong></article>
              <article><span>Rejected events</span><strong>{formatNumber(data?.data_quality.rejected_events)}</strong></article>
              <article><span>Duplicate candidates</span><strong>{formatNumber(data?.data_quality.possible_duplicate_places)}</strong></article>
              <article><span>Aggregation failures</span><strong>{formatNumber(data?.data_quality.aggregation_failures)}</strong></article>
              <article><span>Last aggregation</span><strong>{freshnessLabel(data?.data_quality.last_aggregation)}</strong></article>
              <article><span>Data as of</span><strong>{freshnessLabel(data?.data_as_of)}</strong></article>
            </div>
          </Section>
        </>
      ) : null}

      {selectedPlace ? (
        <aside className="admin-bi-drawer" role="dialog" aria-label="Place 360">
          <header>
            <div>
              <p>Place 360</p>
              <h3>{String(selectedPlace.place_name)}</h3>
            </div>
            <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => setSelectedPlace(null)}>
              Close
            </button>
          </header>
          <dl>
            <div><dt>Category</dt><dd>{String(selectedPlace.category || "—")}</dd></div>
            <div><dt>Location</dt><dd>{String(selectedPlace.location || "—")}</dd></div>
            <div><dt>Views</dt><dd>{formatNumber(selectedPlace.views)}</dd></div>
            <div><dt>Unique visitors</dt><dd>{formatNumber(selectedPlace.unique_visitors)}</dd></div>
            <div><dt>Saves</dt><dd>{formatNumber(selectedPlace.saves)}</dd></div>
            <div><dt>Shares</dt><dd>{formatNumber(selectedPlace.shares)}</dd></div>
            <div><dt>Directions</dt><dd>{formatNumber(selectedPlace.directions)}</dd></div>
            <div><dt>Calls</dt><dd>{formatNumber(selectedPlace.calls)}</dd></div>
            <div><dt>Website clicks</dt><dd>{formatNumber(selectedPlace.website_clicks)}</dd></div>
            <div><dt>Intent rate</dt><dd>{selectedPlace.intent_rate == null ? "—" : formatPercent(selectedPlace.intent_rate)}</dd></div>
            <div><dt>Rating</dt><dd>{selectedPlace.rating == null ? "—" : Number(selectedPlace.rating).toFixed(1)}</dd></div>
            <div><dt>Trend</dt><dd>{selectedPlace.trend_pct == null ? "—" : `${selectedPlace.trend_pct}%`}</dd></div>
          </dl>
          {selectedPlace.benchmark ? (
            <div className="admin-bi-drawer__section">
              <h4>Market context</h4>
              <p>Explore Business Score: <strong>{String((selectedPlace.benchmark as { score?: number | null }).score ?? "Insufficient data")}</strong></p>
              <small>Cohort size: {String((selectedPlace.benchmark as { cohort_size?: number }).cohort_size ?? "—")}</small>
            </div>
          ) : null}
          {Array.isArray(selectedPlace.discovery_sources) ? (
            <div className="admin-bi-drawer__section">
              <h4>Discovery sources</h4>
              <ul className="admin-bi-movers">
                {(selectedPlace.discovery_sources as Array<{ source: string; count: number; share_pct: number }>).map((item) => (
                  <li key={item.source}>{item.source.replaceAll("_", " ")} <strong>{item.share_pct}%</strong></li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      ) : null}

      {selectedRoute ? (
        <aside className="admin-bi-drawer" role="dialog" aria-label="Route 360">
          <header>
            <div>
              <p>Route 360</p>
              <h3>{String(selectedRoute.route_name)}</h3>
            </div>
            <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => setSelectedRoute(null)}>
              Close
            </button>
          </header>
          <dl>
            <div><dt>Area</dt><dd>{String(selectedRoute.area || "—")}</dd></div>
            <div><dt>Stops</dt><dd>{selectedRoute.stops == null ? "—" : formatNumber(selectedRoute.stops)}</dd></div>
            <div><dt>Views</dt><dd>{formatNumber(selectedRoute.views)}</dd></div>
            <div><dt>Saves</dt><dd>{formatNumber(selectedRoute.saves)}</dd></div>
            <div><dt>Starts</dt><dd>{formatNumber(selectedRoute.starts)}</dd></div>
            <div><dt>Completes</dt><dd>{formatNumber(selectedRoute.completes)}</dd></div>
            <div><dt>Completion</dt><dd>{selectedRoute.completion_rate == null ? "—" : formatPercent(selectedRoute.completion_rate)}</dd></div>
            <div><dt>Commercial actions</dt><dd>{formatNumber(selectedRoute.commercial_actions)}</dd></div>
            <div><dt>Trend</dt><dd>{selectedRoute.trend_pct == null ? "—" : `${selectedRoute.trend_pct}%`}</dd></div>
          </dl>
          <div className="admin-bi-drawer__section">
            <h4>Route drop-off</h4>
            {Array.isArray(selectedRoute.dropoff) && selectedRoute.dropoff.length ? (
              <ol className="admin-bi-route-dropoff">
                {(selectedRoute.dropoff as Array<{ stop_id: string; stop_name: string; reach_pct: number; dropoff_from_previous_pct: number }>).map((stop) => (
                  <li key={stop.stop_id}>
                    <span>{stop.stop_name}</span>
                    <strong>{stop.reach_pct}%</strong>
                    {stop.dropoff_from_previous_pct >= 15 ? <small>major drop −{stop.dropoff_from_previous_pct}%</small> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p>{selectedRoute.dropoff_status === "missing_tracking" ? "Route starts exist, but stop tracking is not currently available." : "No route starts occurred during this period."}</p>
            )}
          </div>
          {selectedRoute.generated ? (
            <div className="admin-bi-drawer__section">
              <h4>Business generated by this route</h4>
              <dl>
                {Object.entries(selectedRoute.generated as Record<string, unknown>).map(([key, value]) => (
                  <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{formatNumber(value)}</dd></div>
                ))}
              </dl>
            </div>
          ) : null}
        </aside>
      ) : null}
    </AdminPageShell>
  );
}
