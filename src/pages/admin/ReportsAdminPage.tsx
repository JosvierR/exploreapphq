import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminAuthGate } from "@/pages/admin/AdminAuthGate";
import {
  applyModerationAction,
  dismissReport,
  getAdminReportDetail,
  getAdminReports,
  hideVideo,
  markReportReviewed,
  removeVideo,
  restoreVideo,
  type AdminModerationAction,
  type AdminReport,
  type ModerationActionType,
  type ReportContentTypeFilter,
  type ReportReason,
  type ReportReasonFilter,
  type ReportsSort,
  type ReportStatus,
  type ReportStatusFilter,
} from "@/lib/moderationAdminApi";
import {
  contentTypeFilters,
  readContentType,
  readReason,
  readSort,
  readStatus,
  readVisibility,
  reasonFilters,
  reportViewTabs,
  sortOptions,
  statusFilters,
  visibilityFilters,
  type VisibilityFilter,
} from "@/features/admin/utils/reportFilters";
import {
  actorDisplayName,
  formatAge,
  formatContentTypeLabel,
  formatDateTime,
  formatDurationSeconds,
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
  videoActionAvailability,
  videoVisibilitySummary,
  type ReportPriority,
} from "@/lib/adminModerationFormat";
import "@/styles/admin-moderation.css";

const PAGE_SIZE = 25;

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
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState<string | null>(null);
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
      const data = await getAdminReports({
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
    status !== "pending" ||
    contentType !== "video" ||
    reason !== "all" ||
    visibility !== "all" ||
    sort !== "priority" ||
    search.trim().length > 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const refreshReportDetail = useCallback(async (reportId: string) => {
    setSelectedLoading(true);
    setSelectedError(null);
    try {
      const data = await getAdminReportDetail(reportId);
      setSelected(data.report);
    } catch {
      setSelectedError("Unable to load the full report detail. The row data is still available.");
    } finally {
      setSelectedLoading(false);
    }
  }, []);

  function openReport(report: AdminReport) {
    setSelected(report);
    setSelectedError(null);
    void refreshReportDetail(report.id);
  }

  async function runReportStatus(report: AdminReport, nextStatus: "reviewed" | "dismissed") {
    setBusyAction({ reportId: report.id, label: formatStatusLabel(nextStatus) });
    setActionError(null);
    setToast(null);
    try {
      if (nextStatus === "dismissed") {
        await dismissReport(report.id, notes || undefined);
      } else {
        await markReportReviewed(report.id, notes || undefined);
      }
      setToast(
        nextStatus === "dismissed"
          ? "Report dismissed. Content visibility was not changed."
          : "Report reviewed. Content visibility was not changed.",
      );
      await load();
      if (selected?.id === report.id) await refreshReportDetail(report.id);
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
      if (report.content_type === "video" && actionType === "hide_video") {
        await hideVideo(report.content_id, report.id, notes || undefined);
      } else if (report.content_type === "video" && actionType === "remove_content") {
        await removeVideo(report.content_id, report.id, notes || undefined);
      } else if (report.content_type === "video" && actionType === "restore_video") {
        await restoreVideo(report.content_id, report.id, notes || undefined);
      } else {
        await applyModerationAction({
          report_id: report.id,
          target_type: report.content_type,
          target_id: report.content_id,
          action_type: actionType,
          notes: notes || undefined,
        });
      }
      setToast("Global visibility action completed.");
      await load();
      if (selected?.id === report.id) await refreshReportDetail(report.id);
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
    setStatus("pending");
    setContentType("video");
    setReason("all");
    setVisibility("all");
    setSort("priority");
    setSearch("");
    setOffset(0);
    setSearchParams(new URLSearchParams({ status: "pending", content_type: "video", reason: "all", visibility: "all", sort: "priority" }));
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

  function setReportView(nextType: ReportContentTypeFilter) {
    setContentType(nextType);
    setOffset(0);

    if (nextType === "video") {
      setStatus("pending");
      setSort("priority");
      updateQuery({ content_type: nextType, status: "pending", sort: "priority" });
      return;
    }

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
          <h2>{contentType === "video" ? "Video Reports" : "Reports console"}</h2>
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

      <nav className="admin-report-tabs" aria-label="Moderation report views">
        {reportViewTabs.map((tab) => (
          <button
            type="button"
            className={contentType === tab.value ? "is-active" : ""}
            aria-pressed={contentType === tab.value}
            onClick={() => setReportView(tab.value)}
            key={tab.value}
          >
            {tab.label}
          </button>
        ))}
      </nav>

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

      <section className="admin-quick-filters" aria-label="Quick report filters">
        {(["pending", "reviewed", "dismissed"] as const).map((value) => (
          <button
            type="button"
            className={status === value ? "is-active" : ""}
            onClick={() => setStatusFilter(value)}
            key={value}
          >
            {formatStatusLabel(value)}
          </button>
        ))}
        <button
          type="button"
          className={visibility === "hidden_removed" ? "is-active" : ""}
          onClick={() => setVisibilityFilter("hidden_removed")}
        >
          Hidden/Removed
        </button>
        {reasonFilters
          .filter((filter) => filter.value !== "all")
          .map((filter) => (
            <button
              type="button"
              className={reason === filter.value ? "is-active" : ""}
              onClick={() => setReasonFilter(filter.value)}
              key={filter.value}
            >
              {filter.label}
            </button>
          ))}
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
                        <span className="admin-reporter-cell">
                          <strong>{actorDisplayName(report.reporter, shortId(report.reporter_id))}</strong>
                          <small>{shortId(report.reporter_id)}</small>
                        </span>
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
                          onDetails={() => openReport(report)}
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
                  onDetails={() => openReport(report)}
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
          detailLoading={selectedLoading}
          detailError={selectedError}
          notes={notes}
          busyAction={busyAction}
          onNotesChange={setNotes}
          onClose={() => setSelected(null)}
          onRetry={() => void refreshReportDetail(selected.id)}
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
  const count = report.report_count_for_target ?? report.target_report_count ?? 1;

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
          {count > 1 ? ` / ${count} reports` : ""}
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
        {report.content_type === "video" ? "Review video" : "Details"}
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
          Reporter {actorDisplayName(report.reporter, shortId(report.reporter_id))} / {formatDateTime(report.created_at)} /{" "}
          {formatAge(report.created_at)}
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
  detailLoading,
  detailError,
  notes,
  busyAction,
  onNotesChange,
  onClose,
  onRetry,
  onReview,
  onDismiss,
  onModerationAction,
}: {
  report: AdminReport;
  detailLoading: boolean;
  detailError: string | null;
  notes: string;
  busyAction: BusyAction;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onRetry: () => void;
  onReview: () => void;
  onDismiss: () => void;
  onModerationAction: (actionType: ModerationActionType) => void;
}) {
  if (report.content_type === "video") {
    return (
      <VideoReportDrawer
        report={report}
        detailLoading={detailLoading}
        detailError={detailError}
        notes={notes}
        busyAction={busyAction}
        onNotesChange={onNotesChange}
        onClose={onClose}
        onRetry={onRetry}
        onReview={onReview}
        onDismiss={onDismiss}
        onModerationAction={onModerationAction}
      />
    );
  }

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

        {detailLoading && <p className="admin-inline-status">Refreshing report detail...</p>}
        {detailError && (
          <div className="admin-inline-error" role="alert">
            <span>{detailError}</span>
            <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={onRetry}>
              Retry
            </button>
          </div>
        )}

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

function VideoReportDrawer({
  report,
  detailLoading,
  detailError,
  notes,
  busyAction,
  onNotesChange,
  onClose,
  onRetry,
  onReview,
  onDismiss,
  onModerationAction,
}: {
  report: AdminReport;
  detailLoading: boolean;
  detailError: string | null;
  notes: string;
  busyAction: BusyAction;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onRetry: () => void;
  onReview: () => void;
  onDismiss: () => void;
  onModerationAction: (actionType: ModerationActionType) => void;
}) {
  const [videoFailed, setVideoFailed] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const busy = busyAction?.reportId === report.id;
  const visibility = videoVisibilitySummary(report);
  const availability = videoActionAvailability(report);
  const publicLink = report.target.public_deep_link || `https://www.exploreapphq.com/v/${encodeURIComponent(report.content_id)}`;
  const videoUnavailable = !report.target.video_available || !report.target.video_url || videoFailed;
  const targetUnavailable = Boolean(report.target.target_unavailable);
  const history = report.recent_moderation_actions ?? report.actions ?? [];
  const relatedReports = report.related_reports ?? report.previous_reports_for_target ?? [];

  useEffect(() => {
    setVideoFailed(false);
  }, [report.id, report.target.video_url]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div
      className="admin-drawer admin-drawer--video"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside
        ref={panelRef}
        className="admin-drawer__panel admin-drawer__panel--video"
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-report-drawer-title"
        tabIndex={-1}
        onKeyDown={(event) => trapDialogFocus(event, panelRef.current)}
      >
        <div className="admin-video-drawer__header">
          <div>
            <p className="admin-eyebrow">Video report</p>
            <h3 id="video-report-drawer-title">{targetTitle(report)}</h3>
            <div className="admin-video-drawer__badges" aria-label="Report and visibility status">
              <PriorityBadge report={report} />
              <StatusBadge status={report.status} />
              <VisibilityBadge report={report} />
              <span className="admin-age-cell">{formatAge(report.created_at)}</span>
            </div>
            <p>
              Created {formatDateTime(report.created_at)} / Report ID <code>{shortId(report.id)}</code>
            </p>
          </div>
          <div className="admin-video-drawer__header-actions">
            <CopyButton value={report.id} label="Copy report ID" />
            <button type="button" className="admin-drawer__close" aria-label="Close video report" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {detailLoading && <p className="admin-inline-status">Refreshing video report detail...</p>}
        {detailError && (
          <div className="admin-inline-error" role="alert">
            <span>{detailError}</span>
            <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={onRetry}>
              Retry
            </button>
          </div>
        )}

        <div className="admin-video-workspace">
          <main className="admin-video-workspace__main">
            <section className="admin-video-review" aria-label="Reported video preview">
              {videoUnavailable ? (
                <div className="admin-video-fallback">
                  {report.target.thumbnail_url ? <img src={report.target.thumbnail_url} alt="" /> : <span aria-hidden="true">V</span>}
                  <div>
                    <strong>Video could not be loaded.</strong>
                    <p>{report.target.unavailable_message || "It may be unavailable or storage-protected."}</p>
                  </div>
                </div>
              ) : (
                <video
                  className="admin-video-player"
                  controls
                  preload="metadata"
                  poster={report.target.thumbnail_url || undefined}
                  aria-label={`Reported video ${report.content_id}`}
                  onError={() => setVideoFailed(true)}
                >
                  <source src={report.target.video_url || undefined} />
                  Video could not be loaded. It may be unavailable or storage-protected.
                </video>
              )}

              <div className="admin-video-review__tools">
                <a href={publicLink} target="_blank" rel="noreferrer" className="admin-btn admin-btn--secondary admin-btn--sm">
                  Open public fallback
                </a>
                <CopyButton value={report.content_id} label="Copy video ID" />
                {report.target.video_url && <CopyButton value={report.target.video_url} label="Copy video URL" />}
              </div>
            </section>

            <section className="admin-drawer__section admin-video-section">
              <h4>Video metadata</h4>
              <dl className="admin-video-meta-grid">
                <div>
                  <dt>Video ID</dt>
                  <dd>
                    <code>{report.content_id}</code> <CopyButton value={report.content_id} label="Copy video ID" compact />
                  </dd>
                </div>
                <div>
                  <dt>Description</dt>
                  <dd>{report.target.description || "No description provided."}</dd>
                </div>
                <div>
                  <dt>Tags</dt>
                  <dd>{report.target.tags?.length ? report.target.tags.join(", ") : "No tags"}</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>{formatDurationSeconds(report.target.duration_seconds)}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDateTime(report.target.created_at)}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDateTime(report.target.updated_at)}</dd>
                </div>
                <div>
                  <dt>State</dt>
                  <dd>{report.target.state || "Not available"}</dd>
                </div>
                <div>
                  <dt>moderation_status</dt>
                  <dd>{report.target.moderation_status || "Not available"}</dd>
                </div>
                <div>
                  <dt>Likes/comments</dt>
                  <dd>
                    {report.target.total_likes ?? "Not available"} likes / {report.target.total_comments ?? "Not available"} comments
                  </dd>
                </div>
                <div>
                  <dt>Creator</dt>
                  <dd>
                    {actorDisplayName(report.target.creator, report.target.owner_id ? shortId(report.target.owner_id) : "Not available")}
                    {report.target.owner_id && <small>{shortId(report.target.owner_id)}</small>}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="admin-drawer__section admin-video-section">
              <h4>Report details</h4>
              <dl className="admin-video-meta-grid">
                <div>
                  <dt>Reason</dt>
                  <dd>{formatReasonLabel(report.reason)}</dd>
                </div>
                <div>
                  <dt>Details</dt>
                  <dd>{report.details || "No details provided."}</dd>
                </div>
                <div>
                  <dt>Reporter</dt>
                  <dd>
                    {actorDisplayName(report.reporter, shortId(report.reporter_id))}
                    <small>{shortId(report.reporter_id)}</small>
                  </dd>
                </div>
                <div>
                  <dt>Reporter ID</dt>
                  <dd>
                    <code>{report.reporter_id}</code> <CopyButton value={report.reporter_id} label="Copy reporter ID" compact />
                  </dd>
                </div>
                <div>
                  <dt>Reported</dt>
                  <dd>
                    {formatDateTime(report.created_at)} <small>{formatRelativeTime(report.created_at)}</small>
                  </dd>
                </div>
                <div>
                  <dt>Related reports</dt>
                  <dd>{report.report_count_for_target ?? report.target_report_count ?? 1}</dd>
                </div>
              </dl>
              <MetadataSummary metadata={report.metadata} />
            </section>

            <section className="admin-drawer__section admin-video-section">
              <h4>Related reports</h4>
              <RelatedReports reports={relatedReports} />
            </section>
          </main>

          <aside className="admin-video-workspace__side" aria-label="Video moderation controls">
            <section className="admin-visibility-card">
              <span>Current video visibility</span>
              <strong>{visibility.title}</strong>
              <p>{visibility.body}</p>
              <dl>
                <div>
                  <dt>Normal users</dt>
                  <dd>{visibility.globallyVisible ? "Can see this video" : "Cannot see this video"}</dd>
                </div>
                <div>
                  <dt>Reporter hidden</dt>
                  <dd>{report.reporter_hidden_for_target ? "Hidden for this reporter" : "Not hidden for this reporter"}</dd>
                </div>
              </dl>
            </section>

            <label className="admin-field admin-field--note">
              <span>Reason for action</span>
              <textarea
                rows={4}
                value={notes}
                onChange={(event) => onNotesChange(event.target.value)}
                placeholder="Optional note for the moderation log"
              />
            </label>

            <section className="admin-action-group admin-action-group--decision" aria-label="Report decision">
              <div className="admin-action-group__header">
                <h4>Report decision</h4>
                <p>Mark reviewed: This only updates the report case. The video remains visible unless a separate content action is taken.</p>
                <p>Dismiss report: This dismisses the report. The video remains visible unless hidden separately.</p>
              </div>
              <div className="admin-action-group__buttons">
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  disabled={busy || report.status === "reviewed"}
                  aria-label="Mark report reviewed without changing video visibility"
                  onClick={onReview}
                >
                  {busy ? "Working..." : "Mark reviewed"}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  disabled={busy || report.status === "dismissed"}
                  aria-label="Dismiss report without changing video visibility"
                  onClick={onDismiss}
                >
                  Dismiss report
                </button>
              </div>
            </section>

            <section className="admin-action-group admin-action-group--global" aria-label="Global video visibility">
              <div className="admin-action-group__header">
                <h4>Global video visibility</h4>
                <p>Hide video: This hides the video from Explore for everyone.</p>
                <p>Remove video: This removes the video from public visibility. The video is not hard-deleted.</p>
                <p>Restore video: This makes the video visible again if its publication state allows it.</p>
              </div>
              <div className="admin-action-group__buttons">
                <button
                  type="button"
                  className="admin-btn admin-btn--danger"
                  disabled={busy || targetUnavailable || !availability.canHide}
                  aria-label="Hide video globally"
                  onClick={() => onModerationAction("hide_video")}
                >
                  {busy ? "Working..." : "Hide video globally"}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--danger"
                  disabled={busy || targetUnavailable || !availability.canRemove}
                  aria-label="Remove video globally"
                  onClick={() => onModerationAction("remove_content")}
                >
                  {busy ? "Working..." : "Remove video globally"}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  disabled={busy || targetUnavailable || !availability.canRestore}
                  aria-label="Restore video to active visibility"
                  onClick={() => onModerationAction("restore_video")}
                >
                  {busy ? "Working..." : "Restore video"}
                </button>
              </div>
            </section>

            <section className="admin-drawer__section admin-video-section">
              <h4>Moderation history</h4>
              <ActionHistory actions={history} />
            </section>
          </aside>
        </div>
      </aside>
    </div>
  );
}

function RelatedReports({ reports }: { reports: NonNullable<AdminReport["related_reports"]> }) {
  if (reports.length === 0) {
    return <p className="admin-muted">No duplicate or related reports found for this video.</p>;
  }

  return (
    <ol className="admin-related-report-list">
      {reports.map((report) => (
        <li key={report.id}>
          <span>
            <strong>{formatReasonLabel(report.reason)}</strong>
            <StatusBadge status={report.status} />
          </span>
          <small>
            {formatDateTime(report.created_at)} / reporter {shortId(report.reporter_id)}
          </small>
        </li>
      ))}
    </ol>
  );
}

function CopyButton({ value, label, compact = false }: { value: string; label: string; compact?: boolean }) {
  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard can be unavailable in non-secure local contexts.
    }
  }

  return (
    <button
      type="button"
      className={`admin-copy-btn ${compact ? "admin-copy-btn--compact" : ""}`}
      aria-label={label}
      title={label}
      onClick={() => void copyValue()}
    >
      Copy
    </button>
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
  const title = status === "pending" && !hasActiveFilters ? "No pending video reports" : "No reports match your filters";
  const message =
    status === "pending" && !hasActiveFilters
      ? "The video moderation queue is clear. New video reports will appear here when users submit them."
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
  const details = confirmationDetails(actionType, report.content_type);
  const dialogRef = useRef<HTMLElement | null>(null);
  const imageUrl = targetImage(report);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div className="admin-confirmation" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onCancel()}>
      <section
        ref={dialogRef}
        className="admin-confirmation__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-confirmation-title"
        tabIndex={-1}
        onKeyDown={(event) => trapDialogFocus(event, dialogRef.current)}
      >
        <p className="admin-eyebrow">Confirmation required</p>
        <h3 id="admin-confirmation-title">{details.title}</h3>
        {report.content_type === "video" && (
          <div className="admin-confirmation__video">
            {imageUrl ? <img src={imageUrl} alt="" /> : <span aria-hidden="true">V</span>}
            <div>
              <strong>{targetTitle(report)}</strong>
              <small>Video ID {shortId(report.content_id)}</small>
            </div>
          </div>
        )}
        <dl className="admin-confirmation__details">
          <div>
            <dt>Target content type</dt>
            <dd>{formatContentTypeLabel(report.content_type)}</dd>
          </div>
          {report.content_type === "video" && (
            <>
              <div>
                <dt>Video ID</dt>
                <dd>
                  <code>{report.content_id}</code>
                </dd>
              </div>
              <div>
                <dt>Report reason</dt>
                <dd>{formatReasonLabel(report.reason)}</dd>
              </div>
            </>
          )}
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
      { type: "hide_video", label: "Hide video globally", variant: "danger" },
      { type: "remove_content", label: "Remove video globally", variant: "danger" },
      { type: "restore_video", label: "Restore video" },
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

function confirmationDetails(actionType: ModerationActionType, contentType?: AdminReport["content_type"]) {
  if (actionType === "hide_video") {
    return {
      title: "Hide video globally",
      consequence: "You are about to hide this video from Explore for all users. The report will remain in the audit trail.",
      variant: "danger" as const,
    };
  }

  if (actionType === "hide_place") {
    return {
      title: "Hide content globally",
      consequence: "This hides the content from Explore for everyone.",
      variant: "danger" as const,
    };
  }

  if (actionType === "remove_content" && contentType === "video") {
    return {
      title: "Remove video globally",
      consequence: "You are about to remove this video from public visibility. This does not hard-delete the video.",
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

  if (actionType === "restore_video") {
    return {
      title: "Restore video",
      consequence: "You are about to restore this video to active visibility. Users who personally hid it may still not see it.",
      variant: "secondary" as const,
    };
  }

  if (actionType === "restore_place") {
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
    const statusDelta = reportWorkflowRank(a.status) - reportWorkflowRank(b.status);
    if (statusDelta !== 0) return statusDelta;
    const priorityDelta = priorityRank(getReportPriority(a)) - priorityRank(getReportPriority(b));
    if (priorityDelta !== 0) return priorityDelta;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }

  const aTime = new Date(a.created_at).getTime();
  const bTime = new Date(b.created_at).getTime();
  return sort === "oldest" ? aTime - bTime : bTime - aTime;
}

function reportWorkflowRank(status: ReportStatus) {
  if (status === "pending") return 0;
  if (status === "reviewed") return 1;
  if (status === "dismissed") return 2;
  return 3;
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
    actorDisplayName(report.reporter, ""),
    actorDisplayName(report.target.creator, ""),
    report.reviewed_by,
    report.target.moderation_status,
    report.target.state,
    report.target.visibility,
    report.target.description,
    report.target.tags?.join(" "),
    targetTitle(report),
    targetSubtitle(report),
    safeMetadataPreview(report.metadata, 20),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
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

function trapDialogFocus(event: ReactKeyboardEvent, container: HTMLElement | null) {
  if (event.key !== "Tab" || !container) return;

  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");

  if (focusable.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
