import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminAuthGate } from "@/features/admin/components/AdminAuthGate";
import { AdminNotice, AdminPageShell, ErrorState, SectionHeader } from "@/features/admin/components/AdminPrimitives";
import {
  downloadReportBlob,
  generateIntelligenceReport,
  type BusinessIntelCompare,
  type BusinessIntelRange,
  type IntelligenceReportOptions,
} from "@/lib/adminAnalyticsApi";

const SECTION_OPTIONS = [
  ["executive", "Executive summary"],
  ["engagement", "Growth & engagement"],
  ["markets", "Tourism & markets"],
  ["opportunity", "Commercial opportunity"],
  ["revenue", "Revenue readiness"],
  ["quality", "Data quality & methodology"],
  ["appendix", "Metric definitions"],
] as const;

function ReportBuilderContent() {
  const [query] = useSearchParams();
  const initialDashboard = query.get("dashboard") || "overview";
  const initialRange = query.get("range") || "30d";
  const inheritedRange = (["7d", "30d", "90d", "12m"].includes(initialRange) ? initialRange : "30d") as BusinessIntelRange;
  const inheritedFrom = query.get("date_from") || query.get("start") || "";
  const inheritedTo = query.get("date_to") || query.get("end") || "";
  const inheritedCustom = initialRange === "custom" && Boolean(inheritedFrom && inheritedTo && inheritedFrom <= inheritedTo);
  const inheritedLabel = inheritedCustom ? `${inheritedFrom} – ${inheritedTo}` : inheritedRange;
  const [reportType, setReportType] = useState<IntelligenceReportOptions["reportType"]>("full_executive");
  const [dashboard, setDashboard] = useState<IntelligenceReportOptions["dashboard"]>(
    ["overview", "product", "growth", "tourism", "markets", "revenue", "operations"].includes(initialDashboard)
      ? initialDashboard as IntelligenceReportOptions["dashboard"] : "overview",
  );
  const [range, setRange] = useState<BusinessIntelRange | "custom" | "current">("current");
  const [from, setFrom] = useState(inheritedFrom);
  const [to, setTo] = useState(inheritedTo);
  const [compare, setCompare] = useState<BusinessIntelCompare>(
    (["previous", "previous_year", "none"].includes(query.get("compare") || "") ? query.get("compare") : "previous") as BusinessIntelCompare,
  );
  const [language, setLanguage] = useState<IntelligenceReportOptions["language"]>("en");
  const [format, setFormat] = useState<IntelligenceReportOptions["format"]>("a4");
  const [detail, setDetail] = useState<IntelligenceReportOptions["detail"]>("executive");
  const [classification, setClassification] = useState<IntelligenceReportOptions["classification"]>("investor_safe");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [sections, setSections] = useState<string[]>(SECTION_OPTIONS.slice(0, 6).map(([id]) => id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ filename: string; fingerprint: string | null; pageCount: number | null } | null>(null);

  const customInvalid = range === "custom" && (!from || !to || from > to);
  const estimatedPages = useMemo(() => 1 + sections.length, [sections.length]);

  function toggleSection(section: string) {
    setSections((current) => current.includes(section) ? current.filter((item) => item !== section) : [...current, section]);
  }

  async function createReport() {
    if (customInvalid || sections.length === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const generated = await generateIntelligenceReport({
        reportType,
        dashboard,
        format,
        language,
        detail,
        classification,
        title,
        note,
        sections: reportType === "current_dashboard" ? undefined : sections,
        includeDefinitions: sections.includes("appendix") || detail === "detailed",
        includeDataQuality: sections.includes("quality"),
        includeOpportunities: sections.includes("opportunity"),
      }, {
        ...(range === "custom" || (range === "current" && inheritedCustom)
          ? { date_from: range === "current" ? inheritedFrom : from, date_to: range === "current" ? inheritedTo : to }
          : { range: range === "current" ? inheritedRange : range }),
        compare,
      });
      downloadReportBlob(generated.blob, generated.filename);
      setResult({ filename: generated.filename, fingerprint: generated.fingerprint, pageCount: generated.pageCount });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The report could not be generated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell eyebrow="Reporting" title="Intelligence Report Builder" description="Generate secure, branded reports from one canonical aggregate snapshot.">
      <AdminNotice title="Investor-safe by default" message="Exports contain aggregate analytics only. User identifiers and search text are excluded, and small cohorts are suppressed." tone="green" />
      {error ? <ErrorState title="Report generation failed" message={error} /> : null}

      <div className="admin-report-builder">
        <section className="admin-panel admin-panel--workspace admin-report-builder__form">
          <SectionHeader kicker="1 · Scope" title="Report and period" meta="Required" />
          <div className="admin-report-form-grid">
            <label><span>Report type</span><select value={reportType} onChange={(event) => {
              const next = event.target.value as IntelligenceReportOptions["reportType"];
              setReportType(next);
              if (next === "investor_presentation") setFormat("16:9");
            }}><option value="current_dashboard">Current dashboard</option><option value="full_executive">Full executive report</option><option value="investor_presentation">Investor presentation</option><option value="detailed">Detailed report</option></select></label>
            <label><span>Dashboard</span><select value={dashboard} onChange={(event) => setDashboard(event.target.value as IntelligenceReportOptions["dashboard"])} disabled={reportType !== "current_dashboard"}><option value="overview">Executive overview</option><option value="product">Product</option><option value="growth">Growth</option><option value="tourism">Tourism</option><option value="markets">Markets</option><option value="revenue">Revenue</option><option value="operations">Operations</option></select></label>
            <label><span>Period</span><select value={range} onChange={(event) => setRange(event.target.value as BusinessIntelRange | "custom" | "current")}><option value="current">Current dashboard ({inheritedLabel})</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="12m">Last 12 months</option><option value="custom">Custom</option></select></label>
            <label><span>Comparison</span><select value={compare} onChange={(event) => setCompare(event.target.value as BusinessIntelCompare)}><option value="previous">Previous period</option><option value="previous_year">Previous year</option><option value="none">None</option></select></label>
            {range === "custom" ? <><label><span>From</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label><span>To</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></> : null}
          </div>

          <SectionHeader kicker="2 · Presentation" title="Language and format" />
          <div className="admin-report-form-grid">
            <label><span>Language</span><select value={language} onChange={(event) => setLanguage(event.target.value as IntelligenceReportOptions["language"])}><option value="en">English</option><option value="es">Español</option></select></label>
            <label><span>Page format</span><select value={format} onChange={(event) => setFormat(event.target.value as IntelligenceReportOptions["format"])}><option value="a4">A4 portrait</option><option value="letter">US Letter portrait</option><option value="16:9">16:9 presentation</option></select></label>
            <label><span>Detail</span><select value={detail} onChange={(event) => setDetail(event.target.value as IntelligenceReportOptions["detail"])}><option value="executive">Executive</option><option value="detailed">Detailed</option></select></label>
            <label><span>Classification</span><select value={classification} onChange={(event) => setClassification(event.target.value as IntelligenceReportOptions["classification"])}><option value="investor_safe">Investor-safe</option><option value="executive_business">Executive business</option></select></label>
          </div>

          {reportType !== "current_dashboard" ? <><SectionHeader kicker="3 · Narrative" title="Sections" meta={`${sections.length} selected`} /><div className="admin-report-section-picker">{SECTION_OPTIONS.map(([id, label]) => <label key={id}><input type="checkbox" checked={sections.includes(id)} onChange={() => toggleSection(id)} /><span>{label}</span></label>)}</div></> : null}

          <SectionHeader kicker="4 · Context" title="Optional cover copy" />
          <div className="admin-report-form-grid admin-report-form-grid--copy">
            <label><span>Report title</span><input maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Explore executive intelligence" /></label>
            <label><span>Executive note</span><textarea maxLength={360} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional context for this audience" /></label>
          </div>
          {customInvalid ? <p className="admin-report-builder__error">Choose a valid custom date range.</p> : null}
          <button type="button" className="admin-btn admin-btn--primary" disabled={busy || customInvalid || (reportType !== "current_dashboard" && sections.length === 0)} onClick={() => void createReport()}>{busy ? "Generating secure PDF…" : "Generate & download PDF"}</button>
        </section>

        <aside className="admin-panel admin-panel--workspace admin-report-builder__summary">
          <SectionHeader kicker="Export summary" title="What will be generated" meta={classification === "investor_safe" ? "Investor-safe" : "Executive"} />
          <dl>
            <div><dt>Source</dt><dd>Canonical Business Analytics Core</dd></div>
            <div><dt>Pages</dt><dd>{reportType === "current_dashboard" ? "2–3" : `About ${estimatedPages}`}</dd></div>
            <div><dt>Delivery</dt><dd>Private direct download; no public storage</dd></div>
            <div><dt>Revenue</dt><dd>Unavailable unless a verified source is connected</dd></div>
            <div><dt>Privacy</dt><dd>Aggregate only; small cohorts suppressed</dd></div>
          </dl>
          {result ? <div className="admin-report-builder__success" role="status"><strong>Downloaded</strong><span>{result.filename}</span><small>{result.pageCount ? `${result.pageCount} pages · ` : ""}{result.fingerprint ? `Snapshot ${result.fingerprint}` : ""}</small></div> : null}
        </aside>
      </div>
    </AdminPageShell>
  );
}

export function AdminReportBuilderPage() {
  return <AdminAuthGate><ReportBuilderContent /></AdminAuthGate>;
}
