import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode, Fragment } from "react";
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
  { value: "activity", label: "Activity" },
  { value: "users", label: "Users" },
  { value: "place_views", label: "Place views" },
  { value: "route_views", label: "Route views" },
  { value: "intent", label: "Intent" },
  { value: "saves", label: "Saves" },
  { value: "searches", label: "Searches" },
];

const KPI_ORDER = [
  "active_users",
  "sessions",
  "place_views",
  "route_views",
  "route_starts",
  "route_completions",
  "saves",
  "commercial_intent",
] as const;

const KPI_LABELS: Record<string, string> = {
  active_users: "Active users",
  sessions: "Sessions",
  place_views: "Place views",
  route_views: "Route views",
  route_starts: "Route starts",
  route_completions: "Route completions",
  saves: "Saves",
  commercial_intent: "Commercial intent",
};

function Section({
  kicker,
  title,
  subtitle,
  action,
  children,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="admin-executive-section">
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
  const [mapMetric, setMapMetric] = useState<BusinessIntelMapMetric>("activity");
  const [category, setCategory] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoState>({ country: null, region: null, city: null, neighborhood: null });
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [data, setData] = useState<BusinessIntelDashboard | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Record<string, unknown> | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Record<string, unknown> | null>(null);

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
    }),
    [range, compare, granularity, mapMetric, geo, category],
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
          <small>{periodLabel}</small>
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

      <Section kicker="Pulse" title="Business KPIs" subtitle="Unique metrics for the selected geography and period, with comparison deltas.">
        <div className="admin-bi-kpi-grid">
          {KPI_ORDER.map((key) => {
            const value = data?.kpis?.[key];
            const delta = data?.comparison?.deltas?.[key];
            const definition = data?.kpi_definitions?.[key];
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
        kicker="Travel demand"
        title="Where demand is happening"
        subtitle={`${geography?.child_label || "Markets"} for the current geography. Click map or list to drill down.`}
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
        <div className="admin-tourism-heat-grid">
          <div className="admin-tourism-map">
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
        </div>
      </Section>

      <Section
        kicker="Demand trend"
        title="How demand is moving"
        subtitle="Users, place views, route views, and commercial actions over time."
        action={
          <label className="admin-inline-field">
            <span>Grain</span>
            <select value={granularity} onChange={(event) => setGranularity(event.target.value as "daily" | "weekly" | "monthly")}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        }
      >
        <ChartCard
          title="Demand trend"
          subtitle={`${granularity} series`}
          loading={loading}
          empty={!data?.timeseries?.length}
          emptyTitle="No trend yet"
          emptyMessage="Timeseries appears after activity accumulates in the selected period."
        >
          <AreaTrendChart
            data={(data?.timeseries || []) as Array<Record<string, unknown>>}
            xKey="period"
            series={[
              { key: "users", label: "Users", color: chartColors.primary },
              { key: "place_views", label: "Place views", color: chartColors.secondary },
              { key: "route_views", label: "Route views", color: chartColors.primary },
              { key: "commercial_actions", label: "Commercial actions", color: chartColors.secondary },
            ]}
            ariaLabel="Demand trend"
          />
        </ChartCard>
      </Section>

      <Section kicker="From discovery to action" title="Commercial intent funnel" subtitle="Whether place discovery turns into saves and business actions.">
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

      <Section kicker="What travelers want" title="Categories and search demand" subtitle="Demand mix for partners deciding what inventory to add.">
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
                    <th>Fingerprint</th>
                    <th>Searches</th>
                  </tr>
                </thead>
                <tbody>
                  {data.searches.top_searches.map((row) => (
                    <tr key={row.query_hash}>
                      <td>{row.label}</td>
                      <td>{formatNumber(row.count)}</td>
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
      </Section>

      <Section kicker="When travelers are active" title="Peak demand" subtitle="UTC daypart × weekday heatmap for staffing and promo timing.">
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
                      style={{ background: `rgba(0, 113, 227, ${0.08 + (value / peakMax) * 0.75})` }}
                      title={`${part} ${data?.peak_demand.weekdays[index]}: ${value}`}
                    >
                      {value || ""}
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section kicker="Places" title="Places performance" subtitle="Names from catalog metadata — never UUIDs as primary text. Click a row for detail.">
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
                <th>Saves</th>
                <th>Actions</th>
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
                  <td>{formatNumber(row.saves)}</td>
                  <td>{formatNumber(row.actions)}</td>
                  <td>{row.rating == null ? "—" : Number(row.rating).toFixed(1)}</td>
                  <td>{row.trend_pct == null ? "—" : `${Number(row.trend_pct) > 0 ? "+" : ""}${row.trend_pct}%`}</td>
                </tr>
              ))}
            </tbody>
          </AdminDataTable>
        )}
      </Section>

      <Section kicker="Routes" title="Routes performance" subtitle="Tour and experience routes with completion quality — names from catalog.">
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
                <th>Starts</th>
                <th>Completes</th>
                <th>Completion</th>
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
                  <td>{formatNumber(row.starts)}</td>
                  <td>{formatNumber(row.completes)}</td>
                  <td>{row.completion_rate == null ? "—" : formatPercent(row.completion_rate)}</td>
                  <td>{row.trend_pct == null ? "—" : `${Number(row.trend_pct) > 0 ? "+" : ""}${row.trend_pct}%`}</td>
                </tr>
              ))}
            </tbody>
          </AdminDataTable>
        )}
      </Section>

      <Section kicker="Content → business" title="Content driving discovery" subtitle="Approximate same-period attribution from videos to place/route demand.">
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

      <Section kicker="Opportunities" title="Market opportunities" subtitle="Generated only when evidence clears volume thresholds — never fabricated.">
        {data?.opportunities.insufficient_data ? (
          <EmptyState title="Insufficient data" message={data.opportunities.message || "Not enough signal to recommend actions."} />
        ) : (
          <div className="admin-tourism-opportunities">
            {(data?.opportunities.cards || []).map((card) => (
              <article key={`${card.type}-${card.title}`} className="admin-tourism-opportunity">
                <p>{card.type.replaceAll("_", " ")} · {card.confidence}</p>
                <h3>{card.title}</h3>
                <span>{card.evidence}</span>
                <strong style={{ display: "block", marginTop: "0.55rem", fontSize: "0.84rem" }}>{card.opportunity}</strong>
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section kicker="Business insights" title="Who this data helps" subtitle="Signals for the current geographic filter.">
        <div className="admin-tourism-opportunities">
          <article className="admin-tourism-opportunity">
            <p>Tourism boards</p>
            <h3>Destination demand</h3>
            <span>
              Top zones:{" "}
              {(((data?.business_signals.tourism_boards as { fastest_growing?: Array<{ label: string }> })?.fastest_growing) || [])
                .map((item) => item.label)
                .join(", ") || "Insufficient data"}
            </span>
          </article>
          <article className="admin-tourism-opportunity">
            <p>Restaurants & places</p>
            <h3>{formatNumber(data?.kpis.commercial_intent)} commercial intents</h3>
            <span>
              {formatNumber(data?.kpis.place_views)} place views · {formatNumber(data?.kpis.saves)} saves in filter
            </span>
          </article>
          <article className="admin-tourism-opportunity">
            <p>Tours & experiences</p>
            <h3>{formatNumber(data?.kpis.route_starts)} route starts</h3>
            <span>
              Completion {data?.kpis.route_completion_rate == null ? "—" : formatPercent(data.kpis.route_completion_rate)} ·{" "}
              {formatNumber(data?.kpis.route_views)} route views
            </span>
          </article>
        </div>
      </Section>

      <Section kicker="Origins" title="Where demand comes from" subtitle="Traveler market mix for the selected destination (privacy-safe aggregates).">
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
      </Section>

      <Section kicker="Top movers" title="Rising and declining" subtitle={`Requires ≥ previous volume threshold to avoid noisy percentages.`}>
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

      {selectedPlace ? (
        <aside className="admin-bi-drawer" role="dialog" aria-label="Place overview">
          <header>
            <div>
              <p>Place overview</p>
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
            <div><dt>Rating</dt><dd>{selectedPlace.rating == null ? "—" : Number(selectedPlace.rating).toFixed(1)}</dd></div>
            <div><dt>Trend</dt><dd>{selectedPlace.trend_pct == null ? "—" : `${selectedPlace.trend_pct}%`}</dd></div>
          </dl>
        </aside>
      ) : null}

      {selectedRoute ? (
        <aside className="admin-bi-drawer" role="dialog" aria-label="Route overview">
          <header>
            <div>
              <p>Route overview</p>
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
        </aside>
      ) : null}
    </AdminPageShell>
  );
}
