const REPORT_TYPE_ALIASES = Object.freeze({
  full_executive: "executive_report",
  detailed: "analyst_report",
});
const REPORT_TYPES = new Set(["current_dashboard", "investor_snapshot", "executive_report", "analyst_report", "investor_presentation"]);
const DASHBOARDS = new Set(["overview", "product", "growth", "tourism", "markets", "revenue", "operations"]);
const FORMATS = new Set(["a4", "letter", "16:9"]);
const LANGUAGES = new Set(["en", "es"]);
const DETAILS = new Set(["summary", "standard", "detailed"]);
const CLASSIFICATIONS = new Set(["executive_business", "investor_safe"]);
const SECTIONS = new Set(["traction", "activity", "product", "markets", "commercial", "revenue", "quality", "analyst_tables", "conclusions", "glossary", "technical"]);
const LEGACY_SECTION_ALIASES = Object.freeze({
  executive: "traction",
  engagement: "activity",
  opportunity: "commercial",
  appendix: "glossary",
});

export class ReportRequestError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function enumValue(value, allowed, fallback, field) {
  const candidate = String(value || fallback);
  if (!allowed.has(candidate)) throw new ReportRequestError(400, `Invalid ${field}.`, `report_invalid_${field}`);
  return candidate;
}

function textValue(value, max, field) {
  if (value != null && typeof value !== "string") {
    throw new ReportRequestError(400, `${field} must be text.`, `report_invalid_${field}`);
  }
  const text = String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (text.length > max) throw new ReportRequestError(400, `${field} is too long.`, `report_${field}_too_long`);
  return text;
}

export function reportProductTitle(reportType, language = "en") {
  const spanish = language === "es";
  return {
    current_dashboard: spanish ? "Exportación del panel de Explore" : "Explore Dashboard Report",
    investor_snapshot: spanish ? "Resumen para inversionistas de Explore" : "Explore Investor Snapshot",
    executive_report: spanish ? "Informe ejecutivo de negocios de Explore" : "Explore Executive Business Report",
    analyst_report: spanish ? "Informe analítico de Explore" : "Explore Analyst Report",
    investor_presentation: spanish ? "Presentación para inversionistas de Explore" : "Explore Investor Presentation",
  }[reportType] || (spanish ? "Informe de Explore Intelligence" : "Explore Intelligence Report");
}

export function validateReportOptions(body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ReportRequestError(400, "Report request must be a JSON object.", "report_invalid_body");
  }
  const requestedType = String(body.reportType || "executive_report");
  const reportType = REPORT_TYPE_ALIASES[requestedType] || requestedType;
  if (!REPORT_TYPES.has(reportType)) throw new ReportRequestError(400, "Invalid report_type.", "report_invalid_report_type");
  const format = enumValue(body.format, FORMATS, reportType === "investor_presentation" ? "16:9" : "a4", "format");
  if (reportType === "investor_presentation" && format !== "16:9") {
    throw new ReportRequestError(400, "Investor presentations require 16:9 format.", "report_format_not_supported");
  }
  if (body.sections != null && !Array.isArray(body.sections)) {
    throw new ReportRequestError(400, "sections must be an array.", "report_invalid_sections");
  }
  const requestedSections = (body.sections || []).map((value) => LEGACY_SECTION_ALIASES[value] || value);
  if (requestedSections.length > SECTIONS.size || requestedSections.some((value) => typeof value !== "string" || !SECTIONS.has(value))) {
    throw new ReportRequestError(400, "Invalid report section.", "report_invalid_sections");
  }
  const language = enumValue(body.language, LANGUAGES, "en", "language");
  const legacyDetail = body.detail === "executive" ? "standard" : body.detail;
  const detail = enumValue(legacyDetail, DETAILS, reportType === "analyst_report" ? "detailed" : reportType === "investor_snapshot" ? "summary" : "standard", "detail");
  const title = textValue(body.title, 120, "title");
  return {
    reportType,
    dashboard: enumValue(body.dashboard, DASHBOARDS, "overview", "dashboard"),
    format,
    language,
    detail,
    classification: enumValue(body.classification, CLASSIFICATIONS, "investor_safe", "classification"),
    includeDefinitions: Boolean(body.includeDefinitions || reportType === "analyst_report"),
    includeDataQuality: body.includeDataQuality !== false,
    includeOpportunities: body.includeOpportunities !== false,
    sections: [...new Set(requestedSections)],
    title: title || reportProductTitle(reportType, language),
    subtitle: textValue(body.subtitle, 160, "subtitle"),
    recipient: textValue(body.recipient, 100, "recipient"),
    organization: textValue(body.organization, 120, "organization"),
    note: textValue(body.note, 360, "note"),
    fixture: false,
  };
}

export function reportFilename(snapshot, options) {
  const period = `${snapshot.range?.start || "unknown"}_${snapshot.range?.end || "unknown"}`;
  const type = options.reportType.replace(/[^a-z0-9_-]/gi, "-");
  const lang = options.language;
  return `explore-intelligence_${type}_${period}_${lang}.pdf`;
}

let activeReports = 0;
const MAX_ACTIVE_REPORTS = 2;

export async function withReportCapacity(operation) {
  if (activeReports >= MAX_ACTIVE_REPORTS) {
    throw new ReportRequestError(429, "Report generation is busy. Try again shortly.", "report_capacity_reached");
  }
  activeReports += 1;
  try {
    return await operation();
  } finally {
    activeReports -= 1;
  }
}
