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
  StatCard,
  StatusBadge,
} from "@/features/admin/components/AdminPrimitives";
import {
  type AnalyticsDeadLetterRow,
  type AnalyticsDeadLetterSummary,
  type AnalyticsEventRow,
  type AnalyticsHealth,
  type AnalyticsOverview,
  type AnalyticsQualityWarning,
  type AnalyticsRange,
  type AnalyticsSearchInsights,
  type AnalyticsTimeseries,
  type AnalyticsWarning,
  type BreakdownEntry,
  type TopContentItem,
  fetchAnalyticsDeadLetters,
  fetchAnalyticsEventDetail,
  fetchAnalyticsEvents,
  fetchAnalyticsHealth,
  fetchAnalyticsOverview,
  fetchAnalyticsSearch,
  fetchAnalyticsTimeseries,
  fetchAnalyticsTopContent,
  runAnalyticsAggregation,
} from "@/lib/adminAnalyticsApi";
import { AdminApiError } from "@/lib/moderationAdminApi";

type SectionState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  requestId?: string | null;
  warnings?: AnalyticsWarning[];
};

const RANGES: AnalyticsRange[] = ["24h", "7d", "30d"];

function formatNumber(value: number | string | null | undefined) {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function healthTone(status: string) {
  if (status === "healthy") return "green" as const;
  if (status === "critical") return "red" as const;
  return "amber" as const;
}

function DistributionList({ entries, loading }: { entries: BreakdownEntry[]; loading: boolean }) {
  const max = Math.max(1, ...entries.map((entry) => entry.count));
  if (loading) return <LoadingState rows={4} />;
  if (entries.length === 0) return <EmptyState title="No data" message="Counts will appear as events arrive." />;
  return (
    <div className="admin-distribution-list">
      {entries.map((entry) => (
        <div className="admin-distribution-row" key={entry.value}>
          <span>{entry.value}</span>
          <div className="admin-distribution-row__bar" aria-hidden="true">
            <span style={{ width: `${Math.max(4, (entry.count / max) * 100)}%` }} />
          </div>
          <strong>{formatNumber(entry.count)}</strong>
        </div>
      ))}
    </div>
  );
}

function TimeseriesChart({ points, loading }: { points: Array<{ day: string; count: number }>; loading: boolean }) {
  const max = Math.max(1, ...points.map((point) => point.count));
  if (loading) return <LoadingState rows={5} />;
  if (points.length === 0) return <EmptyState title="No timeseries data" message="Try a wider range or wait for events." />;
  return (
    <div className="admin-distribution-list">
      {points.map((point) => (
        <div className="admin-distribution-row" key={point.day}>
          <span>{point.day}</span>
          <div className="admin-distribution-row__bar" aria-hidden="true">
            <span style={{ width: `${Math.max(4, (point.count / max) * 100)}%` }} />
          </div>
          <strong>{formatNumber(point.count)}</strong>
        </div>
      ))}
    </div>
  );
}

function joinErrorMessage(message: string, requestId?: string | null) {
  return requestId ? `${message} Request ID: ${requestId}` : message;
}

function WarningMeta({ warnings }: { warnings?: AnalyticsWarning[] }) {
  if (!warnings || warnings.length === 0) return null;
  return <StatusBadge label={`${warnings.length} warning${warnings.length === 1 ? "" : "s"}`} tone="amber" />;
}

function TopContentTable({ items, loading }: { items: TopContentItem[]; loading: boolean }) {
  if (loading) return <LoadingState rows={4} />;
  if (items.length === 0) return <EmptyState title="No top content" message="Entity events will appear here." />;
  return (
    <AdminDataTable label="Top content">
      <thead>
        <tr>
          <th>Type</th>
          <th>Entity ID</th>
          <th>Events</th>
          <th>Last event</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={`${item.entity_type}-${item.entity_id}`}>
            <td>{item.entity_type}</td>
            <td><code>{item.entity_id}</code></td>
            <td>{formatNumber(item.event_count ?? item.impressions ?? item.clicks)}</td>
            <td>{formatDate(item.last_event_at)}</td>
          </tr>
        ))}
      </tbody>
    </AdminDataTable>
  );
}

function AdminAnalyticsContent() {
  const [range, setRange] = useState<AnalyticsRange>("7d");
  const [refreshKey, setRefreshKey] = useState(0);
  const [overview, setOverview] = useState<SectionState<AnalyticsOverview>>({ data: null, loading: true, error: null, requestId: null, warnings: [] });
  const [timeseries, setTimeseries] = useState<SectionState<AnalyticsTimeseries>>({ data: null, loading: true, error: null, requestId: null, warnings: [] });
  const [topContent, setTopContent] = useState<SectionState<{
    videos: TopContentItem[];
    places: TopContentItem[];
    routes: TopContentItem[];
    profiles: TopContentItem[];
  }>>({ data: null, loading: true, error: null, requestId: null, warnings: [] });
  const [search, setSearch] = useState<SectionState<AnalyticsSearchInsights>>({ data: null, loading: true, error: null, requestId: null, warnings: [] });
  const [health, setHealth] = useState<SectionState<AnalyticsHealth>>({
    data: null,
    loading: true,
    error: null,
    requestId: null,
    warnings: [],
  });
  const [events, setEvents] = useState<SectionState<{ rows: AnalyticsEventRow[]; total: number }>>({
    data: null,
    loading: true,
    error: null,
    requestId: null,
    warnings: [],
  });
  const [deadLetters, setDeadLetters] = useState<SectionState<{ rows: AnalyticsDeadLetterRow[]; total: number; summary?: AnalyticsDeadLetterSummary }>>({
    data: null,
    loading: true,
    error: null,
    requestId: null,
    warnings: [],
  });
  const [eventFilters, setEventFilters] = useState({
    event_name: "",
    source: "",
    platform: "",
    entity_type: "",
    auth: "" as "" | "authenticated" | "anonymous",
    q: "",
  });
  const [eventOffset, setEventOffset] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AnalyticsEventRow | null>(null);
  const [aggregateMessage, setAggregateMessage] = useState<string | null>(null);
  const [aggregateLoading, setAggregateLoading] = useState(false);

  const loadAll = useCallback(
    (signal: AbortSignal) => {
      setOverview((state) => ({ ...state, loading: true, error: null, requestId: null, warnings: [] }));
      setTimeseries((state) => ({ ...state, loading: true, error: null, requestId: null, warnings: [] }));
      setTopContent((state) => ({ ...state, loading: true, error: null, requestId: null, warnings: [] }));
      setSearch((state) => ({ ...state, loading: true, error: null, requestId: null, warnings: [] }));
      setHealth((state) => ({ ...state, loading: true, error: null, requestId: null, warnings: [] }));
      setEvents((state) => ({ ...state, loading: true, error: null, requestId: null, warnings: [] }));
      setDeadLetters((state) => ({ ...state, loading: true, error: null, requestId: null, warnings: [] }));

      void fetchAnalyticsOverview({ range, signal })
        .then((result) => setOverview({ data: result.overview, loading: false, error: null, requestId: result.request_id, warnings: result.warnings || [] }))
        .catch((error) =>
          setOverview({
            data: null,
            loading: false,
            error: error instanceof AdminApiError ? error.message : "Failed to load overview.",
            requestId: error instanceof AdminApiError ? error.requestId : null,
            warnings: [],
          }),
        );

      void fetchAnalyticsTimeseries({ range, signal })
        .then((result) => setTimeseries({ data: result.timeseries, loading: false, error: null, requestId: result.request_id, warnings: result.warnings || [] }))
        .catch((error) =>
          setTimeseries({
            data: null,
            loading: false,
            error: error instanceof AdminApiError ? error.message : "Failed to load timeseries.",
            requestId: error instanceof AdminApiError ? error.requestId : null,
            warnings: [],
          }),
        );

      void fetchAnalyticsTopContent({ range, signal })
        .then((result) => setTopContent({ data: result.top_content, loading: false, error: null, requestId: result.request_id, warnings: result.warnings || [] }))
        .catch((error) =>
          setTopContent({
            data: null,
            loading: false,
            error: error instanceof AdminApiError ? error.message : "Failed to load top content.",
            requestId: error instanceof AdminApiError ? error.requestId : null,
            warnings: [],
          }),
        );

      void fetchAnalyticsSearch({ range, signal })
        .then((result) => setSearch({ data: result.search, loading: false, error: null, requestId: result.request_id, warnings: result.warnings || [] }))
        .catch((error) =>
          setSearch({
            data: null,
            loading: false,
            error: error instanceof AdminApiError ? error.message : "Failed to load search insights.",
            requestId: error instanceof AdminApiError ? error.requestId : null,
            warnings: [],
          }),
        );

      void fetchAnalyticsHealth(signal)
        .then((result) =>
          setHealth({
            data: {
              ...result.health,
              status: result.status || result.health.status,
              quality_warnings: result.quality_warnings || result.health.quality_warnings || [],
              aggregation_freshness: result.aggregation_freshness || result.health.aggregation_freshness,
            },
            loading: false,
            error: null,
            requestId: result.request_id,
            warnings: result.warnings || [],
          }),
        )
        .catch((error) =>
          setHealth({
            data: null,
            loading: false,
            error: error instanceof AdminApiError ? error.message : "Failed to load health.",
            requestId: error instanceof AdminApiError ? error.requestId : null,
            warnings: [],
          }),
        );

      void fetchAnalyticsEvents({
        range,
        offset: eventOffset,
        event_name: eventFilters.event_name || undefined,
        source: eventFilters.source || undefined,
        platform: eventFilters.platform || undefined,
        entity_type: eventFilters.entity_type || undefined,
        auth: eventFilters.auth || undefined,
        q: eventFilters.q || undefined,
        signal,
      })
        .then((result) =>
          setEvents({
            data: { rows: result.events, total: result.pagination.total },
            loading: false,
            error: null,
            requestId: result.request_id,
            warnings: result.warnings || [],
          }),
        )
        .catch((error) =>
          setEvents({
            data: null,
            loading: false,
            error: error instanceof AdminApiError ? error.message : "Failed to load events.",
            requestId: error instanceof AdminApiError ? error.requestId : null,
            warnings: [],
          }),
        );

      void fetchAnalyticsDeadLetters({ range, signal })
        .then((result) =>
          setDeadLetters({
            data: {
              rows: result.items || result.dead_letters,
              total: result.pagination.total,
              summary: result.summary,
            },
            loading: false,
            error: null,
            requestId: result.request_id,
            warnings: result.warnings || [],
          }),
        )
        .catch((error) =>
          setDeadLetters({
            data: null,
            loading: false,
            error: error instanceof AdminApiError ? error.message : "Failed to load dead letters.",
            requestId: error instanceof AdminApiError ? error.requestId : null,
            warnings: [],
          }),
        );
    },
    [eventFilters, eventOffset, range],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadAll(controller.signal);
    return () => controller.abort();
  }, [loadAll, refreshKey]);

  useEffect(() => {
    const onRefresh = () => setRefreshKey((value) => value + 1);
    window.addEventListener("admin:refresh", onRefresh);
    return () => window.removeEventListener("admin:refresh", onRefresh);
  }, []);

  useEffect(() => {
    if (!selectedEventId) {
      setSelectedEvent(null);
      return;
    }
    const controller = new AbortController();
    void fetchAnalyticsEventDetail(selectedEventId, controller.signal)
      .then((result) => setSelectedEvent(result.event))
      .catch(() => setSelectedEvent(null));
    return () => controller.abort();
  }, [selectedEventId]);

  const overviewCards = useMemo(() => {
    const data = overview.data;
    if (!data) return [];
    return [
      { label: "Events today", value: formatNumber(data.events_today), tone: "blue" as const },
      { label: "Events 24h", value: formatNumber(data.events_last_24h), tone: "blue" as const },
      { label: "Events 7d", value: formatNumber(data.events_last_7d), tone: "purple" as const },
      { label: "Anonymous IDs 24h", value: formatNumber(data.active_anonymous_ids), tone: "slate" as const },
      { label: "Auth users 24h", value: formatNumber(data.active_authenticated_users), tone: "green" as const },
      { label: "Sessions 24h", value: formatNumber(data.sessions), tone: "slate" as const },
      { label: "Avg events / session", value: formatNumber(data.avg_events_per_session), tone: "slate" as const },
      { label: "Dead letters 24h", value: formatNumber(data.dead_letters_last_24h), tone: "amber" as const },
    ];
  }, [overview.data]);

  async function handleAggregate(input: { day?: string; preset?: "today" | "yesterday" | "last_7_days" }) {
    setAggregateLoading(true);
    setAggregateMessage(null);
    try {
      const result = await runAnalyticsAggregation(
        input.preset ? { preset: input.preset } : { day: input.day || new Date().toISOString().slice(0, 10) },
      );
      const okDays = (result.days || []).filter((item) => item.ok).map((item) => item.day);
      const failed = (result.days || []).filter((item) => !item.ok);
      if (failed.length > 0) {
        setAggregateMessage(
          `Aggregation partial failure for ${failed.map((item) => item.day).join(", ")}. Request ID: ${result.request_id}`,
        );
      } else {
        setAggregateMessage(`Aggregation completed for ${okDays.join(", ") || "selected days"}.`);
      }
      setRefreshKey((value) => value + 1);
    } catch (error) {
      const message = error instanceof AdminApiError ? error.message : "Aggregation failed.";
      const requestId = error instanceof AdminApiError ? error.requestId : null;
      setAggregateMessage(requestId ? `${message} Request ID: ${requestId}` : message);
    } finally {
      setAggregateLoading(false);
    }
  }

  const qualityWarnings: AnalyticsQualityWarning[] = health.data?.quality_warnings || [];
  const freshness = health.data?.aggregation_freshness;

  return (
    <AdminPageShell
      eyebrow="Insights"
      title="Analytics Ops"
      description="Operational health, cron, dead letters, and raw event explorer."
      actions={
        <div className="admin-page-header__actions">
          <Link className="admin-btn admin-btn--ghost" to="/admin/analytics/business">
            Business Insights
          </Link>
          <label className="admin-inline-field">
            <span>Range</span>
            <select value={range} onChange={(event) => setRange(event.target.value as AnalyticsRange)}>
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
        <SectionHeader kicker="Overview" title="Core metrics" meta={overview.warnings?.length ? <WarningMeta warnings={overview.warnings} /> : health.data ? <StatusBadge label={health.data.status} tone={healthTone(health.data.status)} /> : null} />
        {overview.error ? <ErrorState title="Overview unavailable" message={joinErrorMessage(overview.error, overview.requestId)} /> : (
          <div className="admin-stats-grid">
            {overviewCards.map((card) => (
              <StatCard key={card.label} label={card.label} value={card.value} tone={card.tone} loading={overview.loading} />
            ))}
          </div>
        )}
      </section>

      <div className="admin-dashboard-layout">
        <section className="admin-panel">
          <SectionHeader kicker="Timeseries" title="Events by day" meta={<WarningMeta warnings={timeseries.warnings} />} />
          {timeseries.error ? <ErrorState title="Timeseries unavailable" message={joinErrorMessage(timeseries.error, timeseries.requestId)} /> : (
            <TimeseriesChart points={timeseries.data?.events_by_day || []} loading={timeseries.loading} />
          )}
        </section>

        <section className="admin-panel">
          <SectionHeader kicker="Breakdown" title="Event names" />
          <DistributionList entries={overview.data?.breakdowns.event_name || []} loading={overview.loading} />
        </section>

        <section className="admin-panel">
          <SectionHeader kicker="Breakdown" title="Source" />
          <DistributionList entries={overview.data?.breakdowns.source || []} loading={overview.loading} />
        </section>

        <section className="admin-panel">
          <SectionHeader kicker="Breakdown" title="Platform" />
          <DistributionList entries={overview.data?.breakdowns.platform || []} loading={overview.loading} />
        </section>
      </div>

      <section className="admin-panel">
        <SectionHeader kicker="Top content" title="Videos, places, routes, profiles" />
        {topContent.error ? <ErrorState title="Top content unavailable" message={joinErrorMessage(topContent.error, topContent.requestId)} /> : (
          <div className="admin-dashboard-layout">
            <TopContentTable items={topContent.data?.videos || []} loading={topContent.loading} />
            <TopContentTable items={topContent.data?.places || []} loading={topContent.loading} />
            <TopContentTable items={topContent.data?.routes || []} loading={topContent.loading} />
            <TopContentTable items={topContent.data?.profiles || []} loading={topContent.loading} />
          </div>
        )}
      </section>

      <section className="admin-panel">
        <SectionHeader kicker="Search" title="Search insights (hashed only)" />
        {search.error ? <ErrorState title="Search insights unavailable" message={joinErrorMessage(search.error, search.requestId)} /> : search.loading ? (
          <LoadingState rows={4} />
        ) : (
          <div className="admin-stats-grid">
            <StatCard label="Total searches" value={formatNumber(search.data?.total_searches)} loading={false} />
            <StatCard label="No-result searches" value={formatNumber(search.data?.no_result_searches)} loading={false} />
            <StatCard label="CTR" value={formatPercent(search.data?.click_through_rate)} loading={false} />
          </div>
        )}
        <DistributionList entries={(search.data?.top_query_hashes || []).map((item) => ({ value: item.query_hash, count: item.count }))} loading={search.loading} />
      </section>

      <section className="admin-panel">
        <SectionHeader kicker="Explorer" title="Recent events" />
        <div className="admin-filter-row">
          <input placeholder="event_name" value={eventFilters.event_name} onChange={(e) => setEventFilters((s) => ({ ...s, event_name: e.target.value }))} />
          <input placeholder="source" value={eventFilters.source} onChange={(e) => setEventFilters((s) => ({ ...s, source: e.target.value }))} />
          <input placeholder="platform" value={eventFilters.platform} onChange={(e) => setEventFilters((s) => ({ ...s, platform: e.target.value }))} />
          <input placeholder="entity_id / event_id" value={eventFilters.q} onChange={(e) => setEventFilters((s) => ({ ...s, q: e.target.value }))} />
          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => { setEventOffset(0); setRefreshKey((v) => v + 1); }}>
            Apply filters
          </button>
        </div>
        {events.error ? <ErrorState title="Event explorer unavailable" message={joinErrorMessage(events.error, events.requestId)} /> : events.loading ? (
          <LoadingState rows={6} />
        ) : (
          <>
            <AdminDataTable label="Analytics events">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Event</th>
                  <th>Source</th>
                  <th>Platform</th>
                  <th>Entity</th>
                  <th>Auth</th>
                </tr>
              </thead>
              <tbody>
                {(events.data?.rows || []).map((row) => (
                  <tr key={row.event_id} className="admin-table__interactive-row" onClick={() => setSelectedEventId(row.event_id)}>
                    <td>{formatDate(row.received_at)}</td>
                    <td>{row.event_name}</td>
                    <td>{row.source}</td>
                    <td>{row.platform}</td>
                    <td>{row.entity_type || "—"} {row.entity_id ? <code>{row.entity_id}</code> : null}</td>
                    <td>{row.user_id_present ? "yes" : "anon"}</td>
                  </tr>
                ))}
              </tbody>
            </AdminDataTable>
            <div className="admin-pagination">
              <button type="button" className="admin-btn admin-btn--ghost" disabled={eventOffset <= 0} onClick={() => setEventOffset((v) => Math.max(0, v - 50))}>
                Previous
              </button>
              <span>
                {eventOffset + 1}–{eventOffset + (events.data?.rows.length || 0)} of {events.data?.total || 0}
              </span>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                disabled={eventOffset + 50 >= (events.data?.total || 0)}
                onClick={() => setEventOffset((v) => v + 50)}
              >
                Next
              </button>
            </div>
          </>
        )}
        {selectedEvent && (
          <div className="admin-panel admin-panel--nested">
            <SectionHeader kicker="Event detail" title={selectedEvent.event_id} />
            <pre className="admin-code-block">{JSON.stringify({ properties: selectedEvent.properties, context: selectedEvent.context }, null, 2)}</pre>
          </div>
        )}
      </section>

      <section className="admin-panel">
        <SectionHeader kicker="Health" title="Ingestion health" meta={health.data ? <StatusBadge label={health.data.status} tone={healthTone(health.data.status)} /> : <WarningMeta warnings={health.warnings} />} />
        {health.error ? <ErrorState title="Health unavailable" message={joinErrorMessage(health.error, health.requestId)} /> : (
          <>
            <div className="admin-stats-grid">
              <StatCard label="Events 5m" value={formatNumber(health.data?.events_last_5m)} loading={health.loading} />
              <StatCard label="Events 1h" value={formatNumber(health.data?.events_last_1h)} loading={health.loading} />
              <StatCard label="Events 24h" value={formatNumber(health.data?.events_last_24h)} loading={health.loading} />
              <StatCard label="Dead letters 1h" value={formatNumber(health.data?.dead_letters_last_1h)} loading={health.loading} tone="amber" />
              <StatCard label="Dead letters 24h" value={formatNumber(health.data?.dead_letters_last_24h)} loading={health.loading} tone="amber" />
              <StatCard label="Dead-letter rate 24h" value={health.data?.dead_letter_rate_24h != null ? `${health.data.dead_letter_rate_24h}%` : "—"} loading={health.loading} tone="amber" />
              <StatCard label="Last event" value={formatDate(health.data?.last_successful_received_at)} loading={health.loading} />
              <StatCard label="Today aggregated" value={freshness?.is_today_aggregated ? "yes" : "no"} loading={health.loading} />
              <StatCard label="Yesterday aggregated" value={freshness?.is_yesterday_aggregated ? "yes" : "no"} loading={health.loading} />
              <StatCard label="Latest aggregate day" value={freshness?.latest_admin_metrics_day || freshness?.latest_overview_day || "—"} loading={health.loading} />
            </div>
            {qualityWarnings.length > 0 && (
              <div className="admin-panel admin-panel--nested">
                <SectionHeader kicker="Quality" title="Data quality warnings" />
                <ul className="admin-muted">
                  {qualityWarnings.map((warning) => (
                    <li key={`${warning.code}-${warning.message}`}>
                      <StatusBadge label={warning.severity} tone={warning.severity === "critical" ? "red" : warning.severity === "warning" ? "amber" : "slate"} />{" "}
                      {warning.message}
                      {warning.count != null ? ` (${warning.count})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        <div className="admin-page-header__actions">
          <button type="button" className="admin-btn admin-btn--secondary" disabled={aggregateLoading} onClick={() => void handleAggregate({ preset: "today" })}>
            Aggregate today
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={aggregateLoading} onClick={() => void handleAggregate({ preset: "yesterday" })}>
            Aggregate yesterday
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={aggregateLoading} onClick={() => void handleAggregate({ preset: "last_7_days" })}>
            Aggregate last 7 days
          </button>
        </div>
        {aggregateMessage && <p className="admin-muted">{aggregateMessage}</p>}
      </section>

      <section className="admin-panel">
        <SectionHeader kicker="Dead letters" title="Rejected events" />
        {deadLetters.error ? <ErrorState title="Dead letters unavailable" message={joinErrorMessage(deadLetters.error, deadLetters.requestId)} /> : deadLetters.loading ? (
          <LoadingState rows={5} />
        ) : (
          <>
            <div className="admin-stats-grid">
              <StatCard label="Last 24h" value={formatNumber(deadLetters.data?.summary?.last_24h)} loading={false} />
              <StatCard label="Last 7d" value={formatNumber(deadLetters.data?.summary?.last_7d)} loading={false} />
            </div>
            <DistributionList entries={deadLetters.data?.summary?.by_reason || []} loading={false} />
            <AdminDataTable label="Dead letters">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Event ID</th>
                  <th>Reason</th>
                  <th>Source</th>
                  <th>Payload</th>
                </tr>
              </thead>
              <tbody>
                {(deadLetters.data?.rows || []).map((row, index) => (
                  <tr key={`${row.event_id || "none"}-${index}`}>
                    <td>{formatDate(row.received_at)}</td>
                    <td>{row.event_id || "—"}</td>
                    <td>{row.reason || "—"}</td>
                    <td>{row.source}</td>
                    <td>{row.payload_summary ? `${row.payload_summary.key_count} keys` : "hidden"}</td>
                  </tr>
                ))}
              </tbody>
            </AdminDataTable>
          </>
        )}
      </section>
    </AdminPageShell>
  );
}

export function AdminAnalyticsPage() {
  return (
    <AdminAuthGate>
      <AdminAnalyticsContent />
    </AdminAuthGate>
  );
}
