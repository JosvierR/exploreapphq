import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AdminAuthGate } from "@/features/admin/components/AdminAuthGate";
import { AdminDataTable, AdminPageShell, EmptyState, ErrorState } from "@/features/admin/components/AdminPrimitives";
import { AreaTrendChart } from "@/features/admin/components/charts/AreaTrendChart";
import { ChartCard } from "@/features/admin/components/charts/ChartCard";
import { DonutBreakdownChart } from "@/features/admin/components/charts/DonutBreakdownChart";
import { FunnelChart, type FunnelDatum } from "@/features/admin/components/charts/FunnelChart";
import { HorizontalBarChart } from "@/features/admin/components/charts/HorizontalBarChart";
import { KpiTrendCard, type KpiDelta } from "@/features/admin/components/charts/KpiTrendCard";
import { chartColors } from "@/features/admin/components/charts/chartTheme";
import {
  type BusinessRangePreset,
  type BusinessWarning,
  getBusinessContent,
  getBusinessCreators,
  getBusinessFunnel,
  getBusinessGrowth,
  getBusinessLocations,
  getBusinessOverview,
  getBusinessSearch,
  getInvestorSnapshot,
} from "@/lib/adminAnalyticsApi";
import {
  entityLabel,
  eventLabel,
  filterLabel,
  formatNumber,
  formatPercent,
  formatRangeLabel,
  metricLabel,
  platformLabel,
  shortenId,
  sourceLabel,
  warningCopy,
} from "@/lib/analyticsDisplay";
import {
  downloadCsv,
  flattenBusinessOverview,
  flattenContentPerformance,
  flattenFunnel,
  flattenGrowthSeries,
  flattenInvestorSnapshot,
  flattenLocations,
  flattenSearchInsights,
} from "@/lib/csvExport";
import { AdminApiError } from "@/lib/moderationAdminApi";

type OverviewData = Awaited<ReturnType<typeof getBusinessOverview>>;
type GrowthData = Awaited<ReturnType<typeof getBusinessGrowth>>;
type FunnelData = Awaited<ReturnType<typeof getBusinessFunnel>>;
type ContentData = Awaited<ReturnType<typeof getBusinessContent>>;
type SearchData = Awaited<ReturnType<typeof getBusinessSearch>>;
type CreatorData = Awaited<ReturnType<typeof getBusinessCreators>>;
type LocationData = Awaited<ReturnType<typeof getBusinessLocations>>;
type InvestorData = Awaited<ReturnType<typeof getInvestorSnapshot>>;
type ContentTab = "videos" | "places" | "routes" | "profiles";
type QualityStatus = "Healthy" | "Needs data" | "Warning";

type SectionState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  requestId?: string | null;
  warnings: BusinessWarning[];
};

const RANGES: BusinessRangePreset[] = ["24h", "7d", "30d", "90d"];
const PLATFORMS = ["all", "ios", "android", "web"] as const;
const SOURCES = ["all", "mobile", "web", "backend", "admin"] as const;
const CONTENT_TYPES = ["all", "video", "place", "route", "profile"] as const;
const CONTENT_TABS: ContentTab[] = ["videos", "places", "routes", "profiles"];

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

function arrayValue<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
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

function SectionError({ title, state, onRetry }: { title: string; state: SectionState<unknown>; onRetry: () => void }) {
  if (!state.error) return null;
  return (
    <ErrorState
      title={`${title} could not load`}
      message={joinError(state.error, state.requestId)}
      onRetry={onRetry}
    />
  );
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

function exportButton(label: string, fileName: string, rows: Array<Record<string, unknown>>) {
  return (
    <button type="button" className="admin-btn admin-btn--ghost" onClick={() => downloadCsv(fileName, rows)} disabled={!rows.length}>
      {label}
    </button>
  );
}

function buildUsageInsight(delta?: KpiDelta) {
  if (!delta || delta.percent == null) return "A previous-period baseline is needed before growth can be called.";
  if (delta.percent > 0) return `Usage grew ${delta.percent}% versus the previous period.`;
  if (delta.percent < 0) return `Usage declined ${Math.abs(delta.percent)}% versus the previous period; review the daily trend.`;
  return "Usage held steady versus the previous period.";
}

function buildFunnelInsight(data: FunnelDatum[]) {
  if (data.length < 2) return "More journey events are needed to identify the main conversion gap.";
  const biggest = data.slice(1).reduce((current, item) => (item.dropoff > current.dropoff ? item : current));
  const index = data.findIndex((item) => item.key === biggest.key);
  return `Biggest drop: ${data[index - 1].label} → ${biggest.label} (−${biggest.dropoff}%).`;
}

function buildSearchInsight(total: number, rate: number) {
  if (total === 0) return "Search activity has not been captured for this period yet.";
  if (rate <= 10) return `Search quality is healthy: ${rate}% of searches returned no results.`;
  if (rate <= 25) return `${rate}% of searches returned no results; watch the leading fingerprints.`;
  return `Search needs attention: ${rate}% of searches returned no results.`;
}

function AdminBusinessInsightsContent() {
  const [range, setRange] = useState<BusinessRangePreset>("7d");
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("all");
  const [source, setSource] = useState<(typeof SOURCES)[number]>("all");
  const [entityType, setEntityType] = useState<(typeof CONTENT_TYPES)[number]>("all");
  const [contentTab, setContentTab] = useState<ContentTab>("videos");
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const [overview, setOverview] = useState<SectionState<OverviewData>>(initialSectionState);
  const [growth, setGrowth] = useState<SectionState<GrowthData>>(initialSectionState);
  const [funnel, setFunnel] = useState<SectionState<FunnelData>>(initialSectionState);
  const [content, setContent] = useState<SectionState<ContentData>>(initialSectionState);
  const [search, setSearch] = useState<SectionState<SearchData>>(initialSectionState);
  const [creators, setCreators] = useState<SectionState<CreatorData>>(initialSectionState);
  const [locations, setLocations] = useState<SectionState<LocationData>>(initialSectionState);
  const [investor, setInvestor] = useState<SectionState<InvestorData>>(initialSectionState);

  const query = useMemo(
    () => ({
      range,
      platform: platform === "all" ? undefined : platform,
      source: source === "all" ? undefined : source,
      entity_type: entityType === "all" ? undefined : entityType,
      compare: "previous" as const,
    }),
    [range, platform, source, entityType],
  );

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

      bind(getBusinessOverview({ ...query, signal }), setOverview, "executive summary");
      bind(getBusinessGrowth({ ...query, signal }), setGrowth, "growth");
      bind(getBusinessFunnel({ ...query, signal }), setFunnel, "funnel");
      bind(getBusinessContent({ ...query, signal }), setContent, "content");
      bind(getBusinessSearch({ ...query, signal }), setSearch, "search");
      bind(getBusinessCreators({ ...query, signal }), setCreators, "creators");
      bind(getBusinessLocations({ ...query, signal }), setLocations, "markets");
      bind(getInvestorSnapshot({ ...query, signal }), setInvestor, "investor snapshot");
    },
    [query],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadAll(controller.signal);
    return () => controller.abort();
  }, [loadAll, refreshKey]);

  useEffect(() => {
    if (entityType !== "all") setContentTab(`${entityType}s` as ContentTab);
  }, [entityType]);

  const retry = () => setRefreshKey((value) => value + 1);
  const summary = overview.data?.summary || {};
  const deltas = (overview.data?.comparison?.deltas || {}) as Record<string, KpiDelta>;
  const periodLabel = formatRangeLabel(overview.data?.range?.start, overview.data?.range?.end, range);
  const comparisonLabel = range === "24h" ? "24h" : range;

  const growthSeries = useMemo(
    () =>
      (growth.data?.series || []).map((point) => ({
        ...point,
        active_users_estimate: numberValue(point.active_anonymous_ids) + numberValue(point.active_authenticated_users),
        active_sessions: numberValue(point.sessions),
        content_views_total: numberValue(point.content_views),
        searches_total: numberValue(point.searches),
      })),
    [growth.data?.series],
  );

  const platformData = useMemo(
    () =>
      (growth.data?.breakdowns.platform_split || []).map((item) => ({
        label: platformLabel(item.value),
        value: item.count,
      })),
    [growth.data?.breakdowns.platform_split],
  );

  const funnelData = useMemo<FunnelDatum[]>(
    () =>
      (funnel.data?.funnel || []).map((step) => ({
        key: step.key,
        label: eventLabel(step.key),
        value: step.count,
        sessions: step.unique_sessions,
        dropoff: step.dropoff_pct,
      })),
    [funnel.data?.funnel],
  );

  const contentRows = (content.data?.sections[contentTab] || []) as Array<Record<string, unknown>>;
  const creatorRows = (creators.data?.creators || []) as Array<Record<string, unknown>>;
  const marketRows = (locations.data?.countries || []) as Array<Record<string, unknown>>;
  const marketChartData = marketRows.slice(0, 7).map((row) => ({ label: String(row.country || "Unknown"), value: numberValue(row.events) }));
  const searchTotal = numberValue(search.data?.summary.total_searches);
  const noResultRate = numberValue(search.data?.summary.no_result_rate);

  const allWarnings = useMemo(() => {
    const warnings = [overview, growth, funnel, content, search, creators, locations, investor].flatMap((state) => state.warnings);
    return warnings.filter((item, index) => warnings.findIndex((candidate) => candidate.code === item.code) === index);
  }, [overview, growth, funnel, content, search, creators, locations, investor]);

  const warningCodes = useMemo(() => new Set(allWarnings.map((item) => item.code)), [allWarnings]);
  const qualityItems = useMemo<Array<{ label: string; status: QualityStatus; detail: string }>>(
    () => [
      {
        label: "Mobile events",
        status: warningCodes.has("no_mobile_events_in_range") || warningCodes.has("no_events_in_range") ? "Needs data" : "Healthy",
        detail: "App and journey events",
      },
      {
        label: "Web events",
        status: numberValue(summary.total_events) > 0 ? "Healthy" : "Needs data",
        detail: "Browser activity in range",
      },
      {
        label: "Rejected events",
        status: numberValue(summary.dead_letters_total) > 0 ? "Warning" : "Healthy",
        detail: `${formatNumber(summary.dead_letters_total)} rejected`,
      },
      {
        label: "Creator metadata",
        status: warningCodes.has("creator_id_not_in_analytics_events") ? "Needs data" : "Healthy",
        detail: "Attribution coverage",
      },
      {
        label: "Market metadata",
        status: warningCodes.has("location_metadata_missing") ? "Needs data" : "Healthy",
        detail: "Privacy-safe geography",
      },
      {
        label: "Content IDs",
        status: warningCodes.has("no_content_entity_id") || warningCodes.has("content_entities_missing") ? "Needs data" : "Healthy",
        detail: "Ranking coverage",
      },
    ],
    [summary, warningCodes],
  );

  async function copyInvestorSnapshot() {
    const text = investor.data?.copy_text;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Investor snapshot copied.");
    } catch {
      setCopyMessage("The snapshot could not be copied. Try again from a secure browser context.");
    }
  }

  const overviewRows = overview.data ? flattenBusinessOverview(overview.data) : [];
  const investorRows = investor.data ? flattenInvestorSnapshot(investor.data) : [];

  return (
    <AdminPageShell
      eyebrow="Business Insights"
      title="Business Command Center"
      description="Know what moved, where users drop, and what deserves action in under 30 seconds."
      actions={<Link className="admin-btn admin-btn--ghost" to="/admin/analytics">Analytics Ops</Link>}
    >
      <div className="admin-command-strip">
        <div className="admin-command-strip__period">
          <span>Reporting period</span>
          <strong>{periodLabel}</strong>
          <small>{lastUpdated ? `Updated ${lastUpdated}` : "Updating now"}</small>
        </div>
        <div className="admin-command-strip__filters" aria-label="Business insight filters">
          <label>
            <span>Range</span>
            <select value={range} onChange={(event) => setRange(event.target.value as BusinessRangePreset)}>
              {RANGES.map((item) => <option key={item} value={item}>{filterLabel(`range:${item}`)}</option>)}
            </select>
          </label>
          <label>
            <span>Platform</span>
            <select value={platform} onChange={(event) => setPlatform(event.target.value as (typeof PLATFORMS)[number])}>
              {PLATFORMS.map((item) => <option key={item} value={item}>{item === "all" ? filterLabel("platform:all") : platformLabel(item)}</option>)}
            </select>
          </label>
          <label>
            <span>Source</span>
            <select value={source} onChange={(event) => setSource(event.target.value as (typeof SOURCES)[number])}>
              {SOURCES.map((item) => <option key={item} value={item}>{item === "all" ? filterLabel("source:all") : sourceLabel(item)}</option>)}
            </select>
          </label>
          <label>
            <span>Content</span>
            <select value={entityType} onChange={(event) => setEntityType(event.target.value as (typeof CONTENT_TYPES)[number])}>
              {CONTENT_TYPES.map((item) => <option key={item} value={item}>{item === "all" ? filterLabel("content:all") : entityLabel(item)}</option>)}
            </select>
          </label>
        </div>
        <div className="admin-command-strip__actions">
          <button type="button" className="admin-btn admin-btn--secondary" onClick={retry}>Refresh</button>
          {exportButton("Export overview", `explore-business-overview-${range}.csv`, overviewRows)}
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void copyInvestorSnapshot()} disabled={!investor.data?.copy_text}>
            Copy snapshot
          </button>
        </div>
      </div>
      {copyMessage && <p className="admin-copy-feedback" role="status">{copyMessage}</p>}

      <ExecutiveSection
        kicker="01 · Company pulse"
        title="The numbers that matter now"
        subtitle={buildUsageInsight(deltas.active_sessions)}
      >
        {overview.error ? (
          <SectionError title="Company pulse" state={overview} onRetry={retry} />
        ) : (
          <div className="admin-executive-kpis">
            <KpiTrendCard metricKey="active_users_estimate" value={summary.active_users_estimate} delta={deltas.active_users_estimate} periodLabel={comparisonLabel} loading={overview.loading} sparkline={growthSeries} />
            <KpiTrendCard metricKey="active_sessions" value={summary.active_sessions} delta={deltas.active_sessions} periodLabel={comparisonLabel} loading={overview.loading} sparkline={growthSeries} />
            <KpiTrendCard metricKey="app_opens" value={summary.app_opens} delta={deltas.app_opens} periodLabel={comparisonLabel} loading={overview.loading} sparkline={growthSeries} />
            <KpiTrendCard metricKey="content_views_total" value={summary.content_views_total} delta={deltas.content_views_total} periodLabel={comparisonLabel} loading={overview.loading} sparkline={growthSeries} />
            <KpiTrendCard metricKey="searches_total" value={summary.searches_total} delta={deltas.searches_total} periodLabel={comparisonLabel} loading={overview.loading} sparkline={growthSeries} />
            <KpiTrendCard metricKey="engagement_actions" value={summary.engagement_actions} delta={deltas.engagement_actions} periodLabel={comparisonLabel} loading={overview.loading} />
          </div>
        )}
      </ExecutiveSection>

      <ExecutiveSection
        kicker="02 · Growth story"
        title="Is usage accelerating?"
        subtitle="Daily sessions and app opens show whether product usage is gaining momentum."
        action={growth.data ? exportButton("Export growth", `explore-growth-${range}.csv`, flattenGrowthSeries(growth.data)) : undefined}
      >
        {growth.error ? (
          <SectionError title="Growth story" state={growth} onRetry={retry} />
        ) : (
          <div className="admin-growth-grid">
            <ChartCard
              title="Usage over the selected period"
              subtitle="Sessions and app opens by day"
              insight={buildUsageInsight(deltas.active_sessions)}
              loading={growth.loading}
              empty={growthSeries.length === 0}
              emptyTitle="No usage trend yet"
              emptyMessage="Daily usage appears after app-open and session events arrive. Release an instrumented build, generate activity, then refresh."
              className="admin-growth-grid__trend"
            >
              <AreaTrendChart
                data={growthSeries}
                series={[
                  { key: "sessions", label: metricLabel("sessions"), color: chartColors.primary },
                  { key: "app_opens", label: metricLabel("app_opens"), color: chartColors.secondary },
                ]}
              />
            </ChartCard>
            <ChartCard
              title="By platform"
              subtitle="Where tracked activity originates"
              loading={growth.loading}
              empty={platformData.length === 0}
              emptyTitle="No platform split yet"
              emptyMessage="Platform mix appears when events include iOS, Android, or Web metadata."
            >
              <DonutBreakdownChart data={platformData} valueLabel={metricLabel("events")} ariaLabel="Events by platform" />
            </ChartCard>
          </div>
        )}
      </ExecutiveSection>

      <ExecutiveSection
        kicker="03 · Engagement"
        title="Where users fall out of the journey"
        subtitle="The largest step-down is the clearest place to focus product work."
        action={funnel.data ? exportButton("Export funnel", `explore-funnel-${range}.csv`, flattenFunnel(funnel.data)) : undefined}
      >
        {funnel.error ? (
          <SectionError title="Engagement funnel" state={funnel} onRetry={retry} />
        ) : (
          <ChartCard
            title="Engagement funnel"
            subtitle="From app open to high-intent action"
            insight={buildFunnelInsight(funnelData)}
            loading={funnel.loading}
            empty={funnelData.every((item) => item.value === 0)}
            emptyTitle="The journey has no measurable activity"
            emptyMessage="Capture app opens, screen views, content views, and actions to reveal conversion gaps."
          >
            <FunnelChart data={funnelData} />
          </ChartCard>
        )}
        {funnel.warnings.map((item) => <InsightCallout key={item.code} code={item.code} message={item.message} />)}
      </ExecutiveSection>

      <ExecutiveSection
        kicker="04 · Content"
        title="What earns attention"
        subtitle="Ranked content reveals which formats and items create meaningful engagement."
        action={content.data ? exportButton("Export content", `explore-content-performance-${range}.csv`, flattenContentPerformance(content.data)) : undefined}
      >
        {content.error ? (
          <SectionError title="Content performance" state={content} onRetry={retry} />
        ) : (
          <ChartCard
            title="Content performance"
            subtitle={`Top ${entityLabel(contentTab).toLowerCase()} by views and engagement`}
            insight={contentRows.length ? `${entityLabel(contentTab).slice(0, -1)} ${shortenId(contentRows[0].entity_id)} is leading this period.` : null}
            loading={content.loading}
            empty={contentRows.length === 0}
            emptyTitle={`No ranked ${entityLabel(contentTab).toLowerCase()} yet`}
            emptyMessage="Rankings need both content type and content ID on view and engagement events. Add that metadata, generate activity, then refresh."
            actions={
              <div className="admin-content-tabs" role="tablist" aria-label="Content type">
                {CONTENT_TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={contentTab === tab}
                    className={contentTab === tab ? "is-active" : ""}
                    onClick={() => setContentTab(tab)}
                  >
                    {entityLabel(tab)}
                  </button>
                ))}
              </div>
            }
          >
            <ContentPerformanceTable rows={contentRows} type={contentTab} />
          </ChartCard>
        )}
      </ExecutiveSection>

      <ExecutiveSection
        kicker="05 · Demand & reach"
        title="What people want—and where"
        subtitle="Search quality exposes unmet demand while markets show where Explore is resonating."
      >
        <div className="admin-demand-grid">
          <ChartCard
            title="Search quality"
            subtitle="Demand signals without exposing raw searches"
            insight={buildSearchInsight(searchTotal, noResultRate)}
            loading={search.loading}
            empty={!search.error && searchTotal === 0}
            emptyTitle="No searches in this period"
            emptyMessage="Search demand appears after submitted-search events arrive with privacy-safe fingerprints. Raw search text is never displayed."
            actions={search.data ? exportButton("Export", `explore-search-${range}.csv`, flattenSearchInsights(search.data)) : undefined}
          >
            {search.error ? (
              <SectionError title="Search quality" state={search} onRetry={retry} />
            ) : (
              <SearchPanel data={search.data} total={searchTotal} noResultRate={noResultRate} />
            )}
          </ChartCard>

          <ChartCard
            title="Top markets"
            subtitle="Privacy-safe activity by country"
            insight={marketChartData.length ? `${marketChartData[0].label} leads tracked activity with ${formatNumber(marketChartData[0].value)} events.` : null}
            loading={locations.loading}
            empty={!locations.error && marketChartData.length === 0}
            emptyTitle="Market coverage is not available yet"
            emptyMessage="Add country-level metadata to analytics events. Keep exact coordinates out of analytics payloads."
            actions={locations.data ? exportButton("Export", `explore-markets-${range}.csv`, flattenLocations(locations.data)) : undefined}
          >
            {locations.error ? (
              <SectionError title="Top markets" state={locations} onRetry={retry} />
            ) : (
              <HorizontalBarChart data={marketChartData} valueLabel={metricLabel("events")} color={chartColors.secondary} ariaLabel="Top countries by events" />
            )}
          </ChartCard>

          {creatorRows.length > 0 && (
            <ChartCard
              title="Creator momentum"
              subtitle="Creators driving views and engagement"
              insight={`${shortenId(creatorRows[0].creator_id)} leads creator performance this period.`}
              loading={creators.loading}
              className="admin-demand-grid__wide"
            >
              <CreatorPerformanceTable rows={creatorRows.slice(0, 8)} />
            </ChartCard>
          )}
        </div>
      </ExecutiveSection>

      <ExecutiveSection
        kicker="06 · Investor view"
        title="A presentation-ready snapshot"
        subtitle="A concise, privacy-safe summary for updates, board conversations, and fundraising."
      >
        {investor.error ? (
          <SectionError title="Investor snapshot" state={investor} onRetry={retry} />
        ) : (
          <InvestorSnapshotCard
            data={investor.data}
            loading={investor.loading}
            onCopy={() => void copyInvestorSnapshot()}
            onExport={() => downloadCsv(`explore-investor-snapshot-${range}.csv`, investorRows)}
          />
        )}
      </ExecutiveSection>

      <ExecutiveSection
        kicker="07 · Trust"
        title="Can we trust this read?"
        subtitle="Coverage and ingest checks show where decisions need more instrumentation."
      >
        <div className="admin-quality-grid">
          {qualityItems.map((item) => <QualityCard key={item.label} {...item} />)}
        </div>
        {allWarnings.length > 0 ? (
          <div className="admin-quality-callouts">
            {allWarnings.map((item) => <InsightCallout key={`quality-${item.code}`} code={item.code} message={item.message} />)}
          </div>
        ) : (
          <p className="admin-quality-clear">No major data-quality blockers were detected in this period.</p>
        )}
      </ExecutiveSection>
    </AdminPageShell>
  );
}

function ContentPerformanceTable({ rows, type }: { rows: Array<Record<string, unknown>>; type: ContentTab }) {
  return (
    <AdminDataTable label={`${entityLabel(type)} performance`}>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Type</th>
          <th>Content ID</th>
          <th>Views</th>
          <th>Likes</th>
          <th>Saves</th>
          <th>Shares</th>
          <th>Engagement</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${type}-${String(row.entity_id)}`} className={index < 3 ? "is-top-ranked" : ""}>
            <td><span className="admin-rank">{index + 1}</span></td>
            <td>{entityLabel(String(row.entity_type || type.slice(0, -1)))}</td>
            <td><code>{shortenId(row.entity_id)}</code></td>
            <td>{formatNumber(row.views)}</td>
            <td>{formatNumber(row.likes)}</td>
            <td>{formatNumber(row.saves)}</td>
            <td>{formatNumber(row.shares)}</td>
            <td><strong>{formatNumber(row.engagement_score)}</strong></td>
          </tr>
        ))}
      </tbody>
    </AdminDataTable>
  );
}

function SearchPanel({ data, total, noResultRate }: { data: SearchData | null; total: number; noResultRate: number }) {
  const rows = data?.breakdowns.top_query_hashes || [];
  return (
    <div className="admin-search-panel">
      <div className="admin-search-panel__summary">
        <div><span>{metricLabel("total_searches")}</span><strong>{formatNumber(total)}</strong></div>
        <div className={noResultRate > 25 ? "is-warning" : ""}><span>{metricLabel("no_result_rate")}</span><strong>{formatPercent(noResultRate)}</strong></div>
      </div>
      {rows.length ? (
        <AdminDataTable label="Search fingerprints">
          <thead><tr><th>Rank</th><th>Search fingerprint</th><th>Searches</th></tr></thead>
          <tbody>
            {rows.slice(0, 7).map((row, index) => (
              <tr key={row.query_hash}><td>{index + 1}</td><td><code>{shortenId(row.query_hash)}</code></td><td>{formatNumber(row.count)}</td></tr>
            ))}
          </tbody>
        </AdminDataTable>
      ) : (
        <EmptyState title="No search fingerprints yet" message="Fingerprints appear when submitted-search events include the privacy-safe query hash." />
      )}
    </div>
  );
}

function CreatorPerformanceTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  return (
    <AdminDataTable label="Creator performance">
      <thead><tr><th>Rank</th><th>Creator ID</th><th>Views</th><th>Saves</th><th>Likes</th><th>Shares</th><th>Engagement</th></tr></thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={String(row.creator_id)} className={index < 3 ? "is-top-ranked" : ""}>
            <td><span className="admin-rank">{index + 1}</span></td>
            <td><code>{shortenId(row.creator_id)}</code></td>
            <td>{formatNumber(row.views)}</td>
            <td>{formatNumber(row.saves)}</td>
            <td>{formatNumber(row.likes)}</td>
            <td>{formatNumber(row.shares)}</td>
            <td><strong>{formatNumber(row.engagement_score)}</strong></td>
          </tr>
        ))}
      </tbody>
    </AdminDataTable>
  );
}

function InvestorSnapshotCard({
  data,
  loading,
  onCopy,
  onExport,
}: {
  data: InvestorData | null;
  loading: boolean;
  onCopy: () => void;
  onExport: () => void;
}) {
  const snapshot = data?.snapshot || {};
  const metrics = ["active_users_estimate", "sessions", "events", "content_views", "searches", "engagement_actions"];
  const notes = arrayValue<string>(snapshot.data_quality_notes);

  return (
    <article className="admin-investor-card">
      <header>
        <div><p>Explore Analytics Snapshot</p><h3>{data?.period ? filterLabel(`range:${data.range.preset}`) : "Selected period"}</h3></div>
        <div><button type="button" className="admin-btn admin-btn--secondary" onClick={onCopy} disabled={!data?.copy_text}>Copy</button><button type="button" className="admin-btn admin-btn--ghost" onClick={onExport} disabled={!data}>Export</button></div>
      </header>
      {loading ? (
        <div className="admin-chart-skeleton" aria-label="Loading investor snapshot"><span /><span /><span /></div>
      ) : !data ? (
        <EmptyState title="Snapshot not ready" message="The investor summary appears after analytics activity is available." />
      ) : (
        <>
          <div className="admin-investor-card__metrics">
            {metrics.map((key) => <div key={key}><span>{metricLabel(key)}</span><strong>{formatNumber(snapshot[key])}</strong></div>)}
          </div>
          <div className="admin-investor-card__notes">
            <span>Data-quality notes</span>
            <div>{notes.length ? notes.map((note) => <small key={note}>{note}</small>) : <small>No major blockers detected</small>}</div>
          </div>
        </>
      )}
    </article>
  );
}

function QualityCard({ label, status, detail }: { label: string; status: QualityStatus; detail: string }) {
  const tone = status === "Healthy" ? "healthy" : status === "Warning" ? "warning" : "needs-data";
  return (
    <article className={`admin-quality-card admin-quality-card--${tone}`}>
      <span className="admin-quality-card__status"><i aria-hidden="true" />{status}</span>
      <strong>{label}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function AdminBusinessInsightsPage() {
  return (
    <AdminAuthGate>
      <AdminBusinessInsightsContent />
    </AdminAuthGate>
  );
}
