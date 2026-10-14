import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildInvestorSafeSnapshot } from "../server/api-lib/intelligence/reportSnapshotService.mjs";
import { renderIntelligencePdf } from "../server/api-lib/intelligence/pdfReportService.mjs";
import { intelligenceReportFixture } from "../server/api-lib/intelligence/reportFixture.mjs";

const output = fileURLToPath(new URL("../docs/admin-v3.2/reports/", import.meta.url));
await mkdir(output, { recursive: true });
const snapshot = buildInvestorSafeSnapshot(intelligenceReportFixture(), {
  classification: "investor_safe",
  generatedAt: "2026-10-14T12:00:00.000Z",
  env: {},
});
const partialDashboard = intelligenceReportFixture();
partialDashboard.data_quality = {
  ...partialDashboard.data_quality,
  rejected_events_in_range: 1068,
  rejection_coverage_pct: 26.8,
  rejection_coverage_note: "Synthetic partial-quality scenario for report validation.",
};
const partialSnapshot = buildInvestorSafeSnapshot(partialDashboard, {
  classification: "investor_safe",
  generatedAt: "2026-10-14T12:00:00.000Z",
  env: {},
});
const samples = [
  [snapshot, "explore-intelligence-sample-en-a4.pdf", { reportType: "full_executive", dashboard: "overview", format: "a4", language: "en", detail: "executive", classification: "investor_safe", includeDataQuality: true, includeOpportunities: true, fixture: true, title: "Explore Executive Intelligence" }],
  [snapshot, "explore-intelligence-sample-es-16x9.pdf", { reportType: "investor_presentation", dashboard: "overview", format: "16:9", language: "es", detail: "executive", classification: "investor_safe", includeDataQuality: true, includeOpportunities: true, fixture: true, title: "Inteligencia Ejecutiva de Explore" }],
  [snapshot, "explore-intelligence-sample-revenue-en-letter.pdf", { reportType: "current_dashboard", dashboard: "revenue", format: "letter", language: "en", detail: "executive", classification: "investor_safe", includeDataQuality: true, fixture: true, title: "Explore Revenue Readiness" }],
  [snapshot, "explore-intelligence-sample-tourism-es-a4.pdf", { reportType: "current_dashboard", dashboard: "tourism", format: "a4", language: "es", detail: "executive", classification: "investor_safe", includeDataQuality: true, fixture: true, title: "Inteligencia Turística de Explore" }],
  [partialSnapshot, "explore-intelligence-sample-partial-quality-en-letter.pdf", { reportType: "detailed", dashboard: "operations", format: "letter", language: "en", detail: "detailed", classification: "investor_safe", includeDataQuality: true, includeDefinitions: true, fixture: true, title: "Explore Intelligence Reliability, Coverage, Confidence, and Reporting Integrity Review", note: "Synthetic validation scenario: the selected window contains material historical rejections; behavioral metrics are under investigation and must not be presented without this qualification." }],
];
for (const [sampleSnapshot, filename, options] of samples) {
  const { bytes } = renderIntelligencePdf(sampleSnapshot, options);
  await writeFile(new URL(filename, `file:///${output.replaceAll("\\", "/")}/`), bytes);
  console.log(`${filename}: ${bytes.length} bytes`);
}
