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
  ["traction", "Executive traction"],
  ["activity", "Growth & activity"],
  ["product", "Product behavior"],
  ["markets", "Destination markets"],
  ["commercial", "Commercial evidence"],
  ["revenue", "Financial performance"],
  ["quality", "Reporting integrity"],
  ["analyst_tables", "Supporting analyst tables"],
  ["conclusions", "Conclusions & limitations"],
  ["glossary", "Metric glossary"],
  ["technical", "Technical appendix"],
] as const;

type ReportType = IntelligenceReportOptions["reportType"];

const PRODUCT_PRESETS: Record<ReportType, {
  label: string;
  description: string;
  detail: IntelligenceReportOptions["detail"];
  format: IntelligenceReportOptions["format"];
  sections: string[];
}> = {
  current_dashboard: {
    label: "Current dashboard export",
    description: "A focused export of one dashboard, plus its reporting context.",
    detail: "standard",
    format: "a4",
    sections: [],
  },
  investor_snapshot: {
    label: "Investor Snapshot",
    description: "A concise, decision-led briefing that omits unsupported financial sections.",
    detail: "summary",
    format: "a4",
    sections: ["traction", "activity", "product", "markets", "commercial", "conclusions"],
  },
  executive_report: {
    label: "Executive Business Report",
    description: "A board-ready operating narrative with evidence, qualifications, and definitions.",
    detail: "standard",
    format: "a4",
    sections: ["traction", "activity", "product", "markets", "commercial", "revenue", "quality", "conclusions", "glossary"],
  },
  analyst_report: {
    label: "Analyst Report",
    description: "A detailed reproducible report with supporting tables, glossary, and audit appendix.",
    detail: "detailed",
    format: "letter",
    sections: SECTION_OPTIONS.map(([id]) => id),
  },
  investor_presentation: {
    label: "Investor Presentation",
    description: "A 16:9 narrative for live review, with one analytical idea per page.",
    detail: "standard",
    format: "16:9",
    sections: ["traction", "activity", "product", "markets", "commercial", "revenue", "conclusions", "quality"],
  },
};

function ReportBuilderContent() {
  const [query] = useSearchParams();
  const initialDashboard = query.get("dashboard") || "overview";
  const initialRange = query.get("range") || "30d";
  const inheritedRange = (["7d", "30d", "90d", "12m"].includes(initialRange) ? initialRange : "30d") as BusinessIntelRange;
  const inheritedFrom = query.get("date_from") || query.get("start") || "";
  const inheritedTo = query.get("date_to") || query.get("end") || "";
  const inheritedCustom = initialRange === "custom" && Boolean(inheritedFrom && inheritedTo && inheritedFrom <= inheritedTo);
  const inheritedLabel = inheritedCustom ? `${inheritedFrom} – ${inheritedTo}` : inheritedRange;
  const [reportType, setReportType] = useState<ReportType>("executive_report");
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
  const [format, setFormat] = useState<IntelligenceReportOptions["format"]>(PRODUCT_PRESETS.executive_report.format);
  const [detail, setDetail] = useState<IntelligenceReportOptions["detail"]>(PRODUCT_PRESETS.executive_report.detail);
  const [classification, setClassification] = useState<IntelligenceReportOptions["classification"]>("investor_safe");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [recipient, setRecipient] = useState("");
  const [organization, setOrganization] = useState("");
  const [note, setNote] = useState("");
  const [sections, setSections] = useState<string[]>(PRODUCT_PRESETS.executive_report.sections);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ filename: string; fingerprint: string | null; pageCount: number | null } | null>(null);

  const customInvalid = range === "custom" && (!from || !to || from > to);
  const selectedProduct = PRODUCT_PRESETS[reportType];
  const supportedSectionOptions = useMemo(
    () => SECTION_OPTIONS.filter(([id]) => id !== "analyst_tables" || reportType === "analyst_report"),
    [reportType],
  );
  const outline = useMemo(() => {
    if (reportType === "current_dashboard") return ["Cover", `${dashboard[0].toUpperCase()}${dashboard.slice(1)} dashboard`];
    return ["Cover", ...supportedSectionOptions.filter(([id]) => sections.includes(id)).map(([, label]) => label)];
  }, [dashboard, reportType, sections, supportedSectionOptions]);

  function selectProduct(next: ReportType) {
    const preset = PRODUCT_PRESETS[next];
    setReportType(next);
    setFormat(preset.format);
    setDetail(preset.detail);
    setSections(preset.sections);
  }

  function toggleSection(section: string) {
    setSections((current) => current.includes(section) ? current.filter((item) => item !== section) : [...current, section]);
  }

  async function createReport() {
    if (customInvalid || (reportType !== "current_dashboard" && sections.length === 0)) return;
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
        subtitle,
        recipient,
        organization,
        note,
        sections: reportType === "current_dashboard" ? undefined : sections,
        includeDefinitions: sections.includes("glossary") || detail === "detailed",
        includeDataQuality: sections.includes("quality"),
        includeOpportunities: sections.includes("commercial"),
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
    <AdminPageShell eyebrow="Reporting" title="Intelligence Report Builder" description="Create investor-grade reporting from one canonical aggregate snapshot.">
      <AdminNotice title="Investor-safe by default" message="Exports exclude user identifiers and search text, suppress small cohorts, and omit unsupported sections instead of filling them with setup guidance." tone="green" />
      {error ? <ErrorState title="Report generation failed" message={error} /> : null}

      <div className="admin-report-builder">
        <section className="admin-panel admin-panel--workspace admin-report-builder__form">
          <SectionHeader kicker="1 · Product" title="Choose the analytical deliverable" meta="Required" />
          <div className="admin-report-products" role="radiogroup" aria-label="Report product">
            {(Object.entries(PRODUCT_PRESETS) as Array<[ReportType, (typeof PRODUCT_PRESETS)[ReportType]]>).map(([id, product]) => (
              <button key={id} type="button" role="radio" aria-checked={reportType === id} className={reportType === id ? "is-active" : ""} onClick={() => selectProduct(id)}>
                <strong>{product.label}</strong><span>{product.description}</span>
              </button>
            ))}
          </div>

          <SectionHeader kicker="2 · Scope" title="Reporting period" />
          <div className="admin-report-form-grid">
            <label><span>Dashboard</span><select value={dashboard} onChange={(event) => setDashboard(event.target.value as IntelligenceReportOptions["dashboard"])} disabled={reportType !== "current_dashboard"}><option value="overview">Executive overview</option><option value="product">Product</option><option value="growth">Growth</option><option value="tourism">Tourism</option><option value="markets">Markets</option><option value="revenue">Revenue</option><option value="operations">Operations</option></select></label>
            <label><span>Period</span><select value={range} onChange={(event) => setRange(event.target.value as BusinessIntelRange | "custom" | "current")}><option value="current">Current dashboard ({inheritedLabel})</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="12m">Last 12 months</option><option value="custom">Custom</option></select></label>
            <label><span>Comparison</span><select value={compare} onChange={(event) => setCompare(event.target.value as BusinessIntelCompare)}><option value="previous">Previous period</option><option value="previous_year">Previous year</option><option value="none">None</option></select></label>
            {range === "custom" ? <><label><span>From</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label><span>To</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></> : null}
          </div>

          <SectionHeader kicker="3 · Presentation" title="Language, format, and disclosure" />
          <div className="admin-report-form-grid">
            <label><span>Language</span><select value={language} onChange={(event) => setLanguage(event.target.value as IntelligenceReportOptions["language"])}><option value="en">English</option><option value="es">Español</option></select></label>
            <label><span>Page format</span><select value={format} disabled={reportType === "investor_presentation"} onChange={(event) => setFormat(event.target.value as IntelligenceReportOptions["format"])}><option value="a4">A4 portrait</option><option value="letter">US Letter portrait</option><option value="16:9">16:9 presentation</option></select></label>
            <label><span>Detail</span><select value={detail} onChange={(event) => setDetail(event.target.value as IntelligenceReportOptions["detail"])}><option value="summary">Summary</option><option value="standard">Standard</option><option value="detailed">Detailed</option></select></label>
            <label><span>Classification</span><select value={classification} onChange={(event) => setClassification(event.target.value as IntelligenceReportOptions["classification"])}><option value="investor_safe">Investor-safe</option><option value="executive_business">Executive business</option></select></label>
          </div>

          {reportType !== "current_dashboard" ? <><SectionHeader kicker="4 · Narrative" title="Eligible sections" meta={`${sections.length} selected`} /><p className="admin-report-builder__help">Selection controls the requested outline. Sections without qualifying evidence may still be omitted at generation time.</p><div className="admin-report-section-picker">{supportedSectionOptions.map(([id, label]) => <label key={id}><input type="checkbox" checked={sections.includes(id)} onChange={() => toggleSection(id)} /><span>{label}</span></label>)}</div></> : null}

          <SectionHeader kicker="5 · Cover" title="Audience and report identity" />
          <div className="admin-report-form-grid admin-report-form-grid--copy">
            <label><span>Report title</span><input maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={selectedProduct.label} /></label>
            <label><span>Subtitle</span><input maxLength={160} value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="Executive analytics and decision support" /></label>
            <label><span>Prepared for</span><input maxLength={100} value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Recipient name" /></label>
            <label><span>Organization</span><input maxLength={120} value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="Organization" /></label>
            <label className="admin-report-form-grid__wide"><span>Executive note</span><textarea maxLength={360} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional audience context; this never replaces the document title" /></label>
          </div>
          {customInvalid ? <p className="admin-report-builder__error">Choose a valid custom date range.</p> : null}
          <button type="button" className="admin-btn admin-btn--primary" disabled={busy || customInvalid || (reportType !== "current_dashboard" && sections.length === 0)} onClick={() => void createReport()}>{busy ? "Loading the canonical snapshot and rendering…" : "Generate & download PDF"}</button>
        </section>

        <aside className="admin-panel admin-panel--workspace admin-report-builder__summary">
          <SectionHeader kicker="Content preview" title={selectedProduct.label} meta={classification === "investor_safe" ? "Investor-safe" : "Executive"} />
          <p>{selectedProduct.description}</p>
          <ol className="admin-report-outline">{outline.map((item) => <li key={item}>{item}</li>)}</ol>
          <dl>
            <div><dt>Source</dt><dd>Canonical Business Analytics Core</dd></div>
            <div><dt>Length</dt><dd>Content-aware; only evidence-eligible sections render</dd></div>
            <div><dt>Delivery</dt><dd>Private direct download; no public storage</dd></div>
            <div><dt>Financial boundary</dt><dd>Unverified revenue is unavailable, never zero</dd></div>
            <div><dt>Privacy</dt><dd>Aggregate only; minimum cohort rules apply</dd></div>
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
