import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AdminAuthGate } from "@/features/admin/components/AdminAuthGate";
import {
  AdminDataTable,
  AdminNotice,
  AdminPageShell,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatCard,
  StatusBadge,
} from "@/features/admin/components/AdminPrimitives";
import {
  getRevenueIntelligence,
  type BusinessIntelCompare,
  type BusinessIntelRange,
  type RevenueIntelligence,
  type RevenueMaturity,
} from "@/lib/adminAnalyticsApi";

const RANGES: Array<{ value: BusinessIntelRange; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
];

function maturityTone(maturity: RevenueMaturity) {
  if (maturity === "active_measured") return "green" as const;
  if (maturity === "active_incomplete") return "amber" as const;
  return "slate" as const;
}

function maturityLabel(value: RevenueMaturity) {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatEstimatedValue(value: number | null | undefined, currency: string | null | undefined) {
  if (value == null) return "Unavailable";
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  }
  return `${currency || "Currency unavailable"} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function AdminRevenueContent() {
  const [params, setParams] = useSearchParams();
  const range = (RANGES.some((item) => item.value === params.get("range")) ? params.get("range") : "30d") as BusinessIntelRange;
  const compare = (params.get("compare") === "none" ? "none" : "previous") as BusinessIntelCompare;
  const [mode, setMode] = useState<"executive" | "detailed">(() =>
    window.localStorage.getItem("admin:intelligence-mode") === "detailed" ? "detailed" : "executive",
  );
  const [data, setData] = useState<RevenueIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const setQuery = useCallback((key: string, value: string, fallback: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value === fallback) next.delete(key);
      else next.set(key, value);
      return next;
    });
  }, [setParams]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void getRevenueIntelligence({ range, compare, signal: controller.signal })
      .then(setData)
      .catch((reason) => {
        if (reason?.name !== "AbortError") setError(reason instanceof Error ? reason.message : "Revenue readiness could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [compare, range, refreshKey]);

  function changeMode(next: "executive" | "detailed") {
    setMode(next);
    window.localStorage.setItem("admin:intelligence-mode", next);
  }

  const advertisingStream = data?.streams.find((stream) => stream.id === "advertising");

  return (
    <AdminPageShell
      eyebrow="Monetization"
      title="Revenue & Monetization"
      description="Verified financial values, integration readiness, and commercial intent without invented revenue."
      actions={
        <>
          <Link className="admin-btn admin-btn--ghost admin-btn--sm" to={`/admin/analytics/report-builder?dashboard=revenue&range=${range}`}>
            Download PDF
          </Link>
          <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => setRefreshKey((value) => value + 1)}>
            Refresh
          </button>
        </>
      }
    >
      <div className="admin-command-strip">
        <div className="admin-command-strip__period">
          <span>Revenue reporting state</span>
          <strong>{data?.state === "partial" ? "Partially verified" : "Unavailable"}</strong>
          <small>{data?.data_as_of ? `Analytics as of ${new Date(data.data_as_of).toLocaleString()}` : "No financial data as-of timestamp"}</small>
        </div>
        <div className="admin-command-strip__filters">
          <label>
            <span>Range</span>
            <select value={range} onChange={(event) => setQuery("range", event.target.value, "30d")}>
              {RANGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span>Compare</span>
            <select value={compare} onChange={(event) => setQuery("compare", event.target.value, "previous")}>
              <option value="previous">Previous period</option>
              <option value="none">No comparison</option>
            </select>
          </label>
        </div>
        <div className="admin-intelligence-mode" role="group" aria-label="Information density">
          <button type="button" className={mode === "executive" ? "is-active" : ""} onClick={() => changeMode("executive")}>Executive</button>
          <button type="button" className={mode === "detailed" ? "is-active" : ""} onClick={() => changeMode("detailed")}>Detailed</button>
        </div>
      </div>

      {error ? <ErrorState title="Revenue intelligence unavailable" message={error} onRetry={() => setRefreshKey((value) => value + 1)} /> : null}
      {loading ? <LoadingState rows={5} /> : null}
      {!loading && data ? (
        <>
          <AdminNotice
            title="Final recognized revenue is unavailable — not zero"
            message={data.unavailable_reason || "Only reconciled values from an authorized financial system qualify as revenue."}
            tone="amber"
          />

          <section className="admin-executive-section">
            <SectionHeader kicker="Company view" title="Verified performance" meta={<StatusBadge label="Investor-safe" tone="green" />} />
            <div className="admin-revenue-kpis">
              <StatCard label="Verified revenue" value="Unavailable" hint="No reconciled financial source" tone="amber" />
              <StatCard
                label="AdMob estimate"
                value={formatEstimatedValue(advertisingStream?.estimated_value, advertisingStream?.currency)}
                hint={advertisingStream?.estimated_value == null ? "Read-only provider integration is disconnected or unverified" : "Provider-reported estimate · not final revenue"}
                tone={advertisingStream?.estimated_value == null ? "amber" : "blue"}
              />
              <StatCard label="Currency" value="Unavailable" hint="Established by the source integration" />
              <StatCard label="Commercial actions" value={data.commercial_signals.actions?.toLocaleString() ?? "Unavailable"} hint="Intent only — not revenue" tone="blue" />
              <StatCard label="Measured streams" value={String(data.streams.filter((stream) => stream.maturity === "active_measured").length)} hint={`of ${data.streams.length} modeled streams`} />
            </div>
          </section>

          <section className="admin-panel admin-panel--workspace">
            <SectionHeader kicker="Revenue architecture" title="Stream readiness" meta={`${data.streams.length} streams`} />
            <AdminDataTable label="Revenue stream readiness">
              <thead><tr><th>Stream</th><th>Verified / estimated value</th><th>Maturity</th><th>Current state</th>{mode === "detailed" ? <th>Integration requirement</th> : null}</tr></thead>
              <tbody>
                {data.streams.map((stream) => (
                  <tr key={stream.id}>
                    <td><strong>{stream.label}</strong></td>
                    <td>
                      {stream.verified_value == null ? "Verified: unavailable" : `Verified: ${formatEstimatedValue(stream.verified_value, stream.currency)}`}
                      {stream.estimated_value != null ? <><br /><small>Estimate: {formatEstimatedValue(stream.estimated_value, stream.currency)}</small></> : null}
                    </td>
                    <td><StatusBadge label={maturityLabel(stream.maturity)} tone={maturityTone(stream.maturity)} /></td>
                    <td>{stream.status_message}</td>
                    {mode === "detailed" ? <td>{stream.integration_requirement}</td> : null}
                  </tr>
                ))}
              </tbody>
            </AdminDataTable>
          </section>

          {mode === "detailed" ? (
            <section className="admin-panel admin-panel--workspace">
              <SectionHeader kicker="Governance" title="Revenue metric contract" meta={data.metric_catalog.version} />
              <AdminDataTable label="Revenue metric definition">
                <thead><tr><th>Metric</th><th>Definition</th><th>Source</th><th>Availability</th><th>Export</th></tr></thead>
                <tbody>
                  {Object.entries(data.metric_catalog.metrics).filter(([id]) => id === "revenue" || id === "commercial_actions").map(([id, metric]) => (
                    <tr key={id}><td><strong>{metric.label}</strong></td><td>{metric.definition}</td><td>{metric.source}</td><td>{metric.availability.replaceAll("_", " ")}</td><td>{metric.export_eligibility.join(", ")}</td></tr>
                  ))}
                </tbody>
              </AdminDataTable>
            </section>
          ) : null}

          {!data.streams.length ? <EmptyState title="No streams configured" message="Revenue streams will appear after their contracts are defined." /> : null}
          <AdminNotice title="Commercial signal boundary" message={data.commercial_signals.disclaimer} tone="blue" />
        </>
      ) : null}
    </AdminPageShell>
  );
}

export function AdminRevenuePage() {
  return <AdminAuthGate><AdminRevenueContent /></AdminAuthGate>;
}
