import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminAuthGate } from "@/pages/admin/AdminAuthGate";
import { useModerationAdmin } from "@/features/admin/ModerationAdminProvider";
import {
  fetchModerationSummary,
  fetchReports,
  type AdminModerationAction,
  type AdminModerationSummary,
  type AdminReport,
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
import "@/styles/admin-moderation.css";

export function AdminDashboardPage() {
  return (
    <AdminAuthGate>
      <AdminDashboardContent />
    </AdminAuthGate>
  );
}

function AdminDashboardContent() {
  const admin = useModerationAdmin();
  const [summary, setSummary] = useState<AdminModerationSummary | null>(null);
  const [pending, setPending] = useState<AdminReport[]>([]);
  const [recent, setRecent] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextSummary, pendingReports, recentReports] = await Promise.all([
        fetchModerationSummary(),
        fetchReports({ status: "pending", sort: "oldest", limit: 5 }),
        fetchReports({ status: "all", sort: "newest", limit: 6 }),
      ]);
      setSummary(nextSummary);
      setPending(pendingReports.reports);
      setRecent(recentReports.reports);
    } catch {
      setError("Unable to load dashboard data.");
      setSummary(null);
      setPending([]);
      setRecent([]);
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
  const noReports = !loading && !error && (summary?.reports.total ?? 0) === 0;
  const visibility = summary?.content_visibility;
  const hiddenContent = (visibility?.videos.hidden ?? 0) + (visibility?.places.hidden ?? 0);
  const removedContent = (visibility?.videos.removed ?? 0) + (visibility?.places.removed ?? 0);
  const visibilityAvailable = Boolean(visibility?.videos.available !== false && visibility?.places.available !== false);
  const oldestPending = summary?.reports.oldest_pending_at;

  return (
    <div className="admin-moderation admin-moderation--dashboard">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Welcome back, {displayName}</p>
          <h2>Moderation overview</h2>
          <p>Track case volume, global visibility state, and recent admin decisions from one console.</p>
        </div>
        <div className="admin-page-header__actions">
          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <Link to="/admin/reports?status=pending" className="admin-btn admin-btn--primary">
            Open queue
          </Link>
        </div>
      </header>

      {error && (
        <ErrorState
          title="Unable to load dashboard"
          message="The moderation API did not return summary data. Retry after checking API and Supabase status."
          onRetry={() => void load()}
        />
      )}

      <section className="admin-stats-grid admin-stats-grid--wide" aria-label="Moderation metrics">
        <StatCard
          label="Pending reports"
          value={summary?.reports.pending}
          loading={loading}
          tone={(summary?.reports.pending ?? 0) >= 10 ? "danger" : "warning"}
          hint={(summary?.reports.pending ?? 0) >= 10 ? "Queue needs attention" : "Open cases"}
        />
        <StatCard
          label="Reviewed in 24h"
          value={summary?.reports.reviewed_last_24h}
          loading={loading}
          tone="blue"
          hint="Based on reviewed_at"
        />
        <StatCard label="Dismissed reports" value={summary?.reports.dismissed} loading={loading} tone="neutral" />
        <StatCard
          label="Removed reports/actions"
          value={summary?.reports.removed_or_actions ?? summary?.reports.removed}
          loading={loading}
          tone="danger"
          hint={`${formatNumber(summary?.reports.removed ?? 0)} reports, ${formatNumber(
            summary?.actions.remove_content ?? 0,
          )} remove actions`}
        />
        <StatCard
          label="Hidden content"
          value={hiddenContent}
          loading={loading}
          tone="violet"
          hint={visibilityAvailable ? "Videos and places" : "Visibility schema unavailable"}
        />
        <StatCard
          label="Removed content"
          value={removedContent}
          loading={loading}
          tone="danger"
          hint={visibilityAvailable ? "Global moderation_status" : "Visibility schema unavailable"}
        />
        <StatCard
          label="Oldest pending report"
          value={oldestPending ? formatAge(oldestPending) : "None"}
          loading={loading}
          tone={oldestPending && ageHours(oldestPending) >= 24 ? "danger" : "green"}
          hint={oldestPending ? formatDateTime(oldestPending) : "Queue is clear"}
        />
        <StatCard
          label="Admin actions"
          value={summary?.actions.total}
          loading={loading}
          tone="green"
          hint={`${formatNumber(summary?.actions.last_24h ?? 0)} in 24h`}
        />
      </section>

      {noReports ? (
        <EmptyState title="No reports yet" message="Reports submitted from the Explore mobile app will appear here." />
      ) : (
        <div className="admin-dashboard-layout">
          <section className="admin-panel admin-panel--span-2">
            <div className="admin-panel__header">
              <div>
                <p className="admin-panel__kicker">Queue</p>
                <h3>Oldest pending reports</h3>
              </div>
              <Link to="/admin/reports?status=pending&sort=oldest" className="admin-panel__link">
                View queue
              </Link>
            </div>

            {loading ? (
              <SkeletonList rows={5} />
            ) : pending.length === 0 ? (
              <div className="admin-quiet-state">
                <strong>No pending reports</strong>
                <span>The queue is clear. Reviewed and dismissed cases remain available in Reports.</span>
              </div>
            ) : (
              <div className="admin-report-list">
                {pending.map((report) => (
                  <ReportPreview key={report.id} report={report} compact />
                ))}
              </div>
            )}
          </section>

          <DistributionPanel
            title="Reports by content type"
            kicker="Volume"
            loading={loading}
            entries={(summary?.by_content_type ?? []).map((entry) => ({
              key: entry.content_type,
              label: formatContentTypeLabel(entry.content_type),
              count: entry.count,
            }))}
          />

          <DistributionPanel
            title="Reports by reason"
            kicker="Reasons"
            loading={loading}
            entries={(summary?.by_reason ?? []).map((entry) => ({
              key: entry.reason,
              label: formatReasonLabel(entry.reason),
              count: entry.count,
            }))}
          />

          <VisibilityPanel summary={summary} loading={loading} />

          <section className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <p className="admin-panel__kicker">Audit trail</p>
                <h3>Recent admin actions</h3>
              </div>
              <span className="admin-panel__meta">{formatNumber(summary?.actions.total ?? 0)} total</span>
            </div>

            {loading ? (
              <SkeletonList rows={5} />
            ) : (summary?.actions.recent ?? []).length === 0 ? (
              <div className="admin-quiet-state">
                <strong>No admin actions yet</strong>
                <span>Report decisions and global visibility actions will appear here.</span>
              </div>
            ) : (
              <div className="admin-action-list">
                {summary?.actions.recent.map((action) => (
                  <ActionPreview key={action.id} action={action} />
                ))}
              </div>
            )}
          </section>

          <section className="admin-panel admin-panel--span-2">
            <div className="admin-panel__header">
              <div>
                <p className="admin-panel__kicker">Recent</p>
                <h3>Latest reports</h3>
              </div>
              <span className="admin-panel__meta">{formatNumber(summary?.reports.total ?? 0)} total</span>
            </div>

            {loading ? (
              <SkeletonList rows={6} />
            ) : recent.length === 0 ? (
              <div className="admin-quiet-state">
                <strong>No reports yet</strong>
                <span>New submissions will appear here.</span>
              </div>
            ) : (
              <div className="admin-report-list">
                {recent.map((report) => (
                  <ReportPreview key={report.id} report={report} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
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
  value?: number | string;
  loading: boolean;
  tone: "warning" | "blue" | "violet" | "green" | "neutral" | "danger";
  hint?: string;
}) {
  return (
    <div className={`admin-stat-card admin-stat-card--${tone}`}>
      <span className="admin-stat-card__label">{label}</span>
      {loading ? (
        <span className="admin-skeleton admin-skeleton--number" aria-label="Loading" />
      ) : (
        <strong>{typeof value === "number" ? formatNumber(value) : value ?? 0}</strong>
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
      <div className="admin-panel__header">
        <div>
          <p className="admin-panel__kicker">{kicker}</p>
          <h3>{title}</h3>
        </div>
      </div>
      {loading ? (
        <SkeletonList rows={4} />
      ) : entries.every((entry) => entry.count === 0) ? (
        <div className="admin-quiet-state">
          <strong>No data yet</strong>
          <span>Counts will update as reports arrive.</span>
        </div>
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

function VisibilityPanel({ summary, loading }: { summary: AdminModerationSummary | null; loading: boolean }) {
  const videos = summary?.content_visibility.videos;
  const places = summary?.content_visibility.places;

  return (
    <section className="admin-panel">
      <div className="admin-panel__header">
        <div>
          <p className="admin-panel__kicker">Global visibility</p>
          <h3>Content state</h3>
        </div>
      </div>
      {loading ? (
        <SkeletonList rows={4} />
      ) : !videos || !places || videos.available === false || places.available === false ? (
        <div className="admin-quiet-state">
          <strong>Visibility counts unavailable</strong>
          <span>The API is connected, but moderation_status counts are not exposed for every target table.</span>
        </div>
      ) : (
        <div className="admin-visibility-grid">
          <VisibilityColumn label="Videos" values={videos} />
          <VisibilityColumn label="Places" values={places} />
        </div>
      )}
    </section>
  );
}

function VisibilityColumn({
  label,
  values,
}: {
  label: string;
  values: NonNullable<AdminModerationSummary["content_visibility"]["videos"]>;
}) {
  return (
    <div className="admin-visibility-column">
      <h4>{label}</h4>
      {(["active", "under_review", "hidden", "removed"] as const).map((status) => (
        <span key={status}>
          <em>{status.replace("_", " ")}</em>
          <strong>{formatNumber(values[status])}</strong>
        </span>
      ))}
    </div>
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
          {formatContentTypeLabel(report.content_type)} / {formatReasonLabel(report.reason)} /{" "}
          {formatRelativeTime(report.created_at)}
        </span>
        {!compact && <span className="admin-report-preview__sub">{targetSubtitle(report)}</span>}
        {!compact && <span className="admin-report-preview__sub">{safeMetadataPreview(report.metadata, 2)}</span>}
      </span>
      <span className="admin-report-preview__date">{formatDateTime(report.created_at)}</span>
    </Link>
  );
}

function ActionPreview({ action }: { action: AdminModerationAction }) {
  return (
    <div className="admin-action-preview">
      <span className="admin-action-preview__mark" aria-hidden="true">
        {action.action_type.slice(0, 1).toUpperCase()}
      </span>
      <span>
        <strong>{actionLabel(action.action_type)}</strong>
        <small>
          {formatContentTypeLabel(action.target_type)} {shortId(action.target_id)} by {shortId(action.admin_id)}
        </small>
      </span>
      <time>{formatRelativeTime(action.created_at)}</time>
    </div>
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

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <section className="admin-empty-state">
      <div className="admin-empty-state__mark" aria-hidden="true">
        <span />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      <Link to="/admin/reports?status=all" className="admin-btn admin-btn--secondary">
        Open reports
      </Link>
    </section>
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

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function ageHours(value: string) {
  return Math.max(0, Date.now() - new Date(value).getTime()) / (60 * 60 * 1000);
}

function actionLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
