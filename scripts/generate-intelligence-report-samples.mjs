import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildInvestorSafeSnapshot } from "../server/api-lib/intelligence/reportSnapshotService.mjs";
import { renderIntelligencePdf } from "../server/api-lib/intelligence/pdfReportService.mjs";
import { intelligenceReportFixture } from "../server/api-lib/intelligence/reportFixture.mjs";

const output = fileURLToPath(new URL("../docs/admin-v3.1/reports/", import.meta.url));
await mkdir(output, { recursive: true });
const snapshot = buildInvestorSafeSnapshot(intelligenceReportFixture(), {
  classification: "investor_safe",
  generatedAt: "2026-10-13T12:00:00.000Z",
  env: {},
});
const samples = [
  ["explore-intelligence-sample-en-a4.pdf", { reportType: "full_executive", dashboard: "overview", format: "a4", language: "en", detail: "executive", classification: "investor_safe", includeDataQuality: true, includeOpportunities: true, fixture: true, title: "Explore Executive Intelligence" }],
  ["explore-intelligence-sample-es-16x9.pdf", { reportType: "investor_presentation", dashboard: "overview", format: "16:9", language: "es", detail: "executive", classification: "investor_safe", includeDataQuality: true, includeOpportunities: true, fixture: true, title: "Inteligencia Ejecutiva de Explore" }],
  ["explore-intelligence-sample-revenue-en-letter.pdf", { reportType: "current_dashboard", dashboard: "revenue", format: "letter", language: "en", detail: "executive", classification: "investor_safe", includeDataQuality: true, fixture: true, title: "Explore Revenue Readiness" }],
  ["explore-intelligence-sample-tourism-es-a4.pdf", { reportType: "current_dashboard", dashboard: "tourism", format: "a4", language: "es", detail: "executive", classification: "investor_safe", includeDataQuality: true, fixture: true, title: "Inteligencia Turística de Explore" }],
];
for (const [filename, options] of samples) {
  const { bytes } = renderIntelligencePdf(snapshot, options);
  await writeFile(new URL(filename, `file:///${output.replaceAll("\\", "/")}/`), bytes);
  console.log(`${filename}: ${bytes.length} bytes`);
}
