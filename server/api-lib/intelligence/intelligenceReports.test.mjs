import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildRevenueIntelligence } from "./revenueIntelligenceService.mjs";
import { buildInvestorSafeSnapshot, MIN_INVESTOR_COHORT } from "./reportSnapshotService.mjs";
import { renderIntelligencePdf } from "./pdfReportService.mjs";
import { reportFilename, validateReportOptions, withReportCapacity } from "./reportRequest.mjs";
import { intelligenceReportFixture } from "./reportFixture.mjs";

test("revenue values remain unavailable without a reconciled financial source", () => {
  const revenue = buildRevenueIntelligence(intelligenceReportFixture(), {});
  assert.equal(revenue.total_verified_revenue, null);
  assert.equal(revenue.currency, null);
  assert.equal(revenue.state, "unavailable");
  assert.ok(revenue.streams.every((stream) => stream.verified_value === null));
  assert.ok(revenue.streams.every((stream) => stream.maturity === "integration_pending" || stream.maturity === "planned"));
  assert.match(revenue.commercial_signals.disclaimer, /not transactions, sales, or revenue/i);
});

test("investor-safe snapshot suppresses small cohorts and identifiers", () => {
  const snapshot = buildInvestorSafeSnapshot(intelligenceReportFixture(), {
    generatedAt: "2026-10-13T12:00:00.000Z",
    env: {},
  });
  assert.equal(MIN_INVESTOR_COHORT, 5);
  assert.ok(snapshot.markets.every((row) => row.count >= MIN_INVESTOR_COHORT));
  assert.ok(snapshot.insights.every((row) => !/SECRET USER EMAIL/.test(row.title)));
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /private query/i);
  assert.doesNotMatch(serialized, /private query|secret user email/i);
  assert.equal(snapshot.headline.active_users, 18420);
  assert.equal(snapshot.headline.verified_revenue, null);
});

test("PDF variants are valid, selectable, deterministic report structures", () => {
  const snapshot = buildInvestorSafeSnapshot(intelligenceReportFixture(), {
    generatedAt: "2026-10-13T12:00:00.000Z",
    env: {},
  });
  const variants = [
    { reportType: "current_dashboard", dashboard: "growth", format: "a4", language: "en" },
    { reportType: "full_executive", dashboard: "overview", format: "letter", language: "es" },
    { reportType: "investor_presentation", dashboard: "overview", format: "16:9", language: "en" },
    { reportType: "detailed", dashboard: "overview", format: "a4", language: "es", includeDefinitions: true },
  ];
  for (const variant of variants) {
    const rendered = renderIntelligencePdf(snapshot, { ...variant, classification: "investor_safe", fixture: true });
    const raw = rendered.bytes.toString("latin1");
    assert.ok(raw.startsWith("%PDF-1.4"));
    assert.ok(raw.endsWith("%%EOF\n"));
    assert.equal((raw.match(/\/Type \/Page\b/g) || []).length, rendered.pageCount);
    assert.match(raw, /EXPLORE/);
    assert.match(raw, /Revenue|revenue|ingresos|Ingresos/);
    if (variant.reportType !== "current_dashboard") assert.match(raw, /Unavailable|No disponible/);
    assert.doesNotMatch(raw, /private query|SECRET USER EMAIL/i);
    assert.ok(rendered.bytes.length > 4_000);
    if (variant.reportType === "full_executive") assert.match(raw, /\(18,420\)/);
    if (variant.format === "16:9") assert.match(raw, /\/MediaBox \[0 0 960 540\]/);
  }
});

test("report requests are allowlisted and filenames are deterministic", () => {
  const options = validateReportOptions({ reportType: "investor_presentation", format: "16:9", language: "es", title: "  Consejo  " });
  assert.equal(options.title, "Consejo");
  assert.throws(() => validateReportOptions({ reportType: "../../unsafe" }), /Invalid report_type/);
  assert.throws(() => validateReportOptions({ title: "x".repeat(101) }), /too long/);
  assert.throws(() => validateReportOptions([]), /JSON object/);
  assert.throws(() => validateReportOptions({ sections: ["executive", "raw_events"] }), /Invalid report section/);
  assert.throws(() => validateReportOptions({ note: { unsafe: true } }), /must be text/);
  const snapshot = buildInvestorSafeSnapshot(intelligenceReportFixture(), { generatedAt: "2026-10-13T12:00:00.000Z", env: {} });
  assert.equal(reportFilename(snapshot, options), "explore-intelligence_investor_presentation_2026-09-13_2026-10-12_es.pdf");
});

test("report generation rejects excess concurrent work", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const first = withReportCapacity(() => gate);
  const second = withReportCapacity(() => gate);
  await assert.rejects(() => withReportCapacity(async () => "third"), (error) => error.status === 429);
  release();
  await Promise.all([first, second]);
});

test("report endpoint requires admin auth and returns private non-stored PDFs", async () => {
  const source = await readFile(new URL("../analytics/businessIntelligenceApi.mjs", import.meta.url), "utf8");
  const start = source.indexOf("export async function handleBusinessIntelReports");
  const end = source.indexOf("export const ADMIN_BUSINESS_INTEL_ROUTES", start);
  const handler = source.slice(start, end);
  assert.match(handler, /await requireAdmin\(request\)/);
  assert.match(handler, /buildInvestorSafeSnapshot/);
  assert.match(handler, /"Cache-Control": "private, no-store, max-age=0"/);
  assert.doesNotMatch(handler, /\.upload\(|\.storage\.|publicURL/i);
});
