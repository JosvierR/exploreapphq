import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AdminAuthGate } from "@/features/admin/components/AdminAuthGate";
import { AdminDataTable, AdminPageShell, EmptyState, ErrorState } from "@/features/admin/components/AdminPrimitives";
import { ChartCard } from "@/features/admin/components/charts/ChartCard";
import { HorizontalBarChart } from "@/features/admin/components/charts/HorizontalBarChart";
import { KpiTrendCard, type KpiDelta } from "@/features/admin/components/charts/KpiTrendCard";
import {
  type BusinessRangePreset,
  type BusinessWarning,
  getBusinessContent,
  getBusinessLocations,
  getBusinessOverview,
  getBusinessSearch,
} from "@/lib/adminAnalyticsApi";
import {
  entityLabel,
  filterLabel,
  formatNumber,
  formatPercent,
  formatRangeLabel,
  metricLabel,
  shortenId,
  warningCopy,
} from "@/lib/analyticsDisplay";
import { AdminApiError } from "@/lib/moderationAdminApi";

type OverviewData = Awaited<ReturnType<typeof getBusinessOverview>>;
type ContentData = Awaited<ReturnType<typeof getBusinessContent>>;
type LocationData = Awaited<ReturnType<typeof getBusinessLocations>>;
type SearchData = Awaited<ReturnType<typeof getBusinessSearch>>;

type SectionState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  requestId?: string | null;
  warnings: BusinessWarning[];
};

const RANGES: BusinessRangePreset[] = ["24h", "7d", "30d", "90d"];

/** Approximate country centroids (lon, lat) for equirectangular heatmap bubbles. */
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  US: [-98.5, 39.8],
  CA: [-106.3, 56.1],
  MX: [-102.5, 23.6],
  BR: [-51.9, -14.2],
  AR: [-63.6, -38.4],
  CL: [-71.5, -35.7],
  CO: [-74.3, 4.6],
  PE: [-75.0, -9.2],
  VE: [-66.6, 6.4],
  DO: [-70.2, 18.7],
  PR: [-66.5, 18.2],
  CU: [-77.8, 21.5],
  JM: [-77.3, 18.1],
  HT: [-72.3, 18.9],
  CR: [-84.1, 9.7],
  PA: [-80.8, 8.5],
  GT: [-90.2, 15.8],
  HN: [-86.2, 14.1],
  NI: [-85.2, 12.9],
  SV: [-88.9, 13.8],
  GB: [-1.2, 52.4],
  IE: [-8.2, 53.1],
  FR: [2.2, 46.2],
  ES: [-3.7, 40.5],
  PT: [-8.2, 39.4],
  DE: [10.5, 51.2],
  IT: [12.6, 41.9],
  NL: [5.3, 52.1],
  BE: [4.5, 50.5],
  CH: [8.2, 46.8],
  AT: [14.6, 47.5],
  PL: [19.1, 52.1],
  SE: [18.6, 60.1],
  NO: [8.5, 60.5],
  DK: [9.5, 56.3],
  FI: [25.7, 61.9],
  GR: [21.8, 39.1],
  TR: [35.2, 39.0],
  RU: [105.3, 61.5],
  UA: [31.2, 48.4],
  EG: [30.8, 26.8],
  MA: [-7.1, 31.8],
  ZA: [25.1, -29.0],
  NG: [8.7, 9.1],
  KE: [37.9, 0.0],
  AE: [53.8, 23.4],
  SA: [45.1, 23.9],
  IL: [34.9, 31.0],
  IN: [78.9, 20.6],
  PK: [69.3, 30.4],
  BD: [90.4, 23.7],
  CN: [104.2, 35.9],
  JP: [138.3, 36.2],
  KR: [127.8, 35.9],
  TH: [100.9, 15.9],
  VN: [108.3, 14.1],
  ID: [113.9, -0.8],
  MY: [101.9, 4.2],
  PH: [121.8, 12.9],
  SG: [103.8, 1.4],
  AU: [133.8, -25.3],
  NZ: [174.9, -40.9],
};

function initialSectionState<T>(): SectionState<T> {
  return { data: null, loading: true, error: null, requestId: null, warnings: [] };
}

function joinError(message: string, requestId?: string | null) {
  return requestId ? `${message} If this continues, check logs for request ID ${requestId}.` : message;
}

function numberValue(value: unknown) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatRate(value: unknown) {
  if (value == null || typeof value !== "number" || Number.isNaN(value)) return "—";
  return formatPercent(value);
}

function projectCountry(code: string): { x: number; y: number } | null {
  const point = COUNTRY_CENTROIDS[code.toUpperCase()];
  if (!point) return null;
  const [lon, lat] = point;
  return {
    x: ((lon + 180) / 360) * 1000,
    y: ((90 - lat) / 180) * 500,
  };
}

function ExecutiveSection({
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
        {action && <div>{action}</div>}
      </header>
      {children}
    </section>
  );
}

function SectionError({ title, state, onRetry }: { title: string; state: SectionState<unknown>; onRetry: () => void }) {
  if (!state.error) return null;
  return (
    <ErrorState title={`${title} could not load`} message={joinError(state.error, state.requestId)} onRetry={onRetry} />
  );
}

function InsightCallout({ code, message }: { code: string; message?: string }) {
  const copy = warningCopy(code, message);
  return (
    <aside className="admin-insight-callout">
      <span className="admin-insight-callout__mark" aria-hidden="true" />
      <div>
        <strong>{copy.title}</strong>
        <p>{copy.body}</p>
        {copy.action && <small>{copy.action}</small>}
      </div>
    </aside>
  );
}

function GlobalHeatmap({
  countries,
  loading,
}: {
  countries: Array<{ country: string; events: number; sessions: number }>;
  loading: boolean;
}) {
  const maxEvents = Math.max(1, ...countries.map((item) => item.events));
  const bubbles = countries
    .map((item) => {
      const projected = projectCountry(item.country);
      if (!projected) return null;
      const intensity = item.events / maxEvents;
      return {
        ...item,
        ...projected,
        radius: 8 + intensity * 28,
        opacity: 0.22 + intensity * 0.55,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="admin-tourism-map">
      {loading ? (
        <div className="admin-tourism-map__loading" aria-label="Loading heatmap" />
      ) : countries.length === 0 ? (
        <EmptyState
          title="No market heat yet"
          message="Country heat appears when analytics events include country (or locale-derived market). Generate place/route activity with geo metadata, then refresh."
        />
      ) : (
        <>
          <svg className="admin-tourism-map__svg" viewBox="0 0 1000 500" role="img" aria-label="Global tourism activity heatmap">
            <defs>
              <radialGradient id="tourismHeatGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--admin-accent, #0071e3)" stopOpacity="0.9" />
                <stop offset="100%" stopColor="var(--admin-accent, #0071e3)" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="tourismOcean" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#dce8f4" />
                <stop offset="55%" stopColor="#e8eef5" />
                <stop offset="100%" stopColor="#d4dde8" />
              </linearGradient>
            </defs>
            <rect width="1000" height="500" fill="url(#tourismOcean)" rx="18" />
            {/* Soft continent silhouettes — atmospheric, not cartographic precision */}
            <g fill="#c5d0dc" opacity="0.55">
              <ellipse cx="220" cy="180" rx="120" ry="80" />
              <ellipse cx="280" cy="290" rx="70" ry="110" />
              <ellipse cx="480" cy="160" rx="90" ry="70" />
              <ellipse cx="520" cy="240" rx="55" ry="90" />
              <ellipse cx="620" cy="280" rx="70" ry="95" />
              <ellipse cx="740" cy="200" rx="110" ry="75" />
              <ellipse cx="820" cy="320" rx="90" ry="60" />
            </g>
            <g>
              {bubbles.map((bubble) => (
                <g key={bubble.country}>
                  <circle cx={bubble.x} cy={bubble.y} r={bubble.radius * 1.6} fill="url(#tourismHeatGlow)" opacity={bubble.opacity * 0.7} />
                  <circle
                    cx={bubble.x}
                    cy={bubble.y}
                    r={bubble.radius}
                    fill="var(--admin-accent, #0071e3)"
                    opacity={bubble.opacity}
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
                  <title>{`${bubble.country}: ${bubble.events} events · ${bubble.sessions} sessions`}</title>
                </g>
              ))}
            </g>
          </svg>
          <div className="admin-tourism-map__legend">
            <span>Low activity</span>
            <span className="admin-tourism-map__legend-bar" aria-hidden="true" />
            <span>High activity</span>
            {bubbles.length < countries.length ? (
              <small>
                {countries.length - bubbles.length} market{countries.length - bubbles.length === 1 ? "" : "s"} without map pin
              </small>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function PartnerOpportunityCards({
  placeViews,
  routeStarts,
  commerceActions,
  topMarket,
  routeCompletion,
}: {
  placeViews: number;
  routeStarts: number;
  commerceActions: number;
  topMarket: string | null;
  routeCompletion: number | null;
}) {
  const cards = [
    {
      audience: "Countries & tourism boards",
      title: topMarket ? `Demand is concentrating in ${topMarket}` : "Watch emerging destination demand",
      detail: topMarket
        ? "Use market heat to prioritize destination partnerships, city packs, and local content supply."
        : "Once country metadata lands, destination heatmaps unlock national tourism planning.",
    },
    {
      audience: "Restaurants & places",
      title: commerceActions > 0 ? `${formatNumber(commerceActions)} local commerce intents` : "Local intent is still early",
      detail:
        placeViews > 0
          ? `${formatNumber(placeViews)} place views this period — directions, calls, and website clicks show restaurant / venue demand.`
          : "Instrument place_get_directions, place_call, and place_website_click to surface restaurant and venue demand.",
    },
    {
      audience: "Tours, boats & experiences",
      title: routeStarts > 0 ? `${formatNumber(routeStarts)} route starts` : "Route demand not yet visible",
      detail:
        routeCompletion != null
          ? `Route completion ${formatRate(routeCompletion)} — strong for guided tours, boat trips, and multi-stop experiences.`
          : "Route start/complete events power tour-operator and boat-experience recommendations.",
    },
  ];

  return (
    <div className="admin-tourism-opportunities">
      {cards.map((card) => (
        <article key={card.audience} className="admin-tourism-opportunity">
          <p>{card.audience}</p>
          <h3>{card.title}</h3>
          <span>{card.detail}</span>
        </article>
      ))}
    </div>
  );
}

export function AdminTourismBusinessPage() {
  return (
    <AdminAuthGate>
      <TourismBusinessContent />
    </AdminAuthGate>
  );
}

function TourismBusinessContent() {
  const [range, setRange] = useState<BusinessRangePreset>("7d");
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [overview, setOverview] = useState<SectionState<OverviewData>>(initialSectionState);
  const [locations, setLocations] = useState<SectionState<LocationData>>(initialSectionState);
  const [content, setContent] = useState<SectionState<ContentData>>(initialSectionState);
  const [search, setSearch] = useState<SectionState<SearchData>>(initialSectionState);

  const query = useMemo(() => ({ range, compare: "previous" as const }), [range]);

  const loadAll = useCallback(
    (signal: AbortSignal) => {
      const bind = <T extends { request_id: string; warnings?: BusinessWarning[] }>(
        promise: Promise<T>,
        setter: (state: SectionState<T>) => void,
        label: string,
      ) => {
        setter(initialSectionState<T>());
        void promise
          .then((result) => {
            setter({
              data: result,
              loading: false,
              error: null,
              requestId: result.request_id,
              warnings: result.warnings || [],
            });
            setLastUpdated(new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }));
          })
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === "AbortError") return;
            setter({
              data: null,
              loading: false,
              error: error instanceof AdminApiError ? error.message : `Failed to load ${label}.`,
              requestId: error instanceof AdminApiError ? error.requestId : null,
              warnings: [],
            });
          });
      };

      bind(getBusinessOverview({ ...query, signal }), setOverview, "tourism overview");
      bind(getBusinessLocations({ ...query, signal }), setLocations, "markets");
      bind(getBusinessContent({ ...query, signal }), setContent, "places and routes");
      bind(getBusinessSearch({ ...query, signal }), setSearch, "search demand");
    },
    [query],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadAll(controller.signal);
    return () => controller.abort();
  }, [loadAll, refreshKey]);

  const retry = () => setRefreshKey((value) => value + 1);
  const summary = overview.data?.summary || {};
  const deltas = (overview.data?.comparison?.deltas || {}) as Record<string, KpiDelta>;
  const periodLabel = formatRangeLabel(overview.data?.range?.start, overview.data?.range?.end, range);
  const comparisonLabel = range === "24h" ? "24h" : range;

  const marketRows = useMemo(
    () =>
      ((locations.data?.countries || []) as Array<Record<string, unknown>>).map((row) => ({
        country: String(row.country || "Unknown"),
        events: numberValue(row.events),
        sessions: numberValue(row.sessions),
        content_views: numberValue(row.content_views),
        searches: numberValue(row.searches),
      })),
    [locations.data?.countries],
  );

  const marketChartData = marketRows.slice(0, 8).map((row) => ({ label: row.country, value: row.events }));
  const placeRows = (content.data?.sections.places || []) as Array<Record<string, unknown>>;
  const routeRows = (content.data?.sections.routes || []) as Array<Record<string, unknown>>;
  const searchEntityTypes = (search.data?.breakdowns.top_search_entity_types || []).map((item) => ({
    label: entityLabel(item.value),
    value: item.count,
  }));

  const warnings = [
    ...(overview.data?.warnings || []),
    ...(locations.data?.warnings || []),
    ...(content.data?.warnings || []),
    ...(search.data?.warnings || []),
  ];
  const uniqueWarnings = [...new Map(warnings.map((item) => [item.code, item])).values()];

  return (
    <AdminPageShell
      eyebrow="Business"
      title="Tourism Business Intelligence"
      description="Destination heat, place demand, and route activity for countries, restaurants, tours, and local experiences."
      compactHeader
      actions={
        <>
          <Link className="admin-btn admin-btn--ghost admin-btn--sm" to="/admin/analytics/data">
            App Data
          </Link>
          <Link className="admin-btn admin-btn--secondary admin-btn--sm" to="/admin/analytics">
            Analytics Ops
          </Link>
        </>
      }
    >
      <div className="admin-command-strip">
        <div className="admin-command-strip__period">
          <span>Reporting period</span>
          <strong>{periodLabel}</strong>
          {lastUpdated ? <small>Updated {lastUpdated}</small> : null}
        </div>
        <div className="admin-command-strip__filters">
          <label>
            <span>Range</span>
            <select value={range} onChange={(event) => setRange(event.target.value as BusinessRangePreset)}>
              {RANGES.map((item) => (
                <option key={item} value={item}>
                  {filterLabel(`range:${item}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-command-strip__actions">
          <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={retry}>
            Refresh
          </button>
        </div>
      </div>

      {uniqueWarnings.slice(0, 3).map((warning) => (
        <InsightCallout key={warning.code} code={warning.code} message={warning.message} />
      ))}

      <ExecutiveSection
        kicker="Tourism pulse"
        title="Signals that help destinations and operators"
        subtitle="Place discovery, route travel, and local commerce intent from Explore app events."
      >
        {overview.error ? (
          <SectionError title="Tourism pulse" state={overview} onRetry={retry} />
        ) : (
          <div className="admin-executive-kpis">
            <KpiTrendCard
              metricKey="place_views"
              value={summary.place_views}
              delta={deltas.place_views}
              periodLabel={comparisonLabel}
              loading={overview.loading}
            />
            <KpiTrendCard
              metricKey="route_views"
              value={summary.route_views}
              delta={deltas.route_views}
              periodLabel={comparisonLabel}
              loading={overview.loading}
            />
            <article className="admin-kpi-card admin-kpi-card--neutral">
              <div className="admin-kpi-card__topline">
                <span>{metricLabel("route_starts")}</span>
              </div>
              {overview.loading ? <span className="admin-skeleton admin-skeleton--number" aria-label="Loading" /> : <strong>{formatNumber(summary.route_starts)}</strong>}
              <small>
                Completes {formatNumber(summary.route_completes)} · {formatRate(summary.route_completion_rate)}
              </small>
            </article>
            <article className="admin-kpi-card admin-kpi-card--neutral">
              <div className="admin-kpi-card__topline">
                <span>{metricLabel("place_commerce_actions")}</span>
              </div>
              {overview.loading ? (
                <span className="admin-skeleton admin-skeleton--number" aria-label="Loading" />
              ) : (
                <strong>{formatNumber(summary.place_commerce_actions)}</strong>
              )}
              <small>Directions · call · web · map</small>
            </article>
          </div>
        )}
      </ExecutiveSection>

      <ExecutiveSection
        kicker="Global heat"
        title="Where travelers are active"
        subtitle="Country-level heatmap from privacy-safe market metadata — useful for tourism boards and national partners."
      >
        {locations.error ? (
          <SectionError title="Global heat" state={locations} onRetry={retry} />
        ) : (
          <div className="admin-tourism-heat-grid">
            <GlobalHeatmap countries={marketRows} loading={locations.loading} />
            <ChartCard
              title="Top markets"
              subtitle="Activity by country"
              loading={locations.loading}
              empty={marketChartData.length === 0}
              emptyTitle="No markets yet"
              emptyMessage="Markets appear after events include country or locale-derived geo."
            >
              <HorizontalBarChart data={marketChartData} valueLabel="Events" ariaLabel="Top markets by events" />
            </ChartCard>
          </div>
        )}
      </ExecutiveSection>

      <ExecutiveSection
        kicker="Partner opportunities"
        title="Who this data helps"
        subtitle="Translate product signals into actions for countries, restaurants, and experience operators."
      >
        <PartnerOpportunityCards
          placeViews={numberValue(summary.place_views)}
          routeStarts={numberValue(summary.route_starts)}
          commerceActions={numberValue(summary.place_commerce_actions)}
          topMarket={marketRows[0]?.country || null}
          routeCompletion={typeof summary.route_completion_rate === "number" ? summary.route_completion_rate : null}
        />
      </ExecutiveSection>

      <ExecutiveSection
        kicker="Demand inventory"
        title="Places and routes travelers engage"
        subtitle="Ranked inventory for restaurants, venues, boat tours, and guided experiences."
      >
        {content.error ? (
          <SectionError title="Demand inventory" state={content} onRetry={retry} />
        ) : (
          <div className="admin-tourism-inventory-grid">
            <div className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <p className="admin-panel__kicker">Places</p>
                  <h3>Restaurants, venues & local businesses</h3>
                </div>
              </div>
              {content.loading ? (
                <div className="admin-skeleton admin-skeleton--block" aria-label="Loading places" />
              ) : placeRows.length === 0 ? (
                <EmptyState title="No place demand yet" message="Place rankings appear when place views and engagement events include entity_id." />
              ) : (
                <AdminDataTable label="Place demand">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Place</th>
                      <th>Views</th>
                      <th>Saves</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placeRows.slice(0, 10).map((row, index) => (
                      <tr key={String(row.entity_id)} className={index < 3 ? "is-top-ranked" : ""}>
                        <td>
                          <span className="admin-rank">{index + 1}</span>
                        </td>
                        <td>
                          <code>{shortenId(row.entity_id)}</code>
                        </td>
                        <td>{formatNumber(row.views)}</td>
                        <td>{formatNumber(row.saves)}</td>
                        <td>
                          <strong>{formatNumber(row.engagement_score)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </AdminDataTable>
              )}
            </div>
            <div className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <p className="admin-panel__kicker">Routes</p>
                  <h3>Tours, boats & multi-stop experiences</h3>
                </div>
              </div>
              {content.loading ? (
                <div className="admin-skeleton admin-skeleton--block" aria-label="Loading routes" />
              ) : routeRows.length === 0 ? (
                <EmptyState title="No route demand yet" message="Route rankings appear when route views, starts, and engagement include entity_id." />
              ) : (
                <AdminDataTable label="Route demand">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Route</th>
                      <th>Views</th>
                      <th>Starts</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routeRows.slice(0, 10).map((row, index) => (
                      <tr key={String(row.entity_id)} className={index < 3 ? "is-top-ranked" : ""}>
                        <td>
                          <span className="admin-rank">{index + 1}</span>
                        </td>
                        <td>
                          <code>{shortenId(row.entity_id)}</code>
                        </td>
                        <td>{formatNumber(row.views)}</td>
                        <td>{formatNumber(row.route_starts)}</td>
                        <td>
                          <strong>{formatNumber(row.engagement_score)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </AdminDataTable>
              )}
            </div>
          </div>
        )}
      </ExecutiveSection>

      <ExecutiveSection
        kicker="Search intent"
        title="What travelers look for"
        subtitle="Entity-type search clicks hint at demand for places vs routes vs other inventory."
      >
        {search.error ? (
          <SectionError title="Search intent" state={search} onRetry={retry} />
        ) : (
          <ChartCard
            title="Search result clicks by type"
            subtitle={`CTR ${formatRate(search.data?.summary.search_ctr)} · ${formatNumber(search.data?.summary.total_searches)} searches`}
            loading={search.loading}
            empty={searchEntityTypes.length === 0}
            emptyTitle="No search entity mix yet"
            emptyMessage="Search clicks with entity_type unlock place vs route demand mix for partners."
          >
            <HorizontalBarChart data={searchEntityTypes} valueLabel="Clicks" ariaLabel="Search result clicks by entity type" />
          </ChartCard>
        )}
      </ExecutiveSection>

      {!locations.loading && marketRows.length > 0 ? (
        <ExecutiveSection kicker="Markets detail" title="Country activity table" subtitle="Privacy-safe market rollup for tourism planning.">
          <AdminDataTable label="Country markets">
            <thead>
              <tr>
                <th>Country</th>
                <th>Events</th>
                <th>Sessions</th>
                <th>Content views</th>
                <th>Searches</th>
              </tr>
            </thead>
            <tbody>
              {marketRows.map((row) => (
                <tr key={row.country}>
                  <td>
                    <strong>{row.country}</strong>
                  </td>
                  <td>{formatNumber(row.events)}</td>
                  <td>{formatNumber(row.sessions)}</td>
                  <td>{formatNumber(row.content_views)}</td>
                  <td>{formatNumber(row.searches)}</td>
                </tr>
              ))}
            </tbody>
          </AdminDataTable>
        </ExecutiveSection>
      ) : null}
    </AdminPageShell>
  );
}
