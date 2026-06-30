import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminAuthGate } from "@/pages/admin/AdminAuthGate";
import {
  applyModerationAction,
  fetchReports,
  updateReportStatus,
  type AdminReport,
  type ModerationActionType,
  type ReportContentTypeFilter,
  type ReportStatus,
  type ReportStatusFilter,
} from "@/lib/moderationAdminApi";
import {
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

const PAGE_SIZE = 25;

const statusFilters: { value: ReportStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "reviewed", label: "Reviewed" },
  { value: "dismissed", label: "Dismissed" },
  { value: "removed", label: "Removed" },
];

const contentTypeFilters: { value: ReportContentTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "video", label: "Video" },
  { value: "user", label: "User" },
  { value: "place", label: "Place" },
  { value: "place_photo", label: "Place photo" },
];

type BusyAction = {
  reportId: string;
  label: string;
} | null;

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
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await fetchReports({ status, contentType, limit: PAGE_SIZE, offset });
      setReports(data.reports);
      setTotal(data.total);
    } catch {
      setLoadError(true);
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

  useEffect(() => {
    if (!selected) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected]);

  const visibleReports = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return reports;
    return reports.filter((report) => searchableReportText(report).includes(term));
  }, [reports, search]);

  const hasActiveFilters = status !== "all" || contentType !== "all" || search.trim().length > 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function runReportStatus(report: AdminReport, nextStatus: Exclude<ReportStatus, "pending">) {
    setBusyAction({ reportId: report.id, label: formatStatusLabel(nextStatus) });
    setActionError(null);
    setToast(null);
    try {
      await updateReportStatus(report.id, nextStatus, notes || undefined);
      setToast("Report updated successfully.");
      await load();
      if (selected?.id === report.id) setSelected(null);
    } catch {
      setActionError("We couldn't update this report. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  async function runModerationAction(report: AdminReport, actionType: ModerationActionType) {
    const destructive = actionType === "hide_video" || actionType === "suspend_user" || actionType === "remove_content";
    if (destructive && !window.confirm(confirmationMessage(actionType))) {
      return;
    }

    setBusyAction({ reportId: report.id, label: primaryActionLabel(report) });
    setActionError(null);
    setToast(null);
    try {
      await applyModerationAction({
        report_id: report.id,
        target_type: report.content_type,
        target_id: report.content_id,
        action_type: actionType,
        notes: notes || undefined,
      });
      setToast("Moderation action completed.");
      await load();
      if (selected?.id === report.id) setSelected(null);
    } catch {
      setActionError("We couldn't update this report. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  function resetFilters() {
    setStatus("all");
    setContentType("all");
    setSearch("");
    setOffset(0);
  }

  function setStatusFilter(nextStatus: ReportStatusFilter) {
    setStatus(nextStatus);
    setOffset(0);
  }

  function setTypeFilter(nextType: ReportContentTypeFilter) {
    setContentType(nextType);
    setOffset(0);
  }

  return (
    <div className="admin-moderation">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Moderation workspace</p>
          <h2>Moderation reports</h2>
          <p>This is where admins review user-submitted reports from the Explore mobile app.</p>
        </div>
        <button type="button" className="admin-btn admin-btn--secondary" onClick={() => void load()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <section className="admin-filter-bar" aria-label="Report filters">
        <label className="admin-field">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatusFilter(event.target.value as ReportStatusFilter)}>
            {statusFilters.map((filter) => (
              <option value={filter.value} key={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Content type</span>
          <select value={contentType} onChange={(event) => setTypeFilter(event.target.value as ReportContentTypeFilter)}>
            {contentTypeFilters.map((filter) => (
              <option value={filter.value} key={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field admin-field--search">
          <span>Search</span>
          <input
            type="search"
            placeholder="Content ID, reason, reporter, metadata"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <button type="button" className="admin-btn admin-btn--ghost" onClick={resetFilters} disabled={!hasActiveFilters}>
          Clear filters
        </button>
      </section>

      <div className="admin-alert-stack" aria-live="polite">
        {toast && (
          <p className="admin-alert admin-alert--success" role="status">
            {toast}
          </p>
        )}
        {actionError && (
          <p className="admin-alert admin-alert--error" role="alert">
            {actionError}
          </p>
        )}
      </div>

      <section className="admin-panel admin-panel--workspace">
        <div className="admin-panel__header">
          <div>
            <p className="admin-panel__kicker">Reports</p>
            <h3>{loading ? "Loading reports" : `${visibleReports.length} shown`}</h3>
          </div>
          <div className="admin-pagination" aria-label="Reports pagination">
            <span>
              Page {currentPage} of {totalPages}
            </span>
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

        {loadError ? (
          <InlineError onRetry={() => void load()} />
        ) : loading ? (
          <ReportsSkeleton />
        ) : visibleReports.length === 0 ? (
          <ReportsEmptyState />
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--reports">
                <thead>
                  <tr>
                    <th>Report type</th>
                    <th>Reason</th>
                    <th>Target preview</th>
                    <th>Reporter</th>
                    <th>Status</th>
                    <th>Created date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleReports.map((report) => (
                    <tr key={report.id} className="admin-table__interactive-row">
                      <td>
                        <TypeBadge report={report} />
                      </td>
                      <td>
                        <ReasonChip reason={report.reason} />
                      </td>
                      <td>
                        <TargetPreview report={report} />
                      </td>
                      <td>
                        <span className="admin-code">{shortId(report.reporter_id)}</span>
                      </td>
                      <td>
                        <StatusBadge status={report.status} />
                      </td>
                      <td>
                        <span className="admin-date-cell">
                          {formatDateTime(report.created_at)}
                          <small>{formatRelativeTime(report.created_at)}</small>
                        </span>
                      </td>
                      <td>
                        <ReportActions
                          report={report}
                          busyAction={busyAction}
                          onDetails={() => setSelected(report)}
                          onReview={() => void runReportStatus(report, "reviewed")}
                          onDismiss={() => void runReportStatus(report, "dismissed")}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-report-cards" aria-label="Reports">
              {visibleReports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  busyAction={busyAction}
                  onDetails={() => setSelected(report)}
                  onReview={() => void runReportStatus(report, "reviewed")}
                  onDismiss={() => void runReportStatus(report, "dismissed")}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {selected && (
        <ReportDrawer
          report={selected}
          notes={notes}
          busyAction={busyAction}
          onNotesChange={setNotes}
          onClose={() => setSelected(null)}
          onReview={() => void runReportStatus(selected, "reviewed")}
          onDismiss={() => void runReportStatus(selected, "dismissed")}
          onModerationAction={() => void runModerationAction(selected, primaryAction(selected))}
        />
      )}
    </div>
  );
}

function TypeBadge({ report }: { report: AdminReport }) {
  return (
    <span className={`admin-badge admin-badge--type admin-badge--type-${report.content_type}`}>
      {formatContentTypeLabel(report.content_type)}
    </span>
  );
}

function ReasonChip({ reason }: { reason: AdminReport["reason"] }) {
  return <span className={`admin-reason-chip admin-reason-chip--${reason}`}>{formatReasonLabel(reason)}</span>;
}

function StatusBadge({ status }: { status: AdminReport["status"] }) {
  return <span className={`admin-badge admin-badge--status-${status}`}>{formatStatusLabel(status)}</span>;
}

function TargetPreview({ report }: { report: AdminReport }) {
  const imageUrl = targetImage(report);

  return (
    <div className="admin-target">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="admin-target__image" />
      ) : (
        <span className="admin-target__fallback" aria-hidden="true">
          {formatContentTypeLabel(report.content_type).slice(0, 1)}
        </span>
      )}
      <span className="admin-target__copy">
        <strong>{targetTitle(report)}</strong>
        <small>{targetSubtitle(report)}</small>
        <span>{shortId(report.content_id)}</span>
      </span>
    </div>
  );
}

function ReportActions({
  report,
  busyAction,
  onDetails,
  onReview,
  onDismiss,
}: {
  report: AdminReport;
  busyAction: BusyAction;
  onDetails: () => void;
  onReview: () => void;
  onDismiss: () => void;
}) {
  const busy = busyAction?.reportId === report.id;

  return (
    <div className="admin-row-actions">
      <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={onDetails}>
        Details
      </button>
      <button
        type="button"
        className="admin-btn admin-btn--secondary admin-btn--sm"
        disabled={busy || report.status === "reviewed"}
        onClick={onReview}
      >
        {busy ? "Working..." : "Review"}
      </button>
      <button
        type="button"
        className="admin-btn admin-btn--secondary admin-btn--sm"
        disabled={busy || report.status === "dismissed"}
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  );
}

function ReportCard({
  report,
  busyAction,
  onDetails,
  onReview,
  onDismiss,
}: {
  report: AdminReport;
  busyAction: BusyAction;
  onDetails: () => void;
  onReview: () => void;
  onDismiss: () => void;
}) {
  return (
    <article className="admin-report-card">
      <button type="button" className="admin-report-card__main" onClick={onDetails}>
        <TargetPreview report={report} />
        <span className="admin-report-card__badges">
          <TypeBadge report={report} />
          <ReasonChip reason={report.reason} />
          <StatusBadge status={report.status} />
        </span>
        <span className="admin-report-card__meta">
          Reporter {shortId(report.reporter_id)} / {formatDateTime(report.created_at)}
        </span>
      </button>
      <ReportActions
        report={report}
        busyAction={busyAction}
        onDetails={onDetails}
        onReview={onReview}
        onDismiss={onDismiss}
      />
    </article>
  );
}

function ReportDrawer({
  report,
  notes,
  busyAction,
  onNotesChange,
  onClose,
  onReview,
  onDismiss,
  onModerationAction,
}: {
  report: AdminReport;
  notes: string;
  busyAction: BusyAction;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onReview: () => void;
  onDismiss: () => void;
  onModerationAction: () => void;
}) {
  const busy = busyAction?.reportId === report.id;
  const actionLabel = primaryActionLabel(report);

  return (
    <div
      className="admin-drawer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside className="admin-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="report-drawer-title">
        <div className="admin-drawer__header">
          <div>
            <p className="admin-eyebrow">Report details</p>
            <h3 id="report-drawer-title">{targetTitle(report)}</h3>
            <p>
              {formatContentTypeLabel(report.content_type)} / {formatReasonLabel(report.reason)}
            </p>
          </div>
          <button type="button" className="admin-drawer__close" aria-label="Close report details" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="admin-drawer__section">
          <TargetPreview report={report} />
        </div>

        <dl className="admin-detail-list">
          <dt>Report ID</dt>
          <dd>
            <code>{report.id}</code>
          </dd>
          <dt>Content type</dt>
          <dd>{formatContentTypeLabel(report.content_type)}</dd>
          <dt>Content ID</dt>
          <dd>
            <code>{report.content_id}</code>
          </dd>
          <dt>Reason</dt>
          <dd>{formatReasonLabel(report.reason)}</dd>
          <dt>Details</dt>
          <dd>{report.details || "No details provided."}</dd>
          <dt>Reporter ID</dt>
          <dd>
            <code>{report.reporter_id}</code>
          </dd>
          <dt>Created at</dt>
          <dd>
            {formatDateTime(report.created_at)} <span>{formatRelativeTime(report.created_at)}</span>
          </dd>
          <dt>Current status</dt>
          <dd>
            <StatusBadge status={report.status} />
          </dd>
          <dt>Reviewed by</dt>
          <dd>{report.reviewed_by ? <code>{report.reviewed_by}</code> : "Not reviewed yet."}</dd>
          <dt>Reviewed at</dt>
          <dd>{report.reviewed_at ? formatDateTime(report.reviewed_at) : "Not reviewed yet."}</dd>
        </dl>

        <div className="admin-drawer__section">
          <h4>Target preview</h4>
          <p>{targetSubtitle(report)}</p>
          {report.target.video_url && (
            <a href={report.target.video_url} target="_blank" rel="noreferrer" className="admin-link">
              Open video URL
            </a>
          )}
          {report.target.photo_url && (
            <a href={report.target.photo_url} target="_blank" rel="noreferrer" className="admin-link">
              Open photo URL
            </a>
          )}
        </div>

        <div className="admin-drawer__section">
          <h4>Metadata</h4>
          <MetadataSummary metadata={report.metadata} />
        </div>

        <label className="admin-field">
          <span>Internal note</span>
          <textarea
            rows={4}
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="Optional note for the moderation log"
          />
        </label>

        <div className="admin-drawer__actions">
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            disabled={busy || report.status === "reviewed"}
            onClick={onReview}
          >
            {busy ? "Working..." : "Mark reviewed"}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            disabled={busy || report.status === "dismissed"}
            onClick={onDismiss}
          >
            Dismiss
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--danger"
            disabled={busy || report.status === "removed"}
            onClick={onModerationAction}
          >
            {busy ? "Working..." : actionLabel}
          </button>
        </div>
      </aside>
    </div>
  );
}

function MetadataSummary({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata ?? {});

  if (entries.length === 0) {
    return <p className="admin-muted">No metadata</p>;
  }

  return (
    <>
      <dl className="admin-metadata-grid">
        {entries.slice(0, 6).map(([key, value]) => (
          <div key={key}>
            <dt>{formatMetadataKey(key)}</dt>
            <dd>{formatMetadataValue(value)}</dd>
          </div>
        ))}
      </dl>
      <details className="admin-raw-metadata">
        <summary>Raw metadata</summary>
        <pre>{JSON.stringify(metadata, null, 2)}</pre>
      </details>
    </>
  );
}

function ReportsSkeleton() {
  return (
    <div className="admin-skeleton-table" aria-label="Loading reports">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="admin-skeleton-row admin-skeleton-row--table" key={index}>
          <span className="admin-skeleton admin-skeleton--pill" />
          <span className="admin-skeleton admin-skeleton--line" />
          <span className="admin-skeleton admin-skeleton--line" />
          <span className="admin-skeleton admin-skeleton--short" />
        </div>
      ))}
    </div>
  );
}

function ReportsEmptyState() {
  return (
    <div className="admin-empty-state admin-empty-state--compact">
      <div className="admin-empty-state__mark" aria-hidden="true">
        <span />
      </div>
      <h3>No reports match your filters.</h3>
      <p>Adjust the status, content type, or search term to broaden the queue.</p>
    </div>
  );
}

function InlineError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="admin-error-state" role="alert">
      <div>
        <h3>Unable to load reports.</h3>
        <p>The moderation API did not return the report queue.</p>
      </div>
      <button type="button" className="admin-btn admin-btn--secondary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function primaryAction(report: AdminReport): ModerationActionType {
  if (report.content_type === "video") return "hide_video";
  if (report.content_type === "user") return "suspend_user";
  return "remove_content";
}

function primaryActionLabel(report: AdminReport) {
  if (report.content_type === "video") return "Hide content";
  if (report.content_type === "user") return "Suspend user";
  return "Remove content";
}

function confirmationMessage(actionType: ModerationActionType) {
  if (actionType === "suspend_user") return "Are you sure you want to suspend this user?";
  return "Are you sure you want to remove this content?";
}

function searchableReportText(report: AdminReport) {
  return [
    report.id,
    report.content_type,
    report.content_id,
    report.reason,
    report.details,
    report.status,
    report.reporter_id,
    report.reviewed_by,
    targetTitle(report),
    targetSubtitle(report),
    safeMetadataPreview(report.metadata, 20),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function formatMetadataKey(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMetadataValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "string") return truncate(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") return truncate(JSON.stringify(value));
  return truncate(String(value));
}

function truncate(value: string, max = 120) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}
