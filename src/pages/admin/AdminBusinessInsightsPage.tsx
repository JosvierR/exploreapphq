import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminAuthGate } from "@/pages/admin/AdminAuthGate";
import {
  AdminDataTable,
  AdminPageShell,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
} from "@/features/admin/components/AdminPrimitives";
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
  formatNumber,
  formatPercent,
  formatRangeLabel,
  formatTrend,
  metricLabel,
  shortenId,
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

type SectionState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  requestId?: string | null;
  warnings?: BusinessWarning[];
};

const RANGES: BusinessRangePreset[] = ["24h", "7d", "30d", "90d"];
const PLATFORMS = ["all", "ios", "android", "web"] as const;
const SOURCES = ["all", "mobile", "web", "backend", "admin"] as const;
const CONTENT_TYPES = ["all", "video", "place", "route", "profile"] as const;

function joinError(message: string, requestId?: string | null) {
  return requestId ? `${message} If this continues, check logs with request_id: ${requestId}` : message;
}

function InsightCallout({ code, message }: { code: string; message?: string }) {
  const copy = warningCopy(code, message);
  return (
    <div className="admin-panel admin-panel--nested">
      <h4>{copy.title}</h4>
      <p className="admin-muted">{copy.body}</p>
      {copy.action && <p className="admin-muted">{copy.action}</p>}
    </div>
  );
}

function SimpleBarChart({
  points,
  valueKey,
  labelKey = "day",
}: {
  points: Array<Record<string, unknown>>;
  valueKey: string;
  labelKey?: string;
}) {
  if (!points.length) return <EmptyState title="No chart data yet" message="Activity will appear here as events arrive." />;
  const max = Math.max(1, ...points.map((point) => Number(point[valueKey] || 0)));
  return (
    <div className="admin-distribution-list">
      {points.map((point) => {
        const label = String(point[labelKey] || "");
        const value = Number(point[valueKey] || 0);
        return (
          <div className="admin-distribution-row" key={`${label}-${valueKey}`}>
            <span>{label}</span>
            <div className="admin-distribution-row__bar" aria-hidden="true">
              <span style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
            </div>
            <strong>{formatNumber(value)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function MetricCard({
  metricKey,
  value,
  delta,
  loading,
}: {
  metricKey: string;
  value: unknown;
  delta?: { percent: number | null; absolute: number; label?: string | null };
  loading?: boolean;
}) {
  const trend = formatTrend(delta);
  return (
    <article className="admin-stat-card">
      <span className="admin-stat-card__label">{metricLabel(metricKey)}</span>
      {loading ? (
        <span className="admin-skeleton admin-skeleton--number" aria-label="Loading" />
      ) : (
        <strong>{formatNumber(value)}</strong>
      )}
      {trend && <span className="admin-stat-card__hint">{trend}</span>}
    </article>
  );
}

function SectionShell({
  kicker,
  title,
  subtitle,
  loading,
  error,
  requestId,
  onRetry,
  exportRows,
  exportName,
  children,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  loading: boolean;
  error: string | null;
  requestId?: string | null;
  onRetry: () => void;
  exportRows?: Array<Record<string, unknown>>;
  exportName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-panel">
      <SectionHeader
        kicker={kicker}
        title={title}
        meta={
          exportRows && exportName ? (
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              onClick={() => downloadCsv(exportName, exportRows)}
            >
              Export CSV
            </button>
          ) : null
        }
      />
      <p className="admin-muted">{subtitle}</p>
      {error ? (
        <div>
          <ErrorState title={`${title} could not load`} message={joinError(error, requestId)} />
          <button type="button" className="admin-btn admin-btn--secondary" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : loading ? (
        <LoadingState rows={4} />
      ) : (
        children
      )}
    </section>
  );
}

function AdminBusinessInsightsContent() {
  const [range, setRange] = useState<BusinessRangePreset>("7d");
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("all");
  const [source, setSource] = useState<(typeof SOURCES)[number]>("all");
  const [entityType, setEntityType] = useState<(typeof CONTENT_TYPES)[number]>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const [overview, setOverview] = useState<SectionState<any>>({ data: null, loading: true, error: null });
  const [growth, setGrowth] = useState<SectionState<any>>({ data: null, loading: true, error: null });
  const [funnel, setFunnel] = useState<SectionState<any>>({ data: null, loading: true, error: null });
  const [content, setContent] = useState<SectionState<any>>({ data: null, loading: true, error: null });
  const [search, setSearch] = useState<SectionState<any>>({ data: null, loading: true, error: null });
  const [creators, setCreators] = useState<SectionState<any>>({ data: null, loading: true, error: null });
  const [locations, setLocations] = useState<SectionState<any>>({ data: null, loading: true, error: null });
  const [investor, setInvestor] = useState<SectionState<any>>({ data: null, loading: true, error: null });

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
      const bind = (promise: Promise<any>, setter: (state: SectionState<any>) => void, label: string) => {
        setter({ data: null, loading: true, error: null, requestId: null, warnings: [] });
        void promise
          .then((result) => {
            setter({
              data: result,
              loading: false,
              error: null,
              requestId: result.request_id,
              warnings: result.warnings || [],
            });
            setLastUpdated(new Date().toLocaleString());
          })
          .catch((error) =>
            setter({
              data: null,
              loading: false,
              error: error instanceof AdminApiError ? error.message : `Failed to load ${label}.`,
              requestId: error instanceof AdminApiError ? error.requestId : null,
              warnings: [],
            }),
          );
      };

      bind(getBusinessOverview({ ...query, signal }), setOverview, "executive summary");
      bind(getBusinessGrowth({ ...query, signal }), setGrowth, "growth");
      bind(getBusinessFunnel({ ...query, signal }), setFunnel, "funnel");
      bind(getBusinessContent({ ...query, signal }), setContent, "content");
      bind(getBusinessSearch({ ...query, signal }), setSearch, "search");
      bind(getBusinessCreators({ ...query, signal }), setCreators, "creators");
      bind(getBusinessLocations({ ...query, signal }), setLocations, "locations");
      bind(getInvestorSnapshot({ ...query, signal }), setInvestor, "investor snapshot");
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
  const deltas = overview.data?.comparison?.deltas || {};
  const periodLabel = formatRangeLabel(overview.data?.range?.start, overview.data?.range?.end, range);

  const qualityItems = useMemo(() => {
    const warnings = [
      ...(overview.warnings || []),
      ...(creators.warnings || []),
      ...(locations.warnings || []),
      ...(search.warnings || []),
      ...(content.warnings || []),
    ];
    const codes = new Set(warnings.map((item) => item.code));
    return [
      {
        label: "Mobile events",
        status: codes.has("no_mobile_events_in_range") || codes.has("no_events_in_range") ? "Needs data" : "Healthy",
      },
      {
        label: "Web events",
        status: Number(summary.total_events || 0) > 0 ? "Healthy" : "Needs data",
      },
      {
        label: "Rejected events",
        status: Number(summary.dead_letters_total || 0) > 0 ? "Warning" : "Healthy",
      },
      {
        label: "Creator metadata",
        status: codes.has("creator_id_not_in_analytics_events") ? "Needs data" : "Healthy",
      },
      {
        label: "Location metadata",
        status: codes.has("location_metadata_missing") ? "Needs data" : "Healthy",
      },
      {
        label: "Content entity IDs",
        status: codes.has("no_content_entity_id") ? "Needs data" : "Healthy",
      },
      {
        label: "Search privacy",
        status: "Healthy",
      },
    ];
  }, [overview.warnings, creators.warnings, locations.warnings, search.warnings, content.warnings, summary]);

  async function copyInvestorSnapshot() {
    const text = investor.data?.copy_text;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Investor snapshot copied.");
    } catch {
      setCopyMessage("Could not copy snapshot.");
    }
  }

  return (
    <AdminPageShell
      eyebrow="Business Insights"
      title="Business Analytics"
      description="Readable product, growth, content, and investor analytics."
      actions={
        <div className="admin-page-header__actions">
          <Link className="admin-btn admin-btn--ghost" to="/admin/analytics">
            Analytics Ops
          </Link>
          <label className="admin-inline-field">
            <span>Range</span>
            <select value={range} onChange={(event) => setRange(event.target.value as BusinessRangePreset)}>
              {RANGES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="admin-inline-field">
            <span>Platform</span>
            <select value={platform} onChange={(event) => setPlatform(event.target.value as (typeof PLATFORMS)[number])}>
              {PLATFORMS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="admin-inline-field">
            <span>Source</span>
            <select value={source} onChange={(event) => setSource(event.target.value as (typeof SOURCES)[number])}>
              {SOURCES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="admin-inline-field">
            <span>Content</span>
            <select value={entityType} onChange={(event) => setEntityType(event.target.value as (typeof CONTENT_TYPES)[number])}>
              {CONTENT_TYPES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={retry}>
            Refresh
          </button>
        </div>
      }
    >
      <p className="admin-muted">Period: {periodLabel}{lastUpdated ? ` · Last updated ${lastUpdated}` : ""}</p>

      <SectionShell
        kicker="Executive Summary"
        title="Executive Summary"
        subtitle="High-level view of how Explore is being used during the selected period."
        loading={overview.loading}
        error={overview.error}
        requestId={overview.requestId}
        onRetry={retry}
        exportRows={overview.data ? flattenBusinessOverview(overview.data) : undefined}
        exportName={`explore-business-overview-${range}.csv`}
      >
        <div className="admin-stats-grid">
          <MetricCard metricKey="active_users_estimate" value={summary.active_users_estimate} delta={deltas.active_users_estimate} />
          <MetricCard metricKey="sessions" value={summary.active_sessions} delta={deltas.active_sessions} />
          <MetricCard metricKey="app_opens" value={summary.app_opens} delta={deltas.app_opens} />
          <MetricCard metricKey="content_views" value={summary.content_views_total} delta={deltas.content_views_total} />
          <MetricCard metricKey="searches" value={summary.searches_total} delta={deltas.searches_total} />
          <MetricCard metricKey="engagement_actions" value={summary.engagement_actions} delta={deltas.engagement_actions} />
          <MetricCard metricKey="dead_letters" value={summary.dead_letters_total} delta={deltas.dead_letters_total} />
        </div>
        {(overview.warnings || []).map((item) => (
          <InsightCallout key={item.code} code={item.code} message={item.message} />
        ))}
      </SectionShell>

      <SectionShell
        kicker="Growth & Usage"
        title="Growth & Usage"
        subtitle="Tracks users, sessions, app opens, and platform activity."
        loading={growth.loading}
        error={growth.error}
        requestId={growth.requestId}
        onRetry={retry}
        exportRows={growth.data ? flattenGrowthSeries(growth.data) : undefined}
        exportName={`explore-growth-${range}.csv`}
      >
        <SimpleBarChart points={growth.data?.series || []} valueKey="sessions" />
        <SimpleBarChart points={growth.data?.series || []} valueKey="app_opens" />
        <DistributionList
          title="Platform split"
          entries={(growth.data?.breakdowns?.platform_split || []).map((item: any) => ({
            label: item.value,
            count: item.count,
          }))}
        />
      </SectionShell>

      <SectionShell
        kicker="Engagement Funnel"
        title="Engagement Funnel"
        subtitle="Shows how users move from opening the app to viewing and interacting with content."
        loading={funnel.loading}
        error={funnel.error}
        requestId={funnel.requestId}
        onRetry={retry}
        exportRows={funnel.data ? flattenFunnel(funnel.data) : undefined}
        exportName={`explore-funnel-${range}.csv`}
      >
        <AdminDataTable label="Funnel">
          <thead>
            <tr>
              <th>Step</th>
              <th>Count</th>
              <th>Sessions</th>
              <th>Dropoff</th>
            </tr>
          </thead>
          <tbody>
            {(funnel.data?.funnel || []).map((step: any) => (
              <tr key={step.key}>
                <td>{step.label}</td>
                <td>{formatNumber(step.count)}</td>
                <td>{formatNumber(step.unique_sessions)}</td>
                <td>{formatPercent(step.dropoff_pct)}</td>
              </tr>
            ))}
          </tbody>
        </AdminDataTable>
        <SimpleBarChart
          points={(funnel.data?.funnel || []).map((step: any) => ({ day: step.label, count: step.count }))}
          valueKey="count"
        />
      </SectionShell>

      <SectionShell
        kicker="Content Performance"
        title="Content Performance"
        subtitle="Ranks videos, places, routes, and profiles by views and engagement."
        loading={content.loading}
        error={content.error}
        requestId={content.requestId}
        onRetry={retry}
        exportRows={content.data ? flattenContentPerformance(content.data) : undefined}
        exportName={`explore-content-performance-${range}.csv`}
      >
        {["videos", "places", "routes", "profiles"].map((type) => {
          const rows = content.data?.sections?.[type] || [];
          if (!rows.length) {
            return <InsightCallout key={type} code="no_content_entity_id" />;
          }
          return (
            <AdminDataTable key={type} label={type}>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Type</th>
                  <th>Content ID</th>
                  <th>Views</th>
                  <th>Likes</th>
                  <th>Saves</th>
                  <th>Shares</th>
                  <th>Reports</th>
                  <th>Engagement score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any, index: number) => (
                  <tr key={`${type}-${row.entity_id}`}>
                    <td>{index + 1}</td>
                    <td>{entityLabel(row.entity_type)}</td>
                    <td><code>{shortenId(row.entity_id)}</code></td>
                    <td>{formatNumber(row.views)}</td>
                    <td>{formatNumber(row.likes)}</td>
                    <td>{formatNumber(row.saves)}</td>
                    <td>{formatNumber(row.shares)}</td>
                    <td>{formatNumber(row.reports)}</td>
                    <td>{formatNumber(row.engagement_score)}</td>
                  </tr>
                ))}
              </tbody>
            </AdminDataTable>
          );
        })}
      </SectionShell>

      <SectionShell
        kicker="Search Intelligence"
        title="Search Intelligence"
        subtitle="Shows search demand and search quality without exposing raw search text."
        loading={search.loading}
        error={search.error}
        requestId={search.requestId}
        onRetry={retry}
        exportRows={search.data ? flattenSearchInsights(search.data) : undefined}
        exportName={`explore-search-${range}.csv`}
      >
        <div className="admin-stats-grid">
          <MetricCard metricKey="searches" value={search.data?.summary?.total_searches} />
          <MetricCard metricKey="no_result_rate" value={formatPercent(search.data?.summary?.no_result_rate)} />
        </div>
        <AdminDataTable label="Search fingerprints">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Search fingerprint</th>
              <th>Searches</th>
            </tr>
          </thead>
          <tbody>
            {(search.data?.breakdowns?.top_query_hashes || []).map((row: any, index: number) => (
              <tr key={row.query_hash}>
                <td>{index + 1}</td>
                <td><code>{row.query_hash}</code></td>
                <td>{formatNumber(row.count)}</td>
              </tr>
            ))}
          </tbody>
        </AdminDataTable>
        {(search.warnings || []).map((item) => (
          <InsightCallout key={item.code} code={item.code} message={item.message} />
        ))}
      </SectionShell>

      <SectionShell
        kicker="Creator Insights"
        title="Creator Insights"
        subtitle="Shows which creators are generating views and engagement when creator metadata is available."
        loading={creators.loading}
        error={creators.error}
        requestId={creators.requestId}
        onRetry={retry}
      >
        {(creators.data?.creators || []).length === 0 ? (
          <InsightCallout code="creator_id_not_in_analytics_events" />
        ) : (
          <AdminDataTable label="Creators">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Creator ID</th>
                <th>Views</th>
                <th>Saves</th>
                <th>Likes</th>
                <th>Shares</th>
                <th>Reports</th>
                <th>Engagement score</th>
              </tr>
            </thead>
            <tbody>
              {(creators.data?.creators || []).map((row: any, index: number) => (
                <tr key={row.creator_id}>
                  <td>{index + 1}</td>
                  <td><code>{shortenId(row.creator_id)}</code></td>
                  <td>{formatNumber(row.views)}</td>
                  <td>{formatNumber(row.saves)}</td>
                  <td>{formatNumber(row.likes)}</td>
                  <td>{formatNumber(row.shares)}</td>
                  <td>{formatNumber(row.reports)}</td>
                  <td>{formatNumber(row.engagement_score)}</td>
                </tr>
              ))}
            </tbody>
          </AdminDataTable>
        )}
      </SectionShell>

      <SectionShell
        kicker="Market Insights"
        title="Market Insights"
        subtitle="Aggregated country, region, and city interest. Exact locations are never shown."
        loading={locations.loading}
        error={locations.error}
        requestId={locations.requestId}
        onRetry={retry}
        exportRows={locations.data ? flattenLocations(locations.data) : undefined}
        exportName={`explore-markets-${range}.csv`}
      >
        {(locations.data?.countries || []).length === 0 ? (
          <InsightCallout code="location_metadata_missing" />
        ) : (
          <AdminDataTable label="Markets">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Country</th>
                <th>Events</th>
                <th>Sessions</th>
                <th>Content views</th>
                <th>Searches</th>
              </tr>
            </thead>
            <tbody>
              {(locations.data?.countries || []).map((row: any, index: number) => (
                <tr key={row.country}>
                  <td>{index + 1}</td>
                  <td>{row.country}</td>
                  <td>{formatNumber(row.events)}</td>
                  <td>{formatNumber(row.sessions)}</td>
                  <td>{formatNumber(row.content_views)}</td>
                  <td>{formatNumber(row.searches)}</td>
                </tr>
              ))}
            </tbody>
          </AdminDataTable>
        )}
        <p className="admin-muted">Cities require at least {locations.data?.summary?.min_city_threshold || 3} events.</p>
      </SectionShell>

      <SectionShell
        kicker="Investor Snapshot"
        title="Investor Snapshot"
        subtitle="Copy-ready summary for updates, incubator reports, and investor conversations."
        loading={investor.loading}
        error={investor.error}
        requestId={investor.requestId}
        onRetry={retry}
        exportRows={investor.data ? flattenInvestorSnapshot(investor.data) : undefined}
        exportName={`explore-investor-snapshot-${range}.csv`}
      >
        <pre className="admin-code-block">{investor.data?.copy_text}</pre>
        <button type="button" className="admin-btn admin-btn--secondary" onClick={() => void copyInvestorSnapshot()}>
          Copy investor snapshot
        </button>
        {copyMessage && <p className="admin-muted">{copyMessage}</p>}
      </SectionShell>

      <section className="admin-panel">
        <SectionHeader kicker="Data Quality" title="Data Quality" />
        <p className="admin-muted">Explains missing data, instrumentation gaps, and whether mobile analytics are active.</p>
        <div className="admin-stats-grid">
          {qualityItems.map((item) => (
            <article className="admin-stat-card" key={item.label}>
              <span className="admin-stat-card__label">{item.label}</span>
              <strong>{item.status}</strong>
            </article>
          ))}
        </div>
        {(overview.warnings || []).map((item) => (
          <InsightCallout key={`quality-${item.code}`} code={item.code} message={item.message} />
        ))}
      </section>
    </AdminPageShell>
  );
}

function DistributionList({
  title,
  entries,
}: {
  title?: string;
  entries: Array<{ label: string; count: number }>;
}) {
  if (!entries.length) return null;
  const max = Math.max(1, ...entries.map((entry) => entry.count));
  return (
    <div>
      {title && <h4>{title}</h4>}
      <div className="admin-distribution-list">
        {entries.map((entry) => (
          <div className="admin-distribution-row" key={entry.label}>
            <span>{eventLabel(entry.label)}</span>
            <div className="admin-distribution-row__bar" aria-hidden="true">
              <span style={{ width: `${Math.max(4, (entry.count / max) * 100)}%` }} />
            </div>
            <strong>{formatNumber(entry.count)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminBusinessInsightsPage() {
  return (
    <AdminAuthGate>
      <AdminBusinessInsightsContent />
    </AdminAuthGate>
  );
}
