import { calculateCanonicalKpis, periodDelta } from "../server/api-lib/analytics/businessAnalyticsCore.mjs";
import { createBusinessServiceClient, exactCount, safeError } from "./business-runtime.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DAY_MS = 86_400_000;
const PAGE_SIZE = 1_000;
const MAX_ROWS = 100_000;
const KPI_KEYS = [
  "active_users",
  "sessions",
  "place_discoveries",
  "place_views",
  "unique_place_visitors",
  "route_views",
  "route_starts",
  "route_completions",
  "route_completion_rate",
  "saves",
  "shares",
  "commercial_actions",
  "intent_rate",
  "searches",
  "place_impressions",
  "place_saves",
  "total_events",
];

async function readWindow(supabase, table, since, until) {
  const rows = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("event_name,entity_type,user_id,anonymous_id,session_id,received_at")
      .gte("received_at", since)
      .lt("received_at", until)
      .order("received_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  throw new Error(`Normalized events exceeded the reviewed ${MAX_ROWS.toLocaleString()}-row reconciliation bound.`);
}

async function countRejectedWindow(supabase, since, until) {
  return exactCount(
    supabase
      .from("analytics_event_dead_letters")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since)
      .lt("created_at", until),
  );
}

function selectKpis(rows) {
  const all = calculateCanonicalKpis(rows);
  return Object.fromEntries(KPI_KEYS.map((key) => [key, all[key]]));
}

async function main() {
  const supabase = createBusinessServiceClient();
  const until = new Date();
  const since = new Date(until.getTime() - 7 * DAY_MS);
  const previousSince = new Date(since.getTime() - 7 * DAY_MS);
  const [currentRows, previousRows, currentRawRows, previousRawRows, currentRejected, previousRejected] = await Promise.all([
    readWindow(supabase, "analytics_normalized_events", since.toISOString(), until.toISOString()),
    readWindow(supabase, "analytics_normalized_events", previousSince.toISOString(), since.toISOString()),
    readWindow(supabase, "analytics_events", since.toISOString(), until.toISOString()),
    readWindow(supabase, "analytics_events", previousSince.toISOString(), since.toISOString()),
    countRejectedWindow(supabase, since.toISOString(), until.toISOString()),
    countRejectedWindow(supabase, previousSince.toISOString(), since.toISOString()),
  ]);
  const current = selectKpis(currentRows);
  const previous = selectKpis(previousRows);
  const currentRaw = selectKpis(currentRawRows);
  const previousRaw = selectKpis(previousRawRows);
  const deltas = Object.fromEntries(KPI_KEYS.map((key) => [key, periodDelta(current[key], previous[key])]));
  const sourceMismatches = KPI_KEYS.filter((key) => current[key] !== currentRaw[key]).map((key) => ({
    metric: key,
    normalized: current[key],
    raw: currentRaw[key],
    difference: current[key] - currentRaw[key],
  }));
  const invariantKeys = ["active_users", "sessions", "route_starts", "route_completions", "saves", "shares", "commercial_actions", "searches", "total_events"];
  const invariantMismatches = sourceMismatches.filter((item) => invariantKeys.includes(item.metric));
  const observedAttempts = currentRawRows.length + currentRejected;
  const rejectionRate = observedAttempts ? Math.round((currentRejected / observedAttempts) * 10_000) / 100 : 0;
  const qualityStatus = rejectionRate >= 20 ? "under_investigation" : rejectionRate >= 5 ? "partial" : "verified";

  const report = {
    ok: true,
    scope: "read_only",
    source: "analytics_normalized_events",
    formula_module: "server/api-lib/analytics/businessAnalyticsCore.mjs",
    formula_version: "business-analytics-core-v1",
    timezone: "UTC",
    data_quality: {
      status: qualityStatus,
      accepted_raw: currentRawRows.length,
      accepted_normalized: currentRows.length,
      rejected: currentRejected,
      observed_attempts: observedAttempts,
      rejection_rate_pct: rejectionRate,
      note: "Observed attempts are accepted raw rows plus dead-letter rows; retries can make this an operational coverage proxy rather than a unique client-attempt rate.",
    },
    generated_at: until.toISOString(),
    current_window: { since: since.toISOString(), until: until.toISOString(), rows: currentRows.length },
    previous_window: { since: previousSince.toISOString(), until: since.toISOString(), rows: previousRows.length },
    kpis: current,
    raw_event_kpis: currentRaw,
    previous_kpis: previous,
    previous_raw_event_kpis: previousRaw,
    previous_rejected: previousRejected,
    deltas,
    reconciliation: {
      canonical_invariants_match_raw: invariantMismatches.length === 0,
      invariant_metrics: invariantKeys,
      invariant_mismatches: invariantMismatches,
      normalization_differences: sourceMismatches.filter((item) => !invariantKeys.includes(item.metric)),
      normalization_note: "Place/route view metrics intentionally use normalized entity resolution; raw rows are not the reporting source for those dimensions.",
      metric_count: KPI_KEYS.length,
    },
    data_as_of: currentRows[0]?.received_at || null,
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  const outputPath = String(process.env.EXECUTIVE_RECONCILIATION_OUTPUT || "").trim();
  if (outputPath) {
    const target = resolve(outputPath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, serialized, "utf8");
  }
  console.log(serialized.trimEnd());
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeError(error) }, null, 2));
  process.exitCode = 1;
});
