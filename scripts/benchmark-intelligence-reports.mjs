import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { buildInvestorSafeSnapshot } from "../server/api-lib/intelligence/reportSnapshotService.mjs";
import { renderIntelligencePdf } from "../server/api-lib/intelligence/pdfReportService.mjs";
import { intelligenceReportFixture } from "../server/api-lib/intelligence/reportFixture.mjs";
import { withReportCapacity } from "../server/api-lib/intelligence/reportRequest.mjs";

const outputDirectory = fileURLToPath(new URL("../docs/admin-v3.3/benchmarks/", import.meta.url));
const output = fileURLToPath(new URL("../docs/admin-v3.3/benchmarks/pdf-benchmark.json", import.meta.url));
await mkdir(outputDirectory, { recursive: true });
const variants = [
  { name: "investor-snapshot-a4-en", reportType: "investor_snapshot", dashboard: "overview", format: "a4", language: "en", detail: "summary" },
  { name: "executive-report-a4-en", reportType: "executive_report", dashboard: "overview", format: "a4", language: "en", detail: "standard", includeDefinitions: true },
  { name: "investor-presentation-16x9-es", reportType: "investor_presentation", dashboard: "overview", format: "16:9", language: "es", detail: "standard" },
  { name: "analyst-report-letter-en", reportType: "analyst_report", dashboard: "operations", format: "letter", language: "en", detail: "detailed", includeDefinitions: true },
  { name: "current-revenue-letter-en", reportType: "current_dashboard", dashboard: "revenue", format: "letter", language: "en", detail: "standard" },
];

const measurements = [];
for (const variant of variants) {
  const snapshot = buildInvestorSafeSnapshot(intelligenceReportFixture(), {
    classification: "investor_safe",
    reportType: variant.reportType,
    generatedAt: "2026-10-14T12:00:00.000Z",
    env: {},
  });
  const durations = [];
  const sizes = [];
  const rssBefore = process.memoryUsage().rss;
  const cpuBefore = process.cpuUsage();
  for (let iteration = 0; iteration < 25; iteration += 1) {
    const started = performance.now();
    const rendered = renderIntelligencePdf(snapshot, {
      ...variant,
      classification: "investor_safe",
      includeDataQuality: true,
      includeOpportunities: true,
      fixture: true,
    });
    durations.push(performance.now() - started);
    sizes.push(rendered.bytes.length);
  }
  const cpu = process.cpuUsage(cpuBefore);
  const sorted = [...durations].sort((a, b) => a - b);
  measurements.push({
    variant: variant.name,
    iterations: durations.length,
    duration_ms: {
      min: Number(sorted[0].toFixed(3)),
      median: Number(sorted[Math.floor(sorted.length / 2)].toFixed(3)),
      p95: Number(sorted[Math.ceil(sorted.length * 0.95) - 1].toFixed(3)),
      max: Number(sorted.at(-1).toFixed(3)),
    },
    cpu_ms: Number(((cpu.user + cpu.system) / 1000).toFixed(3)),
    rss_delta_bytes: process.memoryUsage().rss - rssBefore,
    file_size_bytes: { min: Math.min(...sizes), max: Math.max(...sizes) },
  });
}

let capacityCode = null;
let release;
const gate = new Promise((resolve) => { release = resolve; });
const first = withReportCapacity(() => gate);
const second = withReportCapacity(() => gate);
try {
  await withReportCapacity(async () => null);
} catch (error) {
  capacityCode = error?.code || null;
}
release();
await Promise.all([first, second]);

const report = {
  generated_at: new Date().toISOString(),
  runtime: process.version,
  platform: `${process.platform}/${process.arch}`,
  classification: "local synthetic benchmark; not production or end-to-end latency",
  measurements,
  concurrency_guard: { maximum_active_reports: 2, third_request_error_code: capacityCode, passed: capacityCode === "report_capacity_reached" },
};
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
