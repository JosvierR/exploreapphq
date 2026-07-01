import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminAuthGate } from "@/pages/admin/AdminAuthGate";
import {
  applyModerationAction,
  fetchReports,
  updateReportStatus,
  type AdminModerationAction,
  type AdminReport,
  type ModerationActionType,
  type ModerationVisibilityStatus,
  type ReportContentTypeFilter,
  type ReportReason,
  type ReportReasonFilter,
  type ReportsSort,
  type ReportStatus,
  type ReportStatusFilter,
} from "@/lib/moderationAdminApi";
import {
  formatAge,
  formatContentTypeLabel,
  formatDateTime,
  formatPriorityLabel,
  formatReasonLabel,
  formatRelativeTime,
  formatStatusLabel,
  formatVisibilityLabel,
  getReportPriority,
  safeMetadataPreview,
  shortId,
  targetImage,
  targetSubtitle,
  targetTitle,
  type ReportPriority,
} from "@/lib/adminModerationFormat";
import "@/styles/admin-moderation.css";

const PAGE_SIZE = 25;

type VisibilityFilter = ModerationVisibilityStatus | "all" | "hidden_removed" | "unknown";

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

const reasonFilters: { value: ReportReasonFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Inappropriate" },
  { value: "harassment", label: "Harassment" },
  { value: "violence", label: "Violence" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "fake", label: "Fake" },
  { value: "other", label: "Other" },
];

const visibilityFilters: { value: VisibilityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "under_review", label: "Under review" },
  { value: "hidden", label: "Hidden" },
  { value: "removed", label: "Removed" },
  { value: "hidden_removed", label: "Hidden or removed" },
  { value: "unknown", label: "Not available" },
];

const sortOptions: { value: ReportsSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "priority", label: "Priority first" },
];

type BusyAction = {
  reportId: string;
  label: string;
} | null;

type ConfirmAction = {
  report: AdminReport;
  actionType: ModerationActionType;
};

export function ReportsAdminPage() {
  return (
    <AdminAuthGate>
      <ReportsAdminContent />
    </AdminAuthGate>
  );
}

function ReportsAdminContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<ReportStatusFilter>(() => readStatus(searchParams));
  const [contentType, setContentType] = useState<ReportContentTypeFilter>(() => readContentType(searchParams));
  const [reason, setReason] = useState<ReportReasonFilter>(() => readReason(searchParams));
  const [visibility, setVisibility] = useState<VisibilityFilter>(() => readVisibility(searchParams));
  const [sort, setSort] = useState<ReportsSort>(() => readSort(searchParams));
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<AdminReport | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const nextStatus = readStatus(searchParams);
    const nextType = readContentType(searchParams);
    const nextReason = readReason(searchParams);
    const nextVisibility = readVisibility(searchParams);
    const nextSort = readSort(searchParams);

    setStatus(nextStatus);
    setContentType(nextType);
    setReason(nextReason);
    setVisibility(nextVisibility);
    setSort(nextSort);
    setOffset(0);
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await fetchReports({
        status,
        contentType,
        reason,
        sort: sort === "oldest" ? "oldest" : "newest",
        limit: PAGE_SIZE,
        offset,
      });
      setReports(data.reports);
      setTotal(data.total);
    } catch {
      setLoadError(true);
      setReports([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [contentType, offset, reason, sort, status]);

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

  useEffect(() => {
    setNotes("");
  }, [selected?.id]);

  useEffect(() => {
    if (!selected && !confirmAction) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setConfirmAction(null);
        setSelected(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmAction, selected]);

  const visibleReports = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = reports.filter((report) => {
      const matchesSearch = !term || searchableReportText(report).includes(term);
      const matchesVisibility = visibilityMatches(report, visibility);
      return matchesSearch && matchesVisibility;
    });

    return filtered.sort((a, b) => compareReports(a, b, sort));
  }, [reports, search, sort, visibility]);

  const hasActiveFilters =
    status !== "all" ||
    contentType !== "all" ||
    reason !== "all" ||
    visibility !== "all" ||
    sort !== "newest" ||
    search.trim().length > 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function runReportStatus(report: AdminReport, nextStatus: Exclude<ReportStatus, "pending">) {
    setBusyAction({ reportId: report.id, label: formatStatusLabel(nextStatus) });
    setActionError(null);
    setToast(null);
    try {
      await updateReportStatus(report.id, nextStatus, notes || undefined);
      setToast(
        nextStatus === "dismissed"
          ? "Report dismissed. Content visibility was not changed."
          : "Report reviewed. Content visibility was not changed.",
      );
      await load();
      if (selected?.id === report.id) setSelected(null);
    } catch {
      setActionError("We couldn't update this report. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  async function runModerationAction(report: AdminReport, actionType: ModerationActionType) {
    setBusyAction({ reportId: report.id, label: actionLabel(actionType) });
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
      setToast("Global visibility action completed.");
      await load();
      if (selected?.id === report.id) setSelected(null);
    } catch {
      setActionError("We couldn't complete this moderation action. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  function requestModerationAction(report: AdminReport, actionType: ModerationActionType) {
    if (requiresConfirmation(actionType)) {
      setConfirmAction({ report, actionType });
      return;
    }

    void runModerationAction(report, actionType);
  }

  function updateQuery(updates: Partial<{
    status: ReportStatusFilter;
    content_type: ReportContentTypeFilter;
    reason: ReportReasonFilter;
    visibility: VisibilityFilter;
    sort: ReportsSort;
  }>) {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
    });
    setSearchParams(next);
  }

  function resetFilters() {
    setStatus("all");
    setContentType("all");
    setReason("all");
    setVisibility("all");
    setSort("newest");
    setSearch("");
    setOffset(0);
    setSearchParams(new URLSearchParams({ status: "all", content_type: "all", reason: "all", visibility: "all", sort: "newest" }));
  }

  function setStatusFilter(nextStatus: ReportStatusFilter) {
    setStatus(nextStatus);
    setOffset(0);
    updateQuery({ status: nextStatus });
  }

  function setTypeFilter(nextType: ReportContentTypeFilter) {
    setContentType(nextType);
    setOffset(0);
    updateQuery({ content_type: nextType });
  }

  function setReasonFilter(nextReason: ReportReasonFilter) {
    setReason(nextReason);
    setOffset(0);
    updateQuery({ reason: nextReason });
  }

  function setVisibilityFilter(nextVisibility: VisibilityFilter) {
    setVisibility(nextVisibility);
    setOffset(0);
    updateQuery({ visibility: nextVisibility });
  }

  function setSortFilter(nextSort: ReportsSort) {
    setSort(nextSort);
    setOffset(0);
    updateQuery({ sort: nextSort });
  }

  return (
    <div className="admin-moderation admin-moderation--reports">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Moderation workspace</p>
          <h2>Reports console</h2>
          <p>
            Report decisions update the case lifecycle. Hide, remove, and restore actions change public visibility for
            everyone.
          </p>
        </div>
        <div className="admin-page-header__actions">
          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      <section className="admin-lifecycle-banner" aria-label="Moderation lifecycle guidance">
        <div>
          <strong>Report decision</strong>
          <span>Mark reviewed and dismiss only update content_reports.status.</span>
        </div>
        <div>
          <strong>Content visibility</strong>
          <span>Hide, remove, and restore update the target content state globally.</span>
        </div>
        <div>
          <strong>Reporter privacy</strong>
          <span>Reporting content only hides it for the reporter through user_hidden_content.</span>
        </div>
      </section>

      <section className="admin-filter-bar admin-filter-bar--dense" aria-label="Report filters">
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

        <label className="admin-field">
          <span>Reason</span>
          <select value={reason} onChange={(event) => setReasonFilter(event.target.value as ReportReasonFilter)}>
            {reasonFilters.map((filter) => (
              <option value={filter.value} key={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Visibility</span>
          <select value={visibility} onChange={(event) => setVisibilityFilter(event.target.value as VisibilityFilter)}>
            {visibilityFilters.map((filter) => (
              <option value={filter.value} key={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Sort</span>
          <select value={sort} onChange={(event) => setSortFilter(event.target.value as ReportsSort)}>
            {sortOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field admin-field--search">
          <span>Search</span>
          <input
            type="search"
            placeholder="Reason, content ID, reporter, details"
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
        <div className="admin-panel__header admin-panel__header--stackable">
          <div>
            <p className="admin-panel__kicker">Reports</p>
            <h3>{loading ? "Loading reports" : `${visibleReports.length} shown from ${total} matching reports`}</h3>
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
          <ReportsEmptyState status={status} hasActiveFilters={hasActiveFilters} />
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--reports">
                <thead>
                  <tr>
                    <th scope="col">Priority</th>
                    <th scope="col">Content type</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Status</th>
                    <th scope="col">Reported content preview</th>
                    <th scope="col">Reporter</th>
                    <th scope="col">Created date</th>
                    <th scope="col">Age</th>
                    <th scope="col">Visibility status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleReports.map((report) => (
                    <tr key={report.id} className="admin-table__interactive-row">
                      <td>
                        <PriorityBadge report={report} />
                      </td>
                      <td>
                        <TypeBadge report={report} />
                      </td>
                      <td>
                        <ReasonChip reason={report.reason} />
                      </td>
                      <td>
                        <StatusBadge status={report.status} />
                      </td>
                      <td>
                        <TargetPreview report={report} />
                      </td>
                      <td>
                        <span className="admin-code">{shortId(report.reporter_id)}</span>
                      </td>
                      <td>
                        <span className="admin-date-cell">
                          {formatDateTime(report.created_at)}
                          <small>{formatRelativeTime(report.created_at)}</small>
                        </span>
                      </td>
                      <td>
                        <strong className="admin-age-cell">{formatAge(report.created_at)}</strong>
                      </td>
                      <td>
                        <VisibilityBadge report={report} />
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
          onModerationAction={(actionType) => requestModerationAction(selected, actionType)}
        />
      )}

      {confirmAction && (
        <ConfirmationModal
          report={confirmAction.report}
          actionType={confirmAction.actionType}
          busy={busyAction?.reportId === confirmAction.report.id}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            const nextAction = confirmAction;
            setConfirmAction(null);
            void runModerationAction(nextAction.report, nextAction.actionType);
          }}
        />
      )}
    </div>
  );
}

function PriorityBadge({ report }: { report: AdminReport }) {
  const priority = getReportPriority(report);
  return (
    <span className={`admin-badge admin-badge--priority-${priority}`}>
      {formatPriorityLabel(priority)}
    </span>
  );
}

function TypeBadge({ report }: { report: AdminReport }) {
  return (
    <span className={`admin-badge admin-badge--type admin-badge--type-${report.content_type}`}>
      <span className="admin-type-mark" aria-hidden="true">
        {contentTypeMark(report.content_type)}
      </span>
      {formatContentTypeLabel(report.content_type)}
    </span>
  );
}

function ReasonChip({ reason }: { reason: ReportReason }) {
  return <span className={`admin-reason-chip admin-reason-chip--${reason}`}>{formatReasonLabel(reason)}</span>;
}

function StatusBadge({ status }: { status: AdminReport["status"] }) {
  return <span className={`admin-badge admin-badge--status-${status}`}>{formatStatusLabel(status)}</span>;
}

function VisibilityBadge({ report }: { report: AdminReport }) {
  const visibilityValueText = visibilityValue(report);

  if (!visibilityValueText) {
    return <span className="admin-muted">Not available</span>;
  }

  return (
    <span className={`admin-badge admin-badge--visibility-${badgeClassValue(visibilityValueText)}`}>
      {formatVisibilityLabel(visibilityValueText)}
    </span>
  );
}

function TargetPreview({ report }: { report: AdminReport }) {
  const imageUrl = targetImage(report);

  return (
    <div className="admin-target">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="admin-target__image" />
      ) : (
        <span className="admin-target__fallback" aria-hidden="true">
          {contentTypeMark(report.content_type)}
        </span>
      )}
      <span className="admin-target__copy">
        <strong>{targetTitle(report)}</strong>
        <small>{targetSubtitle(report)}</small>
        <span>
          {shortId(report.content_id)}
          {(report.target_report_count ?? 1) > 1 ? ` / ${report.target_report_count} reports` : ""}
        </span>
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
      <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={onDetails} aria-label="Open report details">
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
        <span className="admin-report-card__priority">
          <PriorityBadge report={report} />
          <StatusBadge status={report.status} />
        </span>
        <TargetPreview report={report} />
        <span className="admin-report-card__badges">
          <TypeBadge report={report} />
          <ReasonChip reason={report.reason} />
          <VisibilityBadge report={report} />
        </span>
        <span className="admin-report-card__meta">
          Reporter {shortId(report.reporter_id)} / {formatDateTime(report.created_at)} / {formatAge(report.created_at)}
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
  onModerationAction: (actionType: ModerationActionType) => void;
}) {
  const busy = busyAction?.reportId === report.id;
  const actions = contentActions(report);

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
              {formatContentTypeLabel(report.content_type)} / {formatReasonLabel(report.reason)} /{" "}
              {formatPriorityLabel(getReportPriority(report))} priority
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
          <dt>Reporter</dt>
          <dd>
            <code>{report.reporter_id}</code>
          </dd>
          <dt>Created at</dt>
          <dd>
            {formatDateTime(report.created_at)} <span>{formatRelativeTime(report.created_at)}</span>
          </dd>
          <dt>Age</dt>
          <dd>{formatAge(report.created_at)}</dd>
          <dt>Report status</dt>
          <dd>
            <StatusBadge status={report.status} />
          </dd>
          <dt>Target moderation_status</dt>
          <dd>
            <VisibilityBadge report={report} />
          </dd>
          <dt>Target content state</dt>
          <dd>{report.target.state || report.target.visibility || "Not available"}</dd>
          <dt>Reports on target</dt>
          <dd>{report.target_report_count ?? 1}</dd>
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

        <div className="admin-drawer__section">
          <h4>History</h4>
          <ActionHistory actions={report.actions ?? []} />
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

        <div className="admin-drawer__actions admin-action-groups">
          <section className="admin-action-group" aria-label="Report decisions">
            <div className="admin-action-group__header">
              <h4>Report decision</h4>
              <p>Mark reviewed: "This only updates the report status. It does not hide the content."</p>
              <p>Dismiss: "This dismisses the report. The content remains visible unless hidden separately."</p>
            </div>
            <div className="admin-action-group__buttons">
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
                Dismiss report
              </button>
            </div>
          </section>

          {actions.length > 0 && (
            <section className="admin-action-group" aria-label="Content visibility actions">
              <div className="admin-action-group__header">
                <h4>Content visibility actions</h4>
                <p>Hide: "This hides the content from Explore for everyone."</p>
                <p>Remove: "This removes the content from public visibility."</p>
                <p>Restore: "This makes the content globally visible again if its publication state allows it."</p>
              </div>
              <div className="admin-action-group__buttons">
                {actions.map((action) => (
                  <button
                    type="button"
                    className={`admin-btn ${action.variant === "danger" ? "admin-btn--danger" : "admin-btn--secondary"}`}
                    disabled={busy || contentActionDisabled(report, action.type)}
                    onClick={() => onModerationAction(action.type)}
                    key={action.type}
                  >
                    {busy ? "Working..." : action.label}
                  </button>
                ))}
              </div>
            </section>
          )}
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

function ActionHistory({ actions }: { actions: AdminModerationAction[] }) {
  if (actions.length === 0) {
    return <p className="admin-muted">No moderation actions recorded for this report or target yet.</p>;
  }

  return (
    <ol className="admin-history-list">
      {actions.map((action) => (
        <li key={action.id}>
          <span>
            <strong>{actionLabel(action.action_type as ModerationActionType)}</strong>
            <small>
              {formatRelativeTime(action.created_at)} by {shortId(action.admin_id)}
            </small>
          </span>
          {action.notes && <p>{action.notes}</p>}
        </li>
      ))}
    </ol>
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

function ReportsEmptyState({ status, hasActiveFilters }: { status: ReportStatusFilter; hasActiveFilters: boolean }) {
  const title = status === "pending" && !hasActiveFilters ? "No pending reports" : "No reports match your filters";
  const message =
    status === "pending" && !hasActiveFilters
      ? "The moderation queue is clear. New reports will appear here when users submit them."
      : "Adjust filters or search terms to broaden the report set.";

  return (
    <div className="admin-empty-state admin-empty-state--compact">
      <div className="admin-empty-state__mark" aria-hidden="true">
        <span />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

function InlineError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="admin-error-state" role="alert">
      <div>
        <h3>Unable to load reports</h3>
        <p>The moderation API did not return the report queue. Check API connectivity and retry.</p>
      </div>
      <button type="button" className="admin-btn admin-btn--secondary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function ConfirmationModal({
  report,
  actionType,
  busy,
  onCancel,
  onConfirm,
}: {
  report: AdminReport;
  actionType: ModerationActionType;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const details = confirmationDetails(actionType);

  return (
    <div className="admin-confirmation" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onCancel()}>
      <section className="admin-confirmation__dialog" role="dialog" aria-modal="true" aria-labelledby="admin-confirmation-title">
        <p className="admin-eyebrow">Confirmation required</p>
        <h3 id="admin-confirmation-title">{details.title}</h3>
        <dl className="admin-confirmation__details">
          <div>
            <dt>Target content type</dt>
            <dd>{formatContentTypeLabel(report.content_type)}</dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>
              {targetTitle(report)} <code>{shortId(report.content_id)}</code>
            </dd>
          </div>
          <div>
            <dt>Consequence</dt>
            <dd>{details.consequence}</dd>
          </div>
        </dl>
        <div className="admin-confirmation__actions">
          <button type="button" className="admin-btn admin-btn--ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`admin-btn ${details.variant === "danger" ? "admin-btn--danger" : "admin-btn--primary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working..." : "Confirm"}
          </button>
        </div>
      </section>
    </div>
  );
}

type ContentAction = {
  type: ModerationActionType;
  label: string;
  variant?: "danger" | "secondary";
};

function contentActions(report: AdminReport): ContentAction[] {
  if (report.content_type === "video") {
    return [
      { type: "hide_video", label: "Hide content globally", variant: "danger" },
      { type: "remove_content", label: "Remove content globally", variant: "danger" },
      { type: "restore_video", label: "Restore content" },
    ];
  }

  if (report.content_type === "place") {
    return [
      { type: "hide_place", label: "Hide content globally", variant: "danger" },
      { type: "remove_content", label: "Remove content globally", variant: "danger" },
      { type: "restore_place", label: "Restore content" },
    ];
  }

  if (report.content_type === "user") {
    return [
      { type: "suspend_user", label: "Suspend user", variant: "danger" },
      { type: "unsuspend_user", label: "Unsuspend user" },
    ];
  }

  return [{ type: "remove_content", label: "Remove content globally", variant: "danger" }];
}

function contentActionDisabled(report: AdminReport, actionType: ModerationActionType) {
  const currentVisibility = visibilityValue(report);

  if (actionType === "hide_video" || actionType === "hide_place") {
    return currentVisibility === "hidden" || currentVisibility === "removed";
  }

  if (actionType === "restore_video" || actionType === "restore_place") {
    return currentVisibility === "active";
  }

  if (actionType === "remove_content") {
    return currentVisibility === "removed";
  }

  return false;
}

function actionLabel(actionType: ModerationActionType | string) {
  const labels: Record<string, string> = {
    hide_video: "Hide video",
    restore_video: "Restore video",
    hide_place: "Hide place",
    restore_place: "Restore place",
    suspend_user: "Suspend user",
    unsuspend_user: "Unsuspend user",
    dismiss_report: "Dismiss report",
    mark_reviewed: "Mark reviewed",
    mark_removed: "Mark removed",
    remove_content: "Remove content",
  };

  return labels[actionType] ?? fallbackLabel(String(actionType));
}

function requiresConfirmation(actionType: ModerationActionType) {
  return (
    actionType === "hide_video" ||
    actionType === "hide_place" ||
    actionType === "restore_video" ||
    actionType === "restore_place" ||
    actionType === "remove_content" ||
    actionType === "suspend_user"
  );
}

function confirmationDetails(actionType: ModerationActionType) {
  if (actionType === "hide_video" || actionType === "hide_place") {
    return {
      title: "Hide content globally",
      consequence: "This hides the content from Explore for everyone.",
      variant: "danger" as const,
    };
  }

  if (actionType === "remove_content") {
    return {
      title: "Remove content globally",
      consequence: "This removes the content from public visibility.",
      variant: "danger" as const,
    };
  }

  if (actionType === "restore_video" || actionType === "restore_place") {
    return {
      title: "Restore content globally",
      consequence: "This makes the content globally visible again if its publication state allows it.",
      variant: "secondary" as const,
    };
  }

  if (actionType === "suspend_user") {
    return {
      title: "Suspend user",
      consequence: "This changes the user's ability to participate if the user table supports suspension.",
      variant: "danger" as const,
    };
  }

  return {
    title: actionLabel(actionType),
    consequence: "This updates moderation state.",
    variant: "secondary" as const,
  };
}

function visibilityValue(report: AdminReport) {
  return report.target.moderation_status || report.target.visibility || "";
}

function visibilityMatches(report: AdminReport, filter: VisibilityFilter) {
  const currentVisibility = visibilityValue(report);
  if (filter === "all") return true;
  if (filter === "unknown") return !currentVisibility;
  if (filter === "hidden_removed") return currentVisibility === "hidden" || currentVisibility === "removed";
  return currentVisibility === filter;
}

function compareReports(a: AdminReport, b: AdminReport, sort: ReportsSort) {
  if (sort === "priority") {
    const priorityDelta = priorityRank(getReportPriority(a)) - priorityRank(getReportPriority(b));
    if (priorityDelta !== 0) return priorityDelta;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }

  const aTime = new Date(a.created_at).getTime();
  const bTime = new Date(b.created_at).getTime();
  return sort === "oldest" ? aTime - bTime : bTime - aTime;
}

function priorityRank(priority: ReportPriority) {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function badgeClassValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
}

function contentTypeMark(value: string) {
  if (value === "video") return "V";
  if (value === "user") return "U";
  if (value === "place") return "P";
  return "PH";
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
    report.target.moderation_status,
    report.target.state,
    report.target.visibility,
    targetTitle(report),
    targetSubtitle(report),
    safeMetadataPreview(report.metadata, 20),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function readStatus(params: URLSearchParams): ReportStatusFilter {
  const value = params.get("status") ?? "pending";
  return statusFilters.some((filter) => filter.value === value) ? (value as ReportStatusFilter) : "pending";
}

function readContentType(params: URLSearchParams): ReportContentTypeFilter {
  const value = params.get("content_type") ?? "all";
  return contentTypeFilters.some((filter) => filter.value === value) ? (value as ReportContentTypeFilter) : "all";
}

function readReason(params: URLSearchParams): ReportReasonFilter {
  const value = params.get("reason") ?? "all";
  return reasonFilters.some((filter) => filter.value === value) ? (value as ReportReasonFilter) : "all";
}

function readVisibility(params: URLSearchParams): VisibilityFilter {
  const value = params.get("visibility") ?? "all";
  return visibilityFilters.some((filter) => filter.value === value) ? (value as VisibilityFilter) : "all";
}

function readSort(params: URLSearchParams): ReportsSort {
  const value = params.get("sort") ?? "newest";
  return sortOptions.some((option) => option.value === value) ? (value as ReportsSort) : "newest";
}

function formatMetadataKey(value: string) {
  return fallbackLabel(value);
}

function fallbackLabel(value: string) {
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
