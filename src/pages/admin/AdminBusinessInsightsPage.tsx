import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminAuthGate } from "@/pages/admin/AdminAuthGate";
import {
  AdminDataTable,
  AdminPageShell,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatCard,
  StatusBadge,
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
import { AdminApiError } from "@/lib/moderationAdminApi";

type SectionState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  requestId?: string | null;
  warnings?: BusinessWarning[];
};

const RANGES: BusinessRangePreset[] = ["24h", "7d", "30d", "90d"];

function formatNumber(value: unknown) {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat().format(value);
}

function joinError(message: string, requestId?: string | null) {
  return requestId ? `${message} Request ID: ${requestId}` : message;
}

function WarningsList({ warnings }: { warnings?: BusinessWarning[] }) {
  if (!warnings?.length) return null;
  return (
    <ul className="admin-muted">
      {warnings.map((warning) => (
        <li key={`${warning.code}-${warning.message}`}>
          <StatusBadge label={warning.severity || "warning"} tone={warning.severity === "critical" ? "red" : "amber"} />{" "}
          {warning.message}
        </li>
      ))}
    </ul>
  );
}

function DistributionList({ entries }: { entries: Array<{ value?: string; query_hash?: string; count: number }> }) {
  if (!entries.length) return <EmptyState title="No data" message="Counts will appear as events arrive." />;
  const max = Math.max(1, ...entries.map((entry) => entry.count));
  return (
    <div className="admin-distribution-list">
      {entries.map((entry) => {
        const label = entry.value || entry.query_hash || "unknown";
        return (
          <div className="admin-distribution-row" key={label}>
            <span>{label}</span>
            <div className="admin-distribution-row__bar" aria-hidden="true">
              <span style={{ width: `${Math.max(4, (entry.count / max) * 100)}%` }} />
            </div>
            <strong>{formatNumber(entry.count)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function ContentTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
}) {
  if (!rows.length) return <EmptyState title={`No ${title}`} message="Entity events will appear here." />;
  return (
    <AdminDataTable label={title}>
      <thead>
        <tr>
          <th>Entity</th>
          <th>Views</th>
          <th>Likes</th>
          <th>Saves</th>
          <th>Shares</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={String(row.entity_id)}>
            <td><code>{String(row.entity_id_short || row.entity_id)}</code></td>
            <td>{formatNumber(row.views)}</td>
            <td>{formatNumber(row.likes)}</td>
            <td>{formatNumber(row.saves)}</td>
            <td>{formatNumber(row.shares)}</td>
            <td>{formatNumber(row.engagement_score)}</td>
          </tr>
        ))}
      </tbody>
    </AdminDataTable>
  );
}

function AdminBusinessInsightsContent() {
  const [range, setRange] = useState<BusinessRangePreset>("7d");
  const [refreshKey, setRefreshKey] = useState(0);
  const [overview, setOverview] = useState<SectionState<Awaited<ReturnType<typeof getBusinessOverview>>>>({
    data: null,
    loading: true,
    error: null,
  });
  const [growth, setGrowth] = useState<SectionState<Awaited<ReturnType<typeof getBusinessGrowth>>>>({
    data: null,
    loading: true,
    error: null,
  });
  const [funnel, setFunnel] = useState<SectionState<Awaited<ReturnType<typeof getBusinessFunnel>>>>({
    data: null,
    loading: true,
    error: null,
  });
  const [content, setContent] = useState<SectionState<Awaited<ReturnType<typeof getBusinessContent>>>>({
    data: null,
    loading: true,
    error: null,
  });
  const [search, setSearch] = useState<SectionState<Awaited<ReturnType<typeof getBusinessSearch>>>>({
    data: null,
    loading: true,
    error: null,
  });
  const [creators, setCreators] = useState<SectionState<Awaited<ReturnType<typeof getBusinessCreators>>>>({
    data: null,
    loading: true,
    error: null,
  });
  const [locations, setLocations] = useState<SectionState<Awaited<ReturnType<typeof getBusinessLocations>>>>({
    data: null,
    loading: true,
    error: null,
  });
  const [investor, setInvestor] = useState<SectionState<Awaited<ReturnType<typeof getInvestorSnapshot>>>>({
    data: null,
    loading: true,
    error: null,
  });
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const loadAll = useCallback(
    (signal: AbortSignal) => {
      const bind = <T,>(
        promise: Promise<T & { request_id: string; warnings?: BusinessWarning[] }>,
        setter: (state: SectionState<T>) => void,
        label: string,
      ) => {
        setter({ data: null, loading: true, error: null, requestId: null, warnings: [] });
        void promise
          .then((result) =>
            setter({
              data: result,
              loading: false,
              error: null,
              requestId: result.request_id,
              warnings: result.warnings || [],
            }),
          )
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

      bind(getBusinessOverview({ range, signal }), setOverview, "overview");
      bind(getBusinessGrowth({ range, signal }), setGrowth, "growth");
      bind(getBusinessFunnel({ range, signal }), setFunnel, "funnel");
      bind(getBusinessContent({ range, signal }), setContent, "content");
      bind(getBusinessSearch({ range, signal }), setSearch, "search");
      bind(getBusinessCreators({ range, signal }), setCreators, "creators");
      bind(getBusinessLocations({ range, signal }), setLocations, "locations");
      bind(getInvestorSnapshot({ range, signal }), setInvestor, "investor snapshot");
    },
    [range],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadAll(controller.signal);
    return () => controller.abort();
  }, [loadAll, refreshKey]);

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

  const summary = overview.data?.summary || {};

  return (
    <AdminPageShell
      eyebrow="Insights"
      title="Business Analytics"
      description="Product, growth, content, and investor-readable analytics."
      actions={
        <div className="admin-page-header__actions">
          <Link className="admin-btn admin-btn--ghost" to="/admin/analytics">
            Operations
          </Link>
          <label className="admin-inline-field">
            <span>Range</span>
            <select value={range} onChange={(event) => setRange(event.target.value as BusinessRangePreset)}>
              {RANGES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setRefreshKey((value) => value + 1)}>
            Refresh
          </button>
        </div>
      }
    >
      <section className="admin-panel">
        <SectionHeader kicker="Overview" title="Business summary" />
        {overview.error ? (
          <ErrorState title="Overview unavailable" message={joinError(overview.error, overview.requestId)} />
        ) : overview.loading ? (
          <LoadingState rows={4} />
        ) : (
          <>
            <div className="admin-stats-grid">
              <StatCard label="Active users estimate" value={formatNumber(Number(summary.active_anonymous_ids || 0) + Number(summary.active_authenticated_users || 0))} />
              <StatCard label="Sessions" value={formatNumber(summary.active_sessions)} />
              <StatCard label="App opens" value={formatNumber(summary.app_opens)} />
              <StatCard label="Content views" value={formatNumber(summary.content_views_total)} />
              <StatCard label="Searches" value={formatNumber(summary.searches_total)} />
              <StatCard label="Engagement actions" value={formatNumber(Number(summary.likes_total || 0) + Number(summary.saves_total || 0) + Number(summary.shares_total || 0))} />
              <StatCard label="Dead letters" value={formatNumber(summary.dead_letters_total)} tone="amber" />
            </div>
            <WarningsList warnings={overview.warnings} />
          </>
        )}
      </section>

      <section className="admin-panel">
        <SectionHeader kicker="Growth" title="Daily activity" />
        {growth.error ? (
          <ErrorState title="Growth unavailable" message={joinError(growth.error, growth.requestId)} />
        ) : growth.loading ? (
          <LoadingState rows={4} />
        ) : (
          <>
            <div className="admin-stats-grid">
              <StatCard label="New anonymous (est.)" value={formatNumber(growth.data?.summary.estimated_new_anonymous_ids)} />
              <StatCard label="Returning anonymous (est.)" value={formatNumber(growth.data?.summary.estimated_returning_anonymous_ids)} />
              <StatCard label="New authenticated (est.)" value={formatNumber(growth.data?.summary.estimated_new_authenticated_users)} />
              <StatCard label="Returning authenticated (est.)" value={formatNumber(growth.data?.summary.estimated_returning_authenticated_users)} />
            </div>
            <DistributionList entries={(growth.data?.breakdowns.platform_split || []).map((item) => ({ value: item.value, count: item.count }))} />
            <WarningsList warnings={growth.warnings} />
          </>
        )}
      </section>

      <section className="admin-panel">
        <SectionHeader kicker="Funnel" title="Engagement funnel" />
        {funnel.error ? (
          <ErrorState title="Funnel unavailable" message={joinError(funnel.error, funnel.requestId)} />
        ) : funnel.loading ? (
          <LoadingState rows={4} />
        ) : (
          <>
            <AdminDataTable label="Funnel steps">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Count</th>
                  <th>Sessions</th>
                  <th>Dropoff</th>
                </tr>
              </thead>
              <tbody>
                {(funnel.data?.funnel || []).map((step) => (
                  <tr key={step.key}>
                    <td>{step.label}</td>
                    <td>{formatNumber(step.count)}</td>
                    <td>{formatNumber(step.unique_sessions)}</td>
                    <td>{step.dropoff_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </AdminDataTable>
            <WarningsList warnings={funnel.warnings} />
          </>
        )}
      </section>

      <section className="admin-panel">
        <SectionHeader kicker="Content" title="Top content performance" />
        {content.error ? (
          <ErrorState title="Content unavailable" message={joinError(content.error, content.requestId)} />
        ) : content.loading ? (
          <LoadingState rows={4} />
        ) : (
          <div className="admin-dashboard-layout">
            <ContentTable title="videos" rows={(content.data?.sections.videos || []) as Array<Record<string, unknown>>} />
            <ContentTable title="places" rows={(content.data?.sections.places || []) as Array<Record<string, unknown>>} />
            <ContentTable title="routes" rows={(content.data?.sections.routes || []) as Array<Record<string, unknown>>} />
            <ContentTable title="profiles" rows={(content.data?.sections.profiles || []) as Array<Record<string, unknown>>} />
            <WarningsList warnings={content.warnings} />
          </div>
        )}
      </section>

      <section className="admin-panel">
        <SectionHeader kicker="Search" title="Search quality (hashed only)" />
        {search.error ? (
          <ErrorState title="Search unavailable" message={joinError(search.error, search.requestId)} />
        ) : search.loading ? (
          <LoadingState rows={4} />
        ) : (
          <>
            <div className="admin-stats-grid">
              <StatCard label="Total searches" value={formatNumber(search.data?.summary.total_searches)} />
              <StatCard label="No-result rate" value={`${search.data?.summary.no_result_rate ?? 0}%`} />
              <StatCard label="Search → content view (est.)" value={`${search.data?.summary.search_to_content_view_estimate ?? 0}%`} />
            </div>
            <DistributionList entries={search.data?.breakdowns.top_query_hashes || []} />
            <WarningsList warnings={search.warnings} />
          </>
        )}
      </section>

      <section className="admin-panel">
        <SectionHeader kicker="Creators" title="Creator performance" />
        {creators.error ? (
          <ErrorState title="Creators unavailable" message={joinError(creators.error, creators.requestId)} />
        ) : creators.loading ? (
          <LoadingState rows={3} />
        ) : (creators.data?.creators || []).length === 0 ? (
          <>
            <EmptyState title="Creator metrics unavailable" message="creator_id is not present in analytics events yet." />
            <WarningsList warnings={creators.warnings} />
          </>
        ) : (
          <>
            <AdminDataTable label="Creators">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Views</th>
                  <th>Likes</th>
                  <th>Saves</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {(creators.data?.creators || []).map((row) => (
                  <tr key={String(row.creator_id)}>
                    <td><code>{String(row.creator_id_short || row.creator_id)}</code></td>
                    <td>{formatNumber(row.views)}</td>
                    <td>{formatNumber(row.likes)}</td>
                    <td>{formatNumber(row.saves)}</td>
                    <td>{formatNumber(row.engagement_score)}</td>
                  </tr>
                ))}
              </tbody>
            </AdminDataTable>
            <WarningsList warnings={creators.warnings} />
          </>
        )}
      </section>

      <section className="admin-panel">
        <SectionHeader kicker="Locations" title="Market interest (aggregated only)" />
        {locations.error ? (
          <ErrorState title="Locations unavailable" message={joinError(locations.error, locations.requestId)} />
        ) : locations.loading ? (
          <LoadingState rows={3} />
        ) : (
          <>
            <DistributionList
              entries={(locations.data?.countries || []).map((item) => ({
                value: String(item.country),
                count: Number(item.events || 0),
              }))}
            />
            <p className="admin-muted">Cities require at least {locations.data?.summary.min_city_threshold || 3} events.</p>
            <WarningsList warnings={locations.warnings} />
          </>
        )}
      </section>

      <section className="admin-panel">
        <SectionHeader kicker="Investor" title="Investor snapshot" />
        {investor.error ? (
          <ErrorState title="Snapshot unavailable" message={joinError(investor.error, investor.requestId)} />
        ) : investor.loading ? (
          <LoadingState rows={3} />
        ) : (
          <>
            <pre className="admin-code-block">{investor.data?.copy_text}</pre>
            <button type="button" className="admin-btn admin-btn--secondary" onClick={() => void copyInvestorSnapshot()}>
              Copy investor snapshot
            </button>
            {copyMessage && <p className="admin-muted">{copyMessage}</p>}
            <WarningsList warnings={investor.warnings} />
          </>
        )}
      </section>
    </AdminPageShell>
  );
}

export function AdminBusinessInsightsPage() {
  return (
    <AdminAuthGate>
      <AdminBusinessInsightsContent />
    </AdminAuthGate>
  );
}
