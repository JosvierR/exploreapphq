import { createHash } from "node:crypto";
import { createBusinessServiceClient, safeError } from "./business-runtime.mjs";

const TABLES = {
  fact_place_daily: [
    "day",
    "place_id",
    "geo_id",
    "impressions",
    "views",
    "unique_visitors",
    "saves",
    "shares",
    "directions",
    "calls",
    "website_clicks",
    "map_opens",
  ],
  fact_route_daily: [
    "day",
    "route_id",
    "geo_id",
    "impressions",
    "views",
    "unique_visitors",
    "saves",
    "starts",
    "stop_views",
    "completes",
  ],
  fact_market_daily: [
    "day",
    "geo_id",
    "active_travelers",
    "sessions",
    "searches",
    "place_views",
    "route_views",
    "saves",
    "commercial_actions",
    "supply_count",
  ],
  fact_search_daily: [
    "day",
    "geo_id",
    "query_hash",
    "searches",
    "result_clicks",
    "no_results",
    "results_available",
    "place_conversions",
    "intent_conversions",
  ],
  fact_content_attribution: [
    "day",
    "content_id",
    "target_type",
    "target_id",
    "attribution_model",
    "views",
    "saves",
    "commercial_actions",
  ],
  fact_business_daily: [
    "day",
    "business_id",
    "location_id",
    "discovery",
    "engagement",
    "commercial_actions",
  ],
};

const NUMERIC_COLUMNS = new Set([
  "impressions",
  "views",
  "unique_visitors",
  "saves",
  "shares",
  "directions",
  "calls",
  "website_clicks",
  "map_opens",
  "starts",
  "stop_views",
  "completes",
  "active_travelers",
  "sessions",
  "searches",
  "place_views",
  "route_views",
  "commercial_actions",
  "supply_count",
  "result_clicks",
  "no_results",
  "results_available",
  "place_conversions",
  "intent_conversions",
  "discovery",
  "engagement",
]);

function canonicalRows(rows, columns) {
  return rows
    .map((row) => columns.map((column) => row[column] ?? null))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

async function main() {
  const supabase = createBusinessServiceClient();
  const result = {};

  for (const [table, columns] of Object.entries(TABLES)) {
    const { data, error } = await supabase.from(table).select(columns.join(","));
    if (error) throw error;

    const rows = canonicalRows(data || [], columns);
    const totals = {};
    for (const column of columns.filter((candidate) => NUMERIC_COLUMNS.has(candidate))) {
      totals[column] = rows.reduce((sum, row) => sum + Number(row[columns.indexOf(column)] || 0), 0);
    }

    result[table] = {
      rows: rows.length,
      totals,
      sha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
    };
  }

  console.log(JSON.stringify({ ok: true, facts: result }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeError(error) }, null, 2));
  process.exitCode = 1;
});
