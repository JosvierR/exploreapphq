import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminAuthGate } from "@/pages/admin/AdminAuthGate";
import {
  fetchDashboardStats,
  fetchReports,
  type AdminReport,
  type DashboardStats,
} from "@/lib/moderationAdminApi";
import "@/styles/admin-moderation.css";

export function AdminDashboardPage() {
  return (
    <AdminAuthGate>
      <AdminDashboardContent />
    </AdminAuthGate>
  );
}

function AdminDashboardContent() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextStats, nextReports] = await Promise.all([
        fetchDashboardStats(),
        fetchReports({ status: "pending", limit: 5 }),
      ]);
      setStats(nextStats);
      setRecent(nextReports.reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load moderation dashboard.");
      setStats(null);
      setRecent([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="admin-moderation">
      <header className="admin-moderation__header">
        <div>
          <p className="admin-moderation__eyebrow">Moderation</p>
          <h1>Dashboard</h1>
          <p>Review user-submitted reports from the Explore mobile app.</p>
        </div>
        <div className="admin-moderation__header-actions">
          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => void load()}>
            Refresh
          </button>
          <Link to="/admin/reports" className="admin-btn admin-btn--primary">
            Open reports
          </Link>
        </div>
      </header>

      {error && (
        <p className="admin-moderation__error" role="alert">
          {error}
        </p>
      )}

      <section className="admin-moderation__stats" aria-label="Moderation stats">
        <StatCard label="Pending reports" value={stats?.pending} loading={loading} />
        <StatCard label="Video reports" value={stats?.video} loading={loading} />
        <StatCard label="User reports" value={stats?.user} loading={loading} />
        <StatCard label="Place reports" value={stats?.place} loading={loading} />
        <StatCard label="Reviewed today" value={stats?.reviewedToday} loading={loading} />
        <StatCard label="Removed or hidden" value={stats?.removed} loading={loading} />
      </section>

      <section className="admin-panel">
        <div className="admin-panel__header">
          <h2>Pending queue</h2>
          <Link to="/admin/reports" className="admin-panel__link">
            View all
          </Link>
        </div>
        {loading ? (
          <p className="admin-moderation__muted">Loading reports...</p>
        ) : recent.length === 0 ? (
          <p className="admin-moderation__muted">No pending reports.</p>
        ) : (
          <div className="admin-mini-list">
            {recent.map((report) => (
              <Link key={report.id} to="/admin/reports" className="admin-mini-list__item">
                <span>
                  <strong>{formatContentType(report.content_type)}</strong>
                  {targetLabel(report)}
                </span>
                <span className="admin-badge admin-badge--pending">{formatReason(report.reason)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, loading }: { label: string; value?: number; loading: boolean }) {
  return (
    <div className="admin-stat admin-stat--moderation">
      <span className="admin-stat__value">{loading ? "..." : value ?? 0}</span>
      <span className="admin-stat__label">{label}</span>
    </div>
  );
}

function formatContentType(type: string) {
  return type.replace("_", " ");
}

function formatReason(reason: string) {
  return reason.replace("_", " ");
}

function targetLabel(report: AdminReport) {
  const target = report.target;
  if (report.content_type === "video") return target.title ? ` · ${target.title}` : ` · ${report.content_id}`;
  if (report.content_type === "user") {
    return ` · ${target.username ? `@${target.username}` : target.display_name ?? report.content_id}`;
  }
  if (report.content_type === "place") return ` · ${target.place_name ?? report.content_id}`;
  return ` · ${target.photo_url ? "photo" : report.content_id}`;
}
