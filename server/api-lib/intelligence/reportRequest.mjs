const REPORT_TYPES = new Set(["current_dashboard", "full_executive", "investor_presentation", "detailed"]);
const DASHBOARDS = new Set(["overview", "product", "growth", "tourism", "markets", "revenue", "operations"]);
const FORMATS = new Set(["a4", "letter", "16:9"]);
const LANGUAGES = new Set(["en", "es"]);
const DETAILS = new Set(["executive", "detailed"]);
const CLASSIFICATIONS = new Set(["executive_business", "investor_safe"]);
const SECTIONS = new Set(["executive", "engagement", "markets", "opportunity", "revenue", "quality", "appendix"]);

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

export function validateReportOptions(body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ReportRequestError(400, "Report request must be a JSON object.", "report_invalid_body");
  }
  const reportType = enumValue(body.reportType, REPORT_TYPES, "full_executive", "report_type");
  const requestedFormat = enumValue(body.format, FORMATS, reportType === "investor_presentation" ? "16:9" : "a4", "format");
  if (body.sections != null && !Array.isArray(body.sections)) {
    throw new ReportRequestError(400, "sections must be an array.", "report_invalid_sections");
  }
  const requestedSections = body.sections || [];
  if (requestedSections.length > SECTIONS.size || requestedSections.some((value) => typeof value !== "string" || !SECTIONS.has(value))) {
    throw new ReportRequestError(400, "Invalid report section.", "report_invalid_sections");
  }
  const sections = [...new Set(requestedSections)];
  return {
    reportType,
    dashboard: enumValue(body.dashboard, DASHBOARDS, "overview", "dashboard"),
    format: requestedFormat,
    language: enumValue(body.language, LANGUAGES, "en", "language"),
    detail: enumValue(body.detail, DETAILS, reportType === "detailed" ? "detailed" : "executive", "detail"),
    classification: enumValue(body.classification, CLASSIFICATIONS, "investor_safe", "classification"),
    includeDefinitions: Boolean(body.includeDefinitions || reportType === "detailed"),
    includeDataQuality: body.includeDataQuality !== false,
    includeOpportunities: body.includeOpportunities !== false,
    sections,
    title: textValue(body.title, 100, "title"),
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
