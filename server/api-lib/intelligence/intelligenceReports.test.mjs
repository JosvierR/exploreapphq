import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildRevenueIntelligence } from "./revenueIntelligenceService.mjs";
import { admobConfigurationStatus, createAdMobRevenueAdapter } from "./admobRevenueAdapter.mjs";
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

test("AdMob adapter remains disconnected without credentials and never invents zero revenue", async () => {
  assert.deepEqual(admobConfigurationStatus({}).missing, [
    "ADMOB_PUBLISHER_ID",
    "ADMOB_OAUTH_CLIENT_ID",
    "ADMOB_OAUTH_REFRESH_TOKEN",
  ]);
  let called = false;
  const adapter = createAdMobRevenueAdapter({ env: {}, fetchImpl: async () => { called = true; } });
  const result = await adapter.getNetworkRevenue({ start: "2026-10-01", end: "2026-10-02" });
  assert.equal(result.status, "disconnected");
  assert.equal(result.data, null);
  assert.equal(called, false);
});

test("AdMob adapter uses read-only reporting and classifies earnings as estimates", async () => {
  const calls = [];
  const env = {
    ADMOB_PUBLISHER_ID: "pub-test-3-2",
    ADMOB_OAUTH_CLIENT_ID: "client-id",
    ADMOB_OAUTH_CLIENT_SECRET: "client-secret-value",
    ADMOB_OAUTH_REFRESH_TOKEN: "refresh-secret-value",
    ADMOB_CURRENCY_CODE: "USD",
  };
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (String(url).includes("oauth2.googleapis.com")) {
      return new Response(JSON.stringify({ access_token: "short-lived-access-token" }), { status: 200 });
    }
    return new Response(JSON.stringify([
      { header: { localizationSettings: { currencyCode: "USD" } } },
      { row: {
        dimensionValues: { DATE: { value: "20261001", displayLabel: "2026-10-01" } },
        metricValues: {
          ESTIMATED_EARNINGS: { microsValue: "1230000" },
          IMPRESSIONS: { integerValue: "500" },
          CLICKS: { integerValue: "25" },
        },
      } },
      { footer: { matchingRowCount: "1" } },
    ]), { status: 200 });
  };
  const adapter = createAdMobRevenueAdapter({ env, fetchImpl, cacheTtlMs: 1 });
  const result = await adapter.getNetworkRevenue({
    start: "2026-10-01",
    end: "2026-10-02",
    dimensions: ["DATE", "APP", "COUNTRY", "FORMAT", "PLATFORM"],
  });
  assert.equal(result.status, "connected_estimated");
  assert.equal(result.data.estimated_earnings, 1.23);
  assert.equal(result.data.currency, "USD");
  assert.equal(result.data.finality, "estimated_not_final");
  assert.equal(result.data.impressions, 500);
  assert.equal(calls.length, 2);
  assert.equal(JSON.parse(calls[1].init.body).reportSpec.maxReportRows, 10000);
  assert.doesNotMatch(JSON.stringify(result), /refresh-secret-value|client-secret-value|short-lived-access-token/);
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
  assert.equal(snapshot.contract_version, "explore-intelligence-report-v3");
  assert.equal(snapshot.metric_catalog_version, "investor-metrics-v3");
  assert.equal(snapshot.metric_confidence.metrics.active_users.status, "verified");
  assert.equal(snapshot.metric_confidence.metrics.verified_revenue.status, "unavailable");
  assert.equal(snapshot.data_readiness.metrics.active_users.investor_headline_eligible, true);
  assert.match(snapshot.insights[0].question, /category/i);
  assert.match(snapshot.insights[0].limitation, /not market demand/i);
  assert.ok(snapshot.routes.every((row) => !Object.hasOwn(row, "route_id")));
  assert.equal(snapshot.timezone, "UTC");
});

test("PDF variants are valid, selectable, deterministic report structures", () => {
  const snapshot = buildInvestorSafeSnapshot(intelligenceReportFixture(), {
    generatedAt: "2026-10-13T12:00:00.000Z",
    env: {},
  });
  const variants = [
    ...["overview", "product", "growth", "tourism", "markets", "revenue", "operations"].flatMap((dashboard) =>
      ["en", "es"].map((language) => ({ reportType: "current_dashboard", dashboard, format: "a4", language })),
    ),
    ...["investor_snapshot", "executive_report", "analyst_report"].flatMap((reportType) =>
      ["a4", "letter"].flatMap((format) => ["en", "es"].map((language) => ({ reportType, dashboard: "overview", format, language, includeDefinitions: reportType === "analyst_report" }))),
    ),
    ...["en", "es"].map((language) => ({ reportType: "investor_presentation", dashboard: "overview", format: "16:9", language })),
  ];
  for (const variant of variants) {
    const rendered = renderIntelligencePdf(snapshot, { ...variant, classification: "investor_safe", fixture: true });
    const raw = rendered.bytes.toString("latin1");
    assert.ok(raw.startsWith("%PDF-1.4"));
    assert.ok(raw.endsWith("%%EOF\n"));
    assert.equal((raw.match(/\/Type \/Page\b/g) || []).length, rendered.pageCount);
    assert.match(raw, /EXPLORE/);
    assert.match(raw, /\/Subtype \/Image/);
    assert.doesNotMatch(raw, /private query|SECRET USER EMAIL/i);
    assert.ok(rendered.bytes.length > 15_000);
    if (variant.reportType === "executive_report") assert.match(raw, /\(18[,\.]420\)/);
    if (variant.format === "16:9") assert.match(raw, /\/MediaBox \[0 0 960 540\]/);
    if (variant.reportType === "investor_snapshot") assert.ok(!rendered.outline.includes("revenue"), "unverified revenue must not dominate the investor snapshot");
    if (variant.reportType === "analyst_report") assert.ok(rendered.outline.includes("analyst_trends"));
  }
  assert.equal(variants.length, 28, "every report product and dashboard family is covered in supported formats and languages");
});

test("report title remains a document title when a recipient is supplied", () => {
  const snapshot = buildInvestorSafeSnapshot(intelligenceReportFixture(), {
    generatedAt: "2026-10-13T12:00:00.000Z",
    env: {},
  });
  const options = validateReportOptions({ reportType: "executive_report", recipient: "Eduardo", organization: "Explore Board" });
  const rendered = renderIntelligencePdf(snapshot, { ...options, fixture: true });
  const raw = rendered.bytes.toString("latin1");
  assert.match(raw, /\/Title \(Explore Executive Business Report\)/);
  assert.match(raw, /\(Prepared for: Eduardo\)/);
  assert.doesNotMatch(raw, /\/Title \(Eduardo\)/);
  assert.equal(rendered.outline[0], "cover");
});

test("partial and unavailable quality states remain explicit in investor PDFs", () => {
  const partialDashboard = intelligenceReportFixture();
  partialDashboard.data_quality.rejected_events_in_range = 100;
  partialDashboard.data_quality.rejection_coverage_pct = 25;
  const partial = buildInvestorSafeSnapshot(partialDashboard, { generatedAt: "2026-10-14T12:00:00.000Z", env: {} });
  assert.equal(partial.metric_confidence.metrics.active_users.status, "under_investigation");
  const partialPdf = renderIntelligencePdf(partial, { reportType: "analyst_report", dashboard: "operations", format: "letter", language: "en", classification: "investor_safe", includeDefinitions: true, fixture: true });
  assert.match(partialPdf.bytes.toString("latin1"), /under_investigation/);

  const unavailableDashboard = intelligenceReportFixture();
  unavailableDashboard.state = "zero";
  unavailableDashboard.data_quality.valid_events = 0;
  const unavailable = buildInvestorSafeSnapshot(unavailableDashboard, { generatedAt: "2026-10-14T12:00:00.000Z", env: {} });
  assert.equal(unavailable.metric_confidence.metrics.active_users.status, "unavailable");
  const unavailablePdf = renderIntelligencePdf(unavailable, { reportType: "executive_report", dashboard: "overview", format: "a4", language: "en", classification: "investor_safe", fixture: true });
  assert.match(unavailablePdf.bytes.toString("latin1"), /Unavailable/);
});

test("report requests are allowlisted and filenames are deterministic", () => {
  const options = validateReportOptions({ reportType: "investor_presentation", format: "16:9", language: "es", title: "  Consejo  " });
  assert.equal(options.title, "Consejo");
  assert.throws(() => validateReportOptions({ reportType: "../../unsafe" }), /Invalid report_type/);
  assert.throws(() => validateReportOptions({ title: "x".repeat(121) }), /too long/);
  assert.throws(() => validateReportOptions([]), /JSON object/);
  assert.throws(() => validateReportOptions({ sections: ["executive", "raw_events"] }), /Invalid report section/);
  assert.throws(() => validateReportOptions({ note: { unsafe: true } }), /must be text/);
  assert.throws(() => validateReportOptions({ reportType: "investor_presentation", format: "a4" }), /require 16:9/);
  const snapshot = buildInvestorSafeSnapshot(intelligenceReportFixture(), { generatedAt: "2026-10-13T12:00:00.000Z", env: {} });
  assert.equal(reportFilename(snapshot, options), "explore-intelligence_investor_presentation_2026-09-13_2026-10-12_es.pdf");
  const analystOptions = validateReportOptions({ reportType: "analyst_report", sections: ["traction", "analyst_tables", "technical"] });
  const analyst = renderIntelligencePdf(snapshot, { ...analystOptions, fixture: true });
  assert.ok(analyst.outline.includes("analyst_trends"));
  assert.ok(analyst.outline.includes("analyst_entities"));
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
