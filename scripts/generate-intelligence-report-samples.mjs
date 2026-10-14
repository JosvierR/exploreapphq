import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildInvestorSafeSnapshot } from "../server/api-lib/intelligence/reportSnapshotService.mjs";
import { renderIntelligencePdf } from "../server/api-lib/intelligence/pdfReportService.mjs";
import { intelligenceReportFixture } from "../server/api-lib/intelligence/reportFixture.mjs";
import { reportProductTitle } from "../server/api-lib/intelligence/reportRequest.mjs";

const output = fileURLToPath(new URL("../docs/admin-v3.3/reports/", import.meta.url));
await mkdir(output, { recursive: true });

const samples = [
  ["explore-investor-snapshot-en-a4.pdf", { reportType: "investor_snapshot", dashboard: "overview", format: "a4", language: "en", detail: "summary", classification: "investor_safe", includeDataQuality: false, includeOpportunities: true }],
  ["explore-executive-business-report-eduardo-en-letter.pdf", { reportType: "executive_report", dashboard: "overview", format: "letter", language: "en", detail: "standard", classification: "investor_safe", includeDataQuality: true, includeDefinitions: true, includeOpportunities: true, recipient: "Eduardo", organization: "Explore Board", note: "Prepared for an executive review of observed company activity, reporting confidence, and bounded next investigations." }],
  ["explore-analyst-report-en-letter.pdf", { reportType: "analyst_report", dashboard: "overview", format: "letter", language: "en", detail: "detailed", classification: "executive_business", includeDataQuality: true, includeDefinitions: true, includeOpportunities: true }],
  ["explore-investor-presentation-en-16x9.pdf", { reportType: "investor_presentation", dashboard: "overview", format: "16:9", language: "en", detail: "standard", classification: "investor_safe", includeDataQuality: true, includeOpportunities: true }],
  ["explore-informe-ejecutivo-es-a4.pdf", { reportType: "executive_report", dashboard: "overview", format: "a4", language: "es", detail: "standard", classification: "investor_safe", includeDataQuality: true, includeDefinitions: true, includeOpportunities: true }],
  ["explore-current-overview-en-a4.pdf", { reportType: "current_dashboard", dashboard: "overview", format: "a4", language: "en", detail: "standard", classification: "investor_safe", includeDataQuality: false, includeOpportunities: false }],
  ["explore-current-revenue-en-letter.pdf", { reportType: "current_dashboard", dashboard: "revenue", format: "letter", language: "en", detail: "standard", classification: "investor_safe", includeDataQuality: false, includeOpportunities: false }],
];

for (const [filename, baseOptions] of samples) {
  const options = {
    ...baseOptions,
    fixture: true,
    title: reportProductTitle(baseOptions.reportType, baseOptions.language),
  };
  const snapshot = buildInvestorSafeSnapshot(intelligenceReportFixture(), {
    classification: options.classification,
    reportType: options.reportType,
    generatedAt: "2026-10-14T12:00:00.000Z",
    env: {},
  });
  const { bytes, pageCount, outline } = renderIntelligencePdf(snapshot, options);
  await writeFile(new URL(filename, `file:///${output.replaceAll("\\", "/")}/`), bytes);
  console.log(`${filename}: ${bytes.length} bytes, ${pageCount} pages, ${outline.join(" > ")}`);
}
