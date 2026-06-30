import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminAuthGate } from "@/pages/admin/AdminAuthGate";
import { useModerationAdmin } from "@/features/admin/ModerationAdminProvider";
import {
  fetchDashboardStats,
  fetchReports,
  type AdminReport,
  type DashboardStats,
} from "@/lib/moderationAdminApi";
import {
  formatContentTypeLabel,
  formatDateTime,
  formatReasonLabel,
  formatRelativeTime,
  formatStatusLabel,
  safeMetadataPreview,
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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pending, setPending] = useState<AdminReport[]>([]);
  const [recent, setRecent] = useState<AdminReport[]>([]);
  const [totalReports, setTotalReports] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextStats, pendingReports, recentReports] = await Promise.all([
        fetchDashboardStats(),
        fetchReports({ status: "pending", limit: 5 }),
        fetchReports({ status: "all", limit: 6 }),
      ]);
      setStats(nextStats);
      setPending(pendingReports.reports);
      setRecent(recentReports.reports);
      setTotalReports(recentReports.total);
    } catch {
      setError("Unable to load reports.");
      setStats(null);
      setPending([]);
      setRecent([]);
      setTotalReports(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const displayName = useMemo(() => admin.user?.email?.split("@")[0] || "admin", [admin.user?.email]);
  const noReports = !loading && !error && totalReports === 0;

  return (
    <div className="admin-moderation">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Welcome back, {displayName}</p>
          <h2>Moderation overview</h2>
          <p>Track report volume, review the pending queue, and move quickly through safety actions.</p>
        </div>
        <div className="admin-page-header__actions">
          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <Link to="/admin/reports" className="admin-btn admin-btn--primary">
            Open reports
          </Link>
        </div>
      </header>

      {error && (
        <ErrorState
          title="Unable to load reports."
          message="The moderation API did not return the dashboard data."
          onRetry={() => void load()}
        />
      )}

      <section className="admin-stats-grid" aria-label="Moderation stats">
        <StatCard label="Pending reports" value={stats?.pending} loading={loading} tone="warning" />
        <StatCard label="Video reports" value={stats?.video} loading={loading} tone="blue" />
        <StatCard label="User reports" value={stats?.user} loading={loading} tone="violet" />
        <StatCard label="Place reports" value={stats?.place} loading={loading} tone="green" />
        <StatCard label="Reviewed today" value={stats?.reviewedToday} loading={loading} tone="neutral" />
        <StatCard label="Removed/hidden content" value={stats?.removed} loading={loading} tone="danger" />
      </section>

      {noReports ? (
        <EmptyState
          title="No reports yet"
          message="Reports submitted from the Explore mobile app will appear here."
        />
      ) : (
        <div className="admin-dashboard-grid">
          <section className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <p className="admin-panel__kicker">Queue</p>
                <h3>Pending queue</h3>
              </div>
              <Link to="/admin/reports" className="admin-panel__link">
                View all
              </Link>
            </div>

            {loading ? (
              <SkeletonList rows={5} />
            ) : pending.length === 0 ? (
              <div className="admin-quiet-state">
                <strong>No pending reports</strong>
                <span>The queue is clear right now.</span>
              </div>
            ) : (
              <div className="admin-report-list">
                {pending.map((report) => (
                  <ReportPreview key={report.id} report={report} compact />
                ))}
              </div>
            )}
          </section>

          <section className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <p className="admin-panel__kicker">Activity</p>
                <h3>Recent reports</h3>
              </div>
              <span className="admin-panel__meta">{totalReports} total</span>
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
}: {
  label: string;
  value?: number;
  loading: boolean;
  tone: "warning" | "blue" | "violet" | "green" | "neutral" | "danger";
}) {
  return (
    <div className={`admin-stat-card admin-stat-card--${tone}`}>
      <span className="admin-stat-card__label">{label}</span>
      {loading ? (
        <span className="admin-skeleton admin-skeleton--number" aria-label="Loading" />
      ) : (
        <strong>{value ?? 0}</strong>
      )}
    </div>
  );
}

function ReportPreview({ report, compact = false }: { report: AdminReport; compact?: boolean }) {
  const imageUrl = targetImage(report);

  return (
    <Link to="/admin/reports" className="admin-report-preview">
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

function SkeletonList({ rows }: { rows: number }) {
  return (
    <div className="admin-skeleton-list" aria-label="Loading reports">
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
      <Link to="/admin/reports" className="admin-btn admin-btn--secondary">
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
