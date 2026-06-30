import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminAuthGate } from "@/pages/admin/AdminAuthGate";
import {
  applyModerationAction,
  fetchReports,
  updateReportStatus,
  type AdminReport,
  type ModerationActionType,
  type ReportContentTypeFilter,
  type ReportStatusFilter,
} from "@/lib/moderationAdminApi";
import "@/styles/admin-moderation.css";

const PAGE_SIZE = 25;

export function ReportsAdminPage() {
  return (
    <AdminAuthGate>
      <ReportsAdminContent />
    </AdminAuthGate>
  );
}

function ReportsAdminContent() {
  const [status, setStatus] = useState<ReportStatusFilter>("pending");
  const [contentType, setContentType] = useState<ReportContentTypeFilter>("all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<AdminReport | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReports({ status, contentType, limit: PAGE_SIZE, offset });
      setReports(data.reports);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reports.");
      setReports([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [contentType, offset, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setNotes("");
  }, [selected?.id]);

  const visibleReports = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return reports;
    return reports.filter((report) => report.content_id.toLowerCase().includes(term));
  }, [reports, search]);

  async function runReportStatus(report: AdminReport, nextStatus: "reviewed" | "dismissed" | "removed") {
    setBusyId(report.id);
    setError(null);
    setMessage(null);
    try {
      await updateReportStatus(report.id, nextStatus, notes || undefined);
      setMessage(`Report ${nextStatus}.`);
      await load();
      if (selected?.id === report.id) setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update report.");
    } finally {
      setBusyId(null);
    }
  }

  async function runModerationAction(report: AdminReport, actionType: ModerationActionType) {
    const destructive = ["hide_video", "suspend_user", "remove_content"].includes(actionType);
    if (destructive) {
      const ok = window.confirm(`Apply ${formatAction(actionType)} to this ${formatType(report.content_type)}?`);
      if (!ok) return;
    }

    setBusyId(report.id);
    setError(null);
    setMessage(null);
    try {
      await applyModerationAction({
        report_id: report.id,
        target_type: report.content_type,
        target_id: report.content_id,
        action_type: actionType,
        notes: notes || undefined,
      });
      setMessage(`${formatAction(actionType)} applied.`);
      await load();
      if (selected?.id === report.id) setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply moderation action.");
    } finally {
      setBusyId(null);
    }
  }

  function setFilter(nextStatus: ReportStatusFilter, nextType: ReportContentTypeFilter) {
    setStatus(nextStatus);
    setContentType(nextType);
    setOffset(0);
  }

  return (
    <div className="admin-moderation">
      <header className="admin-moderation__header">
        <div>
          <p className="admin-moderation__eyebrow">Moderation</p>
          <h1>Reports</h1>
          <p>Review reported videos, users, places, and place photos.</p>
        </div>
        <button type="button" className="admin-btn admin-btn--secondary" onClick={() => void load()}>
          Refresh
        </button>
      </header>

      <section className="admin-filters" aria-label="Report filters">
        <label className="admin-field">
          <span>Status</span>
          <select value={status} onChange={(event) => setFilter(event.target.value as ReportStatusFilter, contentType)}>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="dismissed">Dismissed</option>
            <option value="removed">Removed</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="admin-field">
          <span>Type</span>
          <select
            value={contentType}
            onChange={(event) => setFilter(status, event.target.value as ReportContentTypeFilter)}
          >
            <option value="all">All</option>
            <option value="video">Video</option>
            <option value="user">User</option>
            <option value="place">Place</option>
            <option value="place_photo">Place photo</option>
          </select>
        </label>
        <label className="admin-field admin-field--search">
          <span>Content ID</span>
          <input
            type="search"
            placeholder="Search loaded page"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </section>

      {error && (
        <p className="admin-moderation__error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="admin-moderation__success" role="status">
          {message}
        </p>
      )}

      <section className="admin-reports-layout">
        <div className="admin-panel admin-panel--table">
          <div className="admin-panel__header">
            <h2>{total} report(s)</h2>
            <div className="admin-pagination">
              <button
                type="button"
                className="admin-btn admin-btn--ghost admin-btn--sm"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--ghost admin-btn--sm"
                disabled={offset + PAGE_SIZE >= total || loading}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </button>
            </div>
          </div>

          {loading ? (
            <p className="admin-moderation__muted">Loading reports...</p>
          ) : visibleReports.length === 0 ? (
            <p className="admin-moderation__muted">No reports match these filters.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--reports">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Reason</th>
                    <th>Target preview</th>
                    <th>Reporter</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleReports.map((report) => (
                    <tr key={report.id}>
                      <td>{formatType(report.content_type)}</td>
                      <td>{formatReason(report.reason)}</td>
                      <td>
                        <TargetPreview report={report} />
                      </td>
                      <td>
                        <code>{shortId(report.reporter_id)}</code>
                      </td>
                      <td>
                        <span className={`admin-badge admin-badge--${report.status}`}>
                          {report.status}
                        </span>
                      </td>
                      <td>{formatDate(report.created_at)}</td>
                      <td>
                        <div className="admin-row-actions">
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost admin-btn--sm"
                            onClick={() => setSelected(report)}
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--secondary admin-btn--sm"
                            disabled={busyId === report.id}
                            onClick={() => void runReportStatus(report, "reviewed")}
                          >
                            Review
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--secondary admin-btn--sm"
                            disabled={busyId === report.id}
                            onClick={() => void runReportStatus(report, "dismissed")}
                          >
                            Dismiss
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="admin-detail-panel">
          {selected ? (
            <>
              <div className="admin-panel__header">
                <h2>Report details</h2>
                <button type="button" className="admin-detail-panel__close" onClick={() => setSelected(null)}>
                  Close
                </button>
              </div>
              <dl className="admin-detail-list">
                <dt>Report ID</dt>
                <dd>
                  <code>{selected.id}</code>
                </dd>
                <dt>Content ID</dt>
                <dd>
                  <code>{selected.content_id}</code>
                </dd>
                <dt>Reason</dt>
                <dd>{formatReason(selected.reason)}</dd>
                <dt>Details</dt>
                <dd>{selected.details || "No details provided."}</dd>
                <dt>Target</dt>
                <dd>{targetSummary(selected)}</dd>
              </dl>
              <label className="admin-field">
                <span>Internal note</span>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional note for the moderation log"
                />
              </label>
              <div className="admin-detail-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  disabled={busyId === selected.id}
                  onClick={() => void runReportStatus(selected, "reviewed")}
                >
                  Mark reviewed
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  disabled={busyId === selected.id}
                  onClick={() => void runReportStatus(selected, "dismissed")}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  disabled={busyId === selected.id}
                  onClick={() => void runModerationAction(selected, primaryAction(selected))}
                >
                  {primaryActionLabel(selected)}
                </button>
              </div>
            </>
          ) : (
            <p className="admin-moderation__muted">Select a report to view metadata and apply actions.</p>
          )}
        </aside>
      </section>
    </div>
  );
}

function TargetPreview({ report }: { report: AdminReport }) {
  const imageUrl = report.target.thumbnail_url || report.target.avatar_url || report.target.photo_url;
  return (
    <div className="admin-target">
      {imageUrl && <img src={imageUrl} alt="" className="admin-target__image" />}
      <div>
        <strong>{targetSummary(report)}</strong>
        <span>{report.content_id}</span>
      </div>
    </div>
  );
}

function targetSummary(report: AdminReport) {
  if (report.content_type === "video") {
    return report.target.title || report.target.video_url || "Video";
  }
  if (report.content_type === "user") {
    return report.target.username ? `@${report.target.username}` : report.target.display_name || "User";
  }
  if (report.content_type === "place") {
    const location = [report.target.city, report.target.category].filter(Boolean).join(" · ");
    return [report.target.place_name || "Place", location].filter(Boolean).join(" · ");
  }
  return report.target.photo_url || "Place photo";
}

function primaryAction(report: AdminReport): ModerationActionType {
  if (report.content_type === "video") return "hide_video";
  if (report.content_type === "user") return "suspend_user";
  return "remove_content";
}

function primaryActionLabel(report: AdminReport) {
  if (report.content_type === "video") return "Hide video";
  if (report.content_type === "user") return "Suspend user";
  return "Remove content";
}

function formatType(type: string) {
  return type.replace("_", " ");
}

function formatReason(reason: string) {
  return reason.replace("_", " ");
}

function formatAction(action: string) {
  return action.replace("_", " ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}
