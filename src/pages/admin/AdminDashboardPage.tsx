import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AdminAuthGate } from "@/features/admin/components/AdminAuthGate";
import { useModerationAdmin } from "@/features/admin/ModerationAdminProvider";
import { AdminSystemPage } from "@/features/admin/pages/AdminSystemPage";
import {
  fetchAdminUsers,
  fetchOpsSummary,
  fetchReports,
  type AdminContentSummaryItem,
  type AdminModerationAction,
  type AdminOpsSummary,
  type AdminRecentReport,
  type AdminReport,
  type AdminUserSummary,
  type NullableMetric,
  type OpsBreakdownEntry,
} from "@/lib/moderationAdminApi";
import {
  formatAge,
  formatContentTypeLabel,
  formatDateTime,
  formatReasonLabel,
  formatRelativeTime,
  formatStatusLabel,
  safeMetadataPreview,
  shortId,
  targetImage,
  targetSubtitle,
  targetTitle,
} from "@/lib/adminModerationFormat";
import { humanizeKey } from "@/lib/analyticsDisplay";
import "@/styles/admin-moderation.css";

type ConsoleSection = "overview" | "users" | "content" | "moderation" | "insights" | "analytics" | "system" | "admins";
type ContentTab = "videos" | "places" | "routes";
type Tone = "warning" | "blue" | "violet" | "green" | "neutral" | "danger";

export function AdminDashboardPage() {
  return (
    <AdminAuthGate>
      <AdminDashboardContent />
    </AdminAuthGate>
  );
}

function AdminDashboardContent() {
  const admin = useModerationAdmin();
  const [searchParams] = useSearchParams();
  const section = readSection(searchParams);
  const [summary, setSummary] = useState<AdminOpsSummary | null>(null);
  const [pending, setPending] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryResult, pendingResult] = await Promise.allSettled([
        fetchOpsSummary(),
        fetchReports({ status: "pending", sort: "oldest", limit: 5 }),
      ]);

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        setSummary(null);
      }

      if (pendingResult.status === "fulfilled") {
        setPending(pendingResult.value.reports);
      } else {
        setPending([]);
      }

      if (summaryResult.status === "rejected" && pendingResult.status === "rejected") {
        setError("Unable to load admin operations data.");
      }
    } catch {
      setError("Unable to load admin operations data.");
      setSummary(null);
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function handleGlobalRefresh() {
      void load();
    }

    window.addEventListener("admin:refresh", handleGlobalRefresh);
    return () => window.removeEventListener("admin:refresh", handleGlobalRefresh);
  }, [load]);

  const displayName = useMemo(() => admin.user?.email?.split("@")[0] || "admin", [admin.user?.email]);

  return (
    <div className="admin-moderation admin-moderation--dashboard admin-console-page">
      <header className="admin-page-header admin-page-header--console">
        <div>
          <p className="admin-eyebrow">Welcome back, {displayName}</p>
          <h2>Explore Admin Console</h2>
          <p>Operate users, content, moderation, and product health from one calm internal workspace.</p>
        </div>
        <div className="admin-page-header__actions">
          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh console"}
          </button>
          <Link to="/admin/reports?status=pending&sort=priority" className="admin-btn admin-btn--primary">
            Open queue
          </Link>
        </div>
      </header>

      {error && (
        <ErrorState
          title="Unable to load console"
          message="The admin API did not return the operations summary. Check API and Supabase status, then retry."
          onRetry={() => void load()}
        />
      )}

      {summary?.warnings.length ? <WarningsPanel warnings={summary.warnings} /> : null}

      {section === "overview" && <OverviewSection summary={summary} pending={pending} loading={loading} />}
      {section === "users" && <UsersSection summary={summary} />}
      {section === "content" && <ContentSection summary={summary} loading={loading} />}
      {section === "moderation" && <ModerationSection summary={summary} pending={pending} loading={loading} />}
      {section === "insights" && <InsightsSection summary={summary} loading={loading} />}
      {section === "analytics" && (
        <section className="admin-panel admin-panel--foundation">
          <PanelHeader kicker="Analytics" title="Insights dashboard" />
          <p>Explore analytics events, ingestion health, search insights, and top content.</p>
          <Link className="admin-btn admin-btn--secondary" to="/admin/analytics">
            Open Analytics dashboard
          </Link>
        </section>
      )}
      {section === "system" && <AdminSystemPage adminEmail={admin.user?.email ?? "Not signed in"} />}
      {section === "admins" && (
        <ComingSoonSection
          title="Admins"
          message="Admin management is not implemented in this console yet. Current access still comes from Supabase admin_users and configured fallback emails."
        />
      )}
    </div>
  );
}

function OverviewSection({
  summary,
  pending,
  loading,
}: {
  summary: AdminOpsSummary | null;
  pending: AdminReport[];
  loading: boolean;
}) {
  const hiddenContent = sumNullable(summary?.content.videos.hidden, summary?.content.places.hidden);
  const removedContent = sumNullable(summary?.content.videos.removed, summary?.content.places.removed);

  return (
    <>
      <section className="admin-console-hero">
        <div>
          <p className="admin-eyebrow">Product snapshot</p>
          <h3>Users, content, moderation, and system readiness in one view.</h3>
          <p>
            Reports are workflow records. They do not automatically hide content. Global visibility is controlled by
            moderation_status, while user-hidden content only affects one viewer.
          </p>
        </div>
        <div className="admin-console-hero__rail">
          <MiniStatus label="API" active={summary?.health.api_connected} />
          <MiniStatus label="Supabase" active={summary?.health.supabase_configured} />
          <MiniStatus label="Admin" active={summary?.health.admin_authorized} />
        </div>
      </section>

      <MetricGroup title="Product Health" description="The broadest current operating snapshot from Supabase data.">
        <StatCard label="Users" value={summary?.users.total} loading={loading} tone="blue" hint="Profiles/users table" />
        <StatCard label="Videos" value={summary?.content.videos.total} loading={loading} tone="violet" />
        <StatCard label="Places" value={summary?.content.places.total} loading={loading} tone="green" />
        <StatCard label="Routes" value={summary?.content.routes.total} loading={loading} tone="neutral" hint="Optional table" />
        <StatCard label="Total reports" value={summary?.moderation.reports_total} loading={loading} tone="warning" />
        <StatCard label="Pending reports" value={summary?.moderation.pending} loading={loading} tone="danger" />
        <StatCard label="Admin actions" value={summary?.moderation.actions_total} loading={loading} tone="green" />
      </MetricGroup>

      <div className="admin-dashboard-layout">
        <section className="admin-panel admin-panel--span-2">
          <PanelHeader kicker="Queue" title="Oldest pending reports" meta={`${formatMetric(summary?.moderation.pending)} pending`} />
          {loading ? (
            <SkeletonList rows={5} />
          ) : pending.length === 0 ? (
            <QuietState title="No pending reports" message="The moderation queue is clear right now." />
          ) : (
            <div className="admin-report-list">
              {pending.map((report) => (
                <ReportPreview key={report.id} report={report} compact />
              ))}
            </div>
          )}
        </section>

        <section className="admin-panel">
          <PanelHeader kicker="Visibility" title="Global content state" />
          <div className="admin-mini-metrics">
            <MiniMetric label="Hidden content" value={hiddenContent} />
            <MiniMetric label="Removed content" value={removedContent} />
            <MiniMetric label="User-hidden rows" value={summary?.engagement.user_hidden_content} />
          </div>
        </section>

        <DistributionPanel
          title="Reports by reason"
          kicker="Moderation"
          loading={loading}
          entries={(summary?.breakdowns.reports_by_reason ?? []).map((entry) => ({
            key: entry.reason,
            label: formatReasonLabel(entry.reason),
            count: entry.count,
          }))}
        />

        <section className="admin-panel">
          <PanelHeader kicker="Audit trail" title="Recent admin actions" meta={`${formatMetric(summary?.moderation.actions_24h)} in 24h`} />
          <ActionList actions={summary?.recent.admin_actions ?? []} loading={loading} />
        </section>

        <section className="admin-panel admin-panel--span-2">
          <PanelHeader kicker="Recent" title="Latest reports" meta={`${formatMetric(summary?.moderation.reports_total)} total`} />
          <RecentReportList reports={summary?.recent.reports ?? []} loading={loading} />
        </section>
      </div>
    </>
  );
}

function UsersSection({ summary }: { summary: AdminOpsSummary | null }) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [total, setTotal] = useState<number | null>(summary?.users.total ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const loadUsers = useCallback(async (nextQuery: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAdminUsers({ query: nextQuery, limit: 25 });
      setUsers(response.users);
      setTotal(response.total);
      setWarnings(response.warnings);
    } catch {
      setUsers([]);
      setError("Unable to load users.");
      setWarnings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers("");
  }, [loadUsers]);

  function handleSearch(value: string) {
    setQuery(value);
    void loadUsers(value);
  }

  return (
    <>
      <MetricGroup title="User Growth" description="Profile/account data available from the current Supabase schema.">
        <StatCard label="Total users" value={total ?? summary?.users.total} loading={loading && users.length === 0} tone="blue" />
        <StatCard label="New users 24h" value={summary?.users.new_24h} loading={false} tone="green" />
        <StatCard label="New users 7d" value={summary?.users.new_7d} loading={false} tone="green" />
        <StatCard label="Deactivated" value={summary?.users.deactivated} loading={false} tone="warning" />
        <StatCard label="Ghost/test users" value={summary?.users.ghost} loading={false} tone="neutral" />
        <StatCard label="DAU/WAU" value="Foundation required" loading={false} tone="violet" hint="Analytics events needed" />
      </MetricGroup>

      <section className="admin-panel">
        <PanelHeader kicker="Directory" title="Recent users" meta={total === null ? "Total unavailable" : `${formatNumber(total)} total`} />
        <label className="admin-field admin-field--inline">
          <span>Search users</span>
          <input
            type="search"
            value={query}
            placeholder="Handle, display name, email, or id"
            onChange={(event) => handleSearch(event.target.value)}
          />
        </label>
        {warnings.length ? <InlineWarnings warnings={warnings} /> : null}
        {error ? (
          <InlineError message={error} onRetry={() => void loadUsers(query)} />
        ) : loading ? (
          <SkeletonList rows={6} />
        ) : users.length === 0 ? (
          <QuietState title="No users found" message="Try a broader search or confirm the profiles/users table exists." />
        ) : (
          <div className="admin-entity-list">
            {users.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function ContentSection({ summary, loading }: { summary: AdminOpsSummary | null; loading: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = readContentTab(searchParams);

  function setTab(tab: ContentTab) {
    setSearchParams(new URLSearchParams({ section: "content", content: tab }));
  }

  return (
    <>
      <MetricGroup title="Content Inventory" description="Operational state for videos, places, and routes where tables are available.">
        <StatCard label="Videos total" value={summary?.content.videos.total} loading={loading} tone="violet" />
        <StatCard label="Videos published" value={summary?.content.videos.published} loading={loading} tone="green" />
        <StatCard label="Videos processing" value={summary?.content.videos.processing} loading={loading} tone="warning" />
        <StatCard label="Legacy reported videos" value={summary?.content.videos.reported_legacy} loading={loading} tone="danger" />
        <StatCard label="Places total" value={summary?.content.places.total} loading={loading} tone="green" />
        <StatCard label="Routes total" value={summary?.content.routes.total} loading={loading} tone="neutral" />
      </MetricGroup>

      <section className="admin-panel">
        <PanelHeader kicker="Inventory" title="Content operations" />
        <div className="admin-segmented-control" role="tablist" aria-label="Content type">
          {(["videos", "places", "routes"] as const).map((tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={activeTab === tab ? "is-active" : ""}
              onClick={() => setTab(tab)}
              key={tab}
            >
              {capitalize(tab)}
            </button>
          ))}
        </div>

        {activeTab === "videos" && (
          <ContentTabPanel
            metrics={[
              ["Active", summary?.content.videos.active],
              ["Under review", summary?.content.videos.under_review],
              ["Hidden", summary?.content.videos.hidden],
              ["Removed", summary?.content.videos.removed],
              ["Created 7d", summary?.content.videos.created_7d],
            ]}
            items={summary?.recent.videos ?? []}
            loading={loading}
            type="video"
            emptyMessage="Recent videos are unavailable or no videos have been posted yet."
          />
        )}

        {activeTab === "places" && (
          <ContentTabPanel
            metrics={[
              ["Published", summary?.content.places.published],
              ["Deleted", summary?.content.places.deleted],
              ["Hidden", summary?.content.places.hidden],
              ["Removed", summary?.content.places.removed],
              ["Created 7d", summary?.content.places.created_7d],
            ]}
            items={summary?.recent.places ?? []}
            loading={loading}
            type="place"
            emptyMessage="Recent places are unavailable or no places exist yet."
          />
        )}

        {activeTab === "routes" && (
          <ContentTabPanel
            metrics={[
              ["Total", summary?.content.routes.total],
              ["Published", summary?.content.routes.published],
              ["Public", summary?.content.routes.public],
              ["Draft", summary?.content.routes.draft],
            ]}
            items={summary?.recent.routes ?? []}
            loading={loading}
            type="route"
            emptyMessage="Routes metrics unavailable. Confirm the routes table and schema before enabling route operations."
          />
        )}
      </section>
    </>
  );
}

function ModerationSection({
  summary,
  pending,
  loading,
}: {
  summary: AdminOpsSummary | null;
  pending: AdminReport[];
  loading: boolean;
}) {
  const hiddenContent = sumNullable(summary?.content.videos.hidden, summary?.content.places.hidden);
  const removedContent = sumNullable(summary?.content.videos.removed, summary?.content.places.removed);

  return (
    <>
      <section className="admin-lifecycle-banner admin-lifecycle-banner--console" aria-label="Moderation lifecycle guidance">
        <div>
          <strong>Report workflow</strong>
          <span>Mark reviewed and dismiss only update content_reports.status.</span>
        </div>
        <div>
          <strong>Global visibility</strong>
          <span>Hide, remove, and restore are separate content actions that affect everyone.</span>
        </div>
        <div>
          <strong>User-hidden content</strong>
          <span>Reporting content only hides it for the reporter through user_hidden_content.</span>
        </div>
      </section>

      <MetricGroup title="Moderation Health" description="Queue pressure, decisions, and visibility actions.">
        <StatCard label="Pending reports" value={summary?.moderation.pending} loading={loading} tone="danger" />
        <StatCard label="Reviewed" value={summary?.moderation.reviewed} loading={loading} tone="blue" />
        <StatCard label="Dismissed" value={summary?.moderation.dismissed} loading={loading} tone="neutral" />
        <StatCard label="Removed reports/actions" value={summary?.moderation.removed_or_actions} loading={loading} tone="danger" />
        <StatCard label="Hidden content" value={hiddenContent} loading={loading} tone="warning" />
        <StatCard label="Removed content" value={removedContent} loading={loading} tone="danger" />
        <StatCard
          label="Oldest pending"
          value={summary?.moderation.oldest_pending_at ? formatAge(summary.moderation.oldest_pending_at) : "None"}
          loading={loading}
          tone={summary?.moderation.oldest_pending_at && ageHours(summary.moderation.oldest_pending_at) >= 24 ? "danger" : "green"}
        />
        <StatCard label="Admin actions 24h" value={summary?.moderation.actions_24h} loading={loading} tone="green" />
      </MetricGroup>

      <div className="admin-dashboard-layout">
        <section className="admin-panel admin-panel--span-2">
          <PanelHeader kicker="Queue" title="Pending queue" meta="Oldest first" />
          {loading ? (
            <SkeletonList rows={5} />
          ) : pending.length === 0 ? (
            <QuietState title="No pending reports" message="Reviewed and dismissed reports remain visible in the reports table." />
          ) : (
            <div className="admin-report-list">
              {pending.map((report) => (
                <ReportPreview key={report.id} report={report} />
              ))}
            </div>
          )}
        </section>

        <DistributionPanel
          title="Reports by content type"
          kicker="Breakdown"
          loading={loading}
          entries={(summary?.breakdowns.reports_by_content_type ?? []).map((entry) => ({
            key: entry.content_type,
            label: formatContentTypeLabel(entry.content_type),
            count: entry.count,
          }))}
        />

        <DistributionPanel
          title="Reports by reason"
          kicker="Breakdown"
          loading={loading}
          entries={(summary?.breakdowns.reports_by_reason ?? []).map((entry) => ({
            key: entry.reason,
            label: formatReasonLabel(entry.reason),
            count: entry.count,
          }))}
        />
      </div>
    </>
  );
}

function InsightsSection({ summary, loading }: { summary: AdminOpsSummary | null; loading: boolean }) {
  const topContentType = topEntry(summary?.breakdowns.reports_by_content_type ?? [], "content_type");
  const topReason = topEntry(summary?.breakdowns.reports_by_reason ?? [], "reason");
  const topVideoState = topEntry(summary?.breakdowns.videos_by_state ?? [], "value");
  const topPlaceState = topEntry(summary?.breakdowns.places_by_state ?? [], "value");
  const hiddenRemoved = sumNullable(
    summary?.content.videos.hidden,
    summary?.content.videos.removed,
    summary?.content.places.hidden,
    summary?.content.places.removed,
  );
  const totalContent = sumNullable(summary?.content.videos.total, summary?.content.places.total);
  const hiddenRemovedRate =
    hiddenRemoved !== null && totalContent && totalContent > 0 ? `${Math.round((hiddenRemoved / totalContent) * 100)}%` : "Not available";

  return (
    <>
      <section className="admin-insight-grid">
        <InsightCard title="Top reported type" value={topContentType?.label ?? "Not available"} detail={topContentType?.detail} loading={loading} />
        <InsightCard title="Top report reason" value={topReason?.label ?? "Not available"} detail={topReason?.detail} loading={loading} />
        <InsightCard title="Most common video state" value={topVideoState?.label ?? "Not available"} detail={topVideoState?.detail} loading={loading} />
        <InsightCard title="Most common place state" value={topPlaceState?.label ?? "Not available"} detail={topPlaceState?.detail} loading={loading} />
        <InsightCard title="Legacy reported videos" value={formatMetric(summary?.content.videos.reported_legacy)} loading={loading} />
        <InsightCard title="Hidden/removed rate" value={hiddenRemovedRate} detail="Videos + places" loading={loading} />
        <InsightCard title="Pending queue health" value={queueHealth(summary?.moderation.pending, summary?.moderation.oldest_pending_at)} loading={loading} />
        <InsightCard title="Admin action volume" value={`${formatMetric(summary?.moderation.actions_24h)} in 24h`} loading={loading} />
        <InsightCard title="Content created 7d" value={formatMetric(sumNullable(summary?.content.videos.created_7d, summary?.content.places.created_7d))} loading={loading} />
        <InsightCard title="Users created 7d" value={formatMetric(summary?.users.new_7d)} loading={loading} />
      </section>

      <AnalyticsFoundationSection />
    </>
  );
}

function AnalyticsFoundationSection() {
  return (
    <section className="admin-panel admin-panel--foundation">
      <PanelHeader kicker="Analytics foundation required" title="Unlock product analytics" />
      <p>
        To unlock clicks, impressions, CTR, retention, DAU/WAU, preferences, route starts and recommendation signals,
        Explore needs the Analytics/Data Foundation. This console only reports metrics available from current operational tables.
      </p>
      <div className="admin-foundation-grid">
        {["Analytics events", "Daily active users", "Weekly active users", "Impressions", "Click-through rate", "Route starts"].map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </section>
  );
}

function ContentTabPanel({
  metrics,
  items,
  loading,
  type,
  emptyMessage,
}: {
  metrics: Array<[string, NullableMetric | undefined]>;
  items: AdminContentSummaryItem[];
  loading: boolean;
  type: "video" | "place" | "route";
  emptyMessage: string;
}) {
  return (
    <div className="admin-content-tab-panel">
      <div className="admin-mini-metrics admin-mini-metrics--compact">
        {metrics.map(([label, value]) => (
          <MiniMetric label={label} value={value} key={label} />
        ))}
      </div>
      {loading ? (
        <SkeletonList rows={5} />
      ) : items.length === 0 ? (
        <QuietState title={`${capitalize(type)} metrics unavailable`} message={emptyMessage} />
      ) : (
        <div className="admin-entity-list">
          {items.map((item) => (
            <ContentRow key={`${type}-${item.id}`} item={item} type={type} />
          ))}
        </div>
      )}
    </div>
  );
}

function MetricGroup({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="admin-metric-group">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">{title}</p>
          <h3>{title}</h3>
        </div>
        <p>{description}</p>
      </div>
      <div className="admin-stats-grid admin-stats-grid--ops">{children}</div>
    </section>
  );
}

function StatCard({
  label,
  value,
  loading,
  tone,
  hint,
}: {
  label: string;
  value?: NullableMetric | string;
  loading: boolean;
  tone: Tone;
  hint?: string;
}) {
  return (
    <div className={`admin-stat-card admin-stat-card--${tone}`}>
      <span className="admin-stat-card__label">{label}</span>
      {loading ? (
        <span className="admin-skeleton admin-skeleton--number" aria-label="Loading" />
      ) : (
        <strong className={typeof value === "string" && value.length > 12 ? "admin-stat-card__text-value" : undefined}>
          {formatMetric(value)}
        </strong>
      )}
      {hint && <span className="admin-stat-card__hint">{hint}</span>}
    </div>
  );
}

function DistributionPanel({
  title,
  kicker,
  entries,
  loading,
}: {
  title: string;
  kicker: string;
  entries: Array<{ key: string; label: string; count: number }>;
  loading: boolean;
}) {
  const max = Math.max(1, ...entries.map((entry) => entry.count));

  return (
    <section className="admin-panel">
      <PanelHeader kicker={kicker} title={title} />
      {loading ? (
        <SkeletonList rows={4} />
      ) : entries.length === 0 || entries.every((entry) => entry.count === 0) ? (
        <QuietState title="No data yet" message="Counts will update as data arrives." />
      ) : (
        <div className="admin-distribution-list">
          {entries.map((entry) => (
            <div className="admin-distribution-row" key={entry.key}>
              <span>{entry.label}</span>
              <div className="admin-distribution-row__bar" aria-hidden="true">
                <span style={{ width: `${Math.max(4, (entry.count / max) * 100)}%` }} />
              </div>
              <strong>{formatNumber(entry.count)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PanelHeader({ kicker, title, meta }: { kicker: string; title: string; meta?: string }) {
  return (
    <div className="admin-panel__header">
      <div>
        <p className="admin-panel__kicker">{kicker}</p>
        <h3>{title}</h3>
      </div>
      {meta && <span className="admin-panel__meta">{meta}</span>}
    </div>
  );
}

function MiniStatus({ label, active }: { label: string; active?: boolean }) {
  return (
    <span className={`admin-mini-status ${active ? "is-ok" : "is-warn"}`}>
      <span aria-hidden="true" />
      {label}
    </span>
  );
}

function MiniMetric({ label, value }: { label: string; value?: NullableMetric }) {
  return (
    <span className="admin-mini-metric">
      <strong>{formatMetric(value)}</strong>
      <em>{label}</em>
    </span>
  );
}

function UserRow({ user }: { user: AdminUserSummary }) {
  const label = user.display_name || user.handle || user.email || shortId(user.id);
  return (
    <article className="admin-entity-row">
      {user.avatar_url ? (
        <img src={user.avatar_url} alt="" className="admin-entity-row__avatar" />
      ) : (
        <span className="admin-entity-row__avatar" aria-hidden="true">{label.slice(0, 2).toUpperCase()}</span>
      )}
      <span className="admin-entity-row__main">
        <strong>{label}</strong>
        <small>
          {user.handle ? `@${user.handle}` : "No handle"} {user.email ? `/ ${user.email}` : ""}
        </small>
      </span>
      <span className="admin-entity-row__meta">
        <StatusPill label={user.is_deactivated || user.is_active === false ? "Deactivated" : user.status || "Active"} tone={user.is_deactivated || user.is_active === false ? "danger" : "green"} />
        {user.is_ghost ? <StatusPill label="Ghost/test" tone="neutral" /> : null}
      </span>
      <span className="admin-entity-row__date" title={formatDateTime(user.created_at)}>
        {formatRelativeTime(user.created_at)}
      </span>
      <CopyButton value={user.id} label="Copy user id" />
    </article>
  );
}

function ContentRow({ item, type }: { item: AdminContentSummaryItem; type: "video" | "place" | "route" }) {
  const title = item.title || item.name || `${capitalize(type)} ${shortId(item.id)}`;
  return (
    <article className="admin-entity-row">
      {type === "video" && item.thumbnail_url ? (
        <img src={item.thumbnail_url} alt="" className="admin-entity-row__thumb" />
      ) : (
        <span className="admin-entity-row__avatar" aria-hidden="true">{type.slice(0, 2).toUpperCase()}</span>
      )}
      <span className="admin-entity-row__main">
        <strong>{title}</strong>
        <small>
          {item.category || item.difficulty || item.creator_id ? `${item.category || item.difficulty || "Creator"} ${item.creator_id ? shortId(item.creator_id) : ""}` : shortId(item.id)}
        </small>
      </span>
      <span className="admin-entity-row__meta">
        <StatusPill label={item.state || "State unavailable"} tone="neutral" />
        {item.moderation_status ? <StatusPill label={item.moderation_status} tone={item.moderation_status === "hidden" || item.moderation_status === "removed" ? "danger" : "green"} /> : null}
        {typeof item.is_public === "boolean" ? <StatusPill label={item.is_public ? "Public" : "Private"} tone={item.is_public ? "green" : "neutral"} /> : null}
      </span>
      <span className="admin-entity-row__date" title={formatDateTime(item.created_at)}>
        {formatRelativeTime(item.created_at)}
      </span>
      <CopyButton value={item.id} label={`Copy ${type} id`} />
    </article>
  );
}

function ReportPreview({ report, compact = false }: { report: AdminReport; compact?: boolean }) {
  const imageUrl = targetImage(report);

  return (
    <Link to={`/admin/reports?status=${report.status}`} className="admin-report-preview">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="admin-report-preview__image" />
      ) : (
        <span className="admin-report-preview__fallback" aria-hidden="true">
          {formatContentTypeLabel(report.content_type).slice(0, 1)}
        </span>
      )}
      <span className="admin-report-preview__body">
        <span className="admin-report-preview__topline">
          <strong>{targetTitle(report)}</strong>
          <span className={`admin-badge admin-badge--status-${report.status}`}>
            {formatStatusLabel(report.status)}
          </span>
        </span>
        <span className="admin-report-preview__meta">
          {formatContentTypeLabel(report.content_type)} / {formatReasonLabel(report.reason)} / {formatRelativeTime(report.created_at)}
        </span>
        {!compact && <span className="admin-report-preview__sub">{targetSubtitle(report)}</span>}
        {!compact && <span className="admin-report-preview__sub">{safeMetadataPreview(report.metadata, 2)}</span>}
      </span>
      <span className="admin-report-preview__date" title={formatDateTime(report.created_at)}>{formatDateTime(report.created_at)}</span>
    </Link>
  );
}

function RecentReportList({ reports, loading }: { reports: AdminRecentReport[]; loading: boolean }) {
  if (loading) return <SkeletonList rows={5} />;
  if (reports.length === 0) return <QuietState title="No reports yet" message="New user reports will appear here." />;

  return (
    <div className="admin-entity-list">
      {reports.map((report) => (
        <article className="admin-entity-row" key={report.id}>
          <span className="admin-entity-row__avatar" aria-hidden="true">{report.content_type.slice(0, 2).toUpperCase()}</span>
          <span className="admin-entity-row__main">
            <strong>{formatReasonLabel(report.reason)}</strong>
            <small>{formatContentTypeLabel(report.content_type)} / target {shortId(report.content_id)}</small>
          </span>
          <span className="admin-entity-row__meta">
            <StatusPill label={formatStatusLabel(report.status)} tone={report.status === "pending" ? "warning" : report.status === "removed" ? "danger" : "neutral"} />
          </span>
          <span className="admin-entity-row__date" title={formatDateTime(report.created_at)}>{formatRelativeTime(report.created_at)}</span>
          <CopyButton value={report.id} label="Copy report id" />
        </article>
      ))}
    </div>
  );
}

function ActionList({ actions, loading }: { actions: AdminModerationAction[]; loading: boolean }) {
  if (loading) return <SkeletonList rows={5} />;
  if (actions.length === 0) return <QuietState title="No admin actions yet" message="Report decisions and visibility actions will appear here." />;

  return (
    <div className="admin-action-list">
      {actions.map((action) => (
        <div className="admin-action-preview" key={action.id}>
          <span className="admin-action-preview__mark" aria-hidden="true">
            {action.action_type.slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>{humanizeKey(action.action_type)}</strong>
            <small>
              {formatContentTypeLabel(action.target_type)} {shortId(action.target_id)} by {shortId(action.admin_id)}
            </small>
          </span>
          <time title={formatDateTime(action.created_at)}>{formatRelativeTime(action.created_at)}</time>
        </div>
      ))}
    </div>
  );
}

function InsightCard({ title, value, detail, loading }: { title: string; value: string; detail?: string; loading: boolean }) {
  return (
    <article className="admin-insight-card">
      <span>{title}</span>
      {loading ? <span className="admin-skeleton admin-skeleton--line" /> : <strong>{value}</strong>}
      {detail && <small>{detail}</small>}
    </article>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "green" | "warning" | "danger" | "neutral" }) {
  return <span className={`admin-status-pill admin-status-pill--${tone}`}>{humanizeKey(label)}</span>;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="admin-copy-btn" aria-label={label} onClick={() => void copy()}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function SkeletonList({ rows }: { rows: number }) {
  return (
    <div className="admin-skeleton-list" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="admin-skeleton-row" key={index}>
          <span className="admin-skeleton admin-skeleton--avatar" />
          <span className="admin-skeleton-row__copy">
            <span className="admin-skeleton admin-skeleton--line" />
            <span className="admin-skeleton admin-skeleton--line admin-skeleton--short" />
          </span>
        </div>
      ))}
    </div>
  );
}

function QuietState({ title, message }: { title: string; message: string }) {
  return (
    <div className="admin-quiet-state">
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <section className="admin-error-state" role="alert">
      <div>
        <h3>{title}</h3>
        <p>{message}</p>
      </div>
      <button type="button" className="admin-btn admin-btn--secondary" onClick={onRetry}>
        Try again
      </button>
    </section>
  );
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="admin-error-state" role="alert">
      <div>
        <h3>{message}</h3>
        <p>Retry after checking API connectivity and admin authorization.</p>
      </div>
      <button type="button" className="admin-btn admin-btn--secondary" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function WarningsPanel({ warnings }: { warnings: string[] }) {
  return (
    <section className="admin-warning-panel" aria-label="Unavailable metrics">
      <strong>Some metrics are unavailable</strong>
      <span>{warnings.slice(0, 4).join(" / ")}</span>
    </section>
  );
}

function InlineWarnings({ warnings }: { warnings: string[] }) {
  return <p className="admin-muted admin-inline-warning">{warnings.slice(0, 3).join(" / ")}</p>;
}

function ComingSoonSection({ title, message }: { title: string; message: string }) {
  return (
    <section className="admin-panel admin-panel--foundation">
      <PanelHeader kicker="Coming soon" title={title} />
      <p>{message}</p>
    </section>
  );
}

function readSection(params: URLSearchParams): ConsoleSection {
  const value = params.get("section") || "overview";
  if (["overview", "users", "content", "moderation", "insights", "analytics", "system", "admins"].includes(value)) {
    return value as ConsoleSection;
  }
  return "overview";
}

function readContentTab(params: URLSearchParams): ContentTab {
  const value = params.get("content") || "videos";
  if (value === "places" || value === "routes") return value;
  return "videos";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatMetric(value: NullableMetric | string | undefined) {
  if (value === null || value === undefined) return "Not available";
  if (typeof value === "number") return formatNumber(value);
  return value;
}

function sumNullable(...values: Array<NullableMetric | undefined>) {
  const available = values.filter((value): value is number => typeof value === "number");
  if (available.length === 0) return null;
  return available.reduce((sum, value) => sum + value, 0);
}

function ageHours(value: string) {
  return Math.max(0, Date.now() - new Date(value).getTime()) / (60 * 60 * 1000);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function topEntry<T extends OpsBreakdownEntry, K extends keyof T>(entries: T[], key: K) {
  const top = [...entries].sort((a, b) => b.count - a.count)[0];
  if (!top || !top[key]) return null;
  return {
    label: humanizeKey(String(top[key])),
    detail: `${formatNumber(top.count)} record${top.count === 1 ? "" : "s"}`,
  };
}

function queueHealth(pending?: NullableMetric, oldestPendingAt?: string | null) {
  if (pending === null || pending === undefined) return "Not available";
  if (pending === 0) return "Clear";
  if (oldestPendingAt && ageHours(oldestPendingAt) >= 24) return "Needs attention";
  if (pending >= 10) return "Elevated";
  return "Manageable";
}
