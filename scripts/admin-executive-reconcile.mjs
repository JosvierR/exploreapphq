import { calculateCanonicalKpis, periodDelta } from "../server/api-lib/analytics/businessAnalyticsCore.mjs";
import { createBusinessServiceClient, safeError } from "./business-runtime.mjs";

const DAY_MS = 86_400_000;
const PAGE_SIZE = 1_000;
const MAX_ROWS = 100_000;
const KPI_KEYS = ["active_users", "sessions", "route_starts", "commercial_actions"];

async function readWindow(supabase, since, until) {
  const rows = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("analytics_normalized_events")
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

function selectKpis(rows) {
  const all = calculateCanonicalKpis(rows);
  return Object.fromEntries(KPI_KEYS.map((key) => [key, all[key]]));
}

async function main() {
  const supabase = createBusinessServiceClient();
  const until = new Date();
  const since = new Date(until.getTime() - 7 * DAY_MS);
  const previousSince = new Date(since.getTime() - 7 * DAY_MS);
  const [currentRows, previousRows] = await Promise.all([
    readWindow(supabase, since.toISOString(), until.toISOString()),
    readWindow(supabase, previousSince.toISOString(), since.toISOString()),
  ]);
  const current = selectKpis(currentRows);
  const previous = selectKpis(previousRows);
  const deltas = Object.fromEntries(KPI_KEYS.map((key) => [key, periodDelta(current[key], previous[key])]));

  console.log(JSON.stringify({
    ok: true,
    scope: "read_only",
    source: "analytics_normalized_events",
    formula_module: "server/api-lib/analytics/businessAnalyticsCore.mjs",
    generated_at: until.toISOString(),
    current_window: { since: since.toISOString(), until: until.toISOString(), rows: currentRows.length },
    previous_window: { since: previousSince.toISOString(), until: since.toISOString(), rows: previousRows.length },
    kpis: current,
    previous_kpis: previous,
    deltas,
    data_as_of: currentRows[0]?.received_at || null,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeError(error) }, null, 2));
  process.exitCode = 1;
});
