import { createBusinessServiceClient, exactCount, safeError } from "./business-runtime.mjs";

const FACT_TABLES = [
  "fact_place_daily",
  "fact_route_daily",
  "fact_market_daily",
  "fact_search_daily",
  "fact_business_daily",
  "fact_content_attribution",
];

function increment(map, value) {
  const key = String(value || "unknown").trim().slice(0, 120) || "unknown";
  map.set(key, (map.get(key) || 0) + 1);
}

function topCounts(map, limit = 20) {
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

async function pagedRows(supabase, table, columns, pageSize = 1_000, maxRows = 25_000) {
  const rows = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < pageSize) return rows;
  }
  throw new Error(`${table} exceeded the reviewed ${maxRows}-row audit bound.`);
}

async function main() {
  const supabase = createBusinessServiceClient();
  const [quality, geography, sourceEvents, acceptedEvents, rejectedEvents] = await Promise.all([
    supabase.rpc("business_intelligence_quality_report"),
    supabase.rpc("business_destination_geography_quality_report"),
    exactCount(supabase.from("analytics_events").select("*", { count: "exact", head: true })),
    exactCount(supabase.from("analytics_normalized_events").select("*", { count: "exact", head: true })),
    exactCount(supabase.from("analytics_rejected_events").select("*", { count: "exact", head: true })),
  ]);
  if (quality.error) throw quality.error;
  if (geography.error) throw geography.error;

  const [facts, rejectedRows, deadLetterRows, accounts, pilotAccount] = await Promise.all([
    Promise.all(
      FACT_TABLES.map(async (table) => [
        table,
        await exactCount(supabase.from(table).select("*", { count: "exact", head: true })),
      ]),
    ),
    pagedRows(supabase, "analytics_rejected_events", "reason,source"),
    pagedRows(supabase, "analytics_event_dead_letters", "reason,source,payload"),
    supabase.from("business_accounts").select("type,status,plan,bi_v2_enabled").limit(1_000),
    supabase
      .from("business_accounts")
      .select("id,status,plan,bi_v2_enabled")
      .eq("name", "Explore Internal Business")
      .limit(1)
      .maybeSingle(),
  ]);
  if (accounts.error) throw accounts.error;
  if (pilotAccount.error) throw pilotAccount.error;

  const rejectReasons = new Map();
  const rejectSources = new Map();
  for (const row of rejectedRows) {
    increment(rejectReasons, row.reason);
    increment(rejectSources, row.source);
  }
  const rejectedEventNames = new Map();
  const rejectedEntityTypes = new Map();
  for (const row of deadLetterRows) {
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    increment(rejectedEventNames, payload.event_name || payload.name || payload.event);
    increment(rejectedEntityTypes, payload.entity_type || payload.type);
  }

  const hierarchyChecks = {};
  for (const check of [
    ["dominican_republic_santiago_city", { country_code: "DO", admin_level_1: "Santiago", locality: "Santiago de los Caballeros" }],
    ["united_states_florida_miami", { country_code: "US", admin_level_1: "Florida", locality: "Miami" }],
  ]) {
    let query = supabase.from("business_destination_geo_hierarchy").select("leaf_geo_id", { count: "exact", head: true });
    for (const [column, value] of Object.entries(check[1])) query = query.eq(column, value);
    hierarchyChecks[check[0]] = (await exactCount(query)) > 0;
  }

  const pilotId = pilotAccount.data?.id;
  let pilot = { configured: false };
  if (pilotId) {
    const [members, locations, claims, entitlements, markets, businessFacts] = await Promise.all([
      exactCount(supabase.from("business_members").select("*", { count: "exact", head: true }).eq("business_id", pilotId)),
      exactCount(supabase.from("business_locations").select("*", { count: "exact", head: true }).eq("business_id", pilotId).eq("status", "active")),
      exactCount(supabase.from("business_claims").select("*", { count: "exact", head: true }).eq("business_id", pilotId).eq("status", "approved")),
      exactCount(supabase.from("business_entitlements").select("*", { count: "exact", head: true }).eq("business_id", pilotId).eq("enabled", true)),
      exactCount(supabase.from("business_market_access").select("*", { count: "exact", head: true }).eq("business_id", pilotId)),
      exactCount(supabase.from("fact_business_daily").select("*", { count: "exact", head: true }).eq("business_id", pilotId)),
    ]);
    pilot = {
      configured: members > 0 && locations > 0 && claims > 0,
      status: pilotAccount.data.status,
      plan: pilotAccount.data.plan,
      bi_v2_enabled: pilotAccount.data.bi_v2_enabled,
      members,
      active_locations: locations,
      approved_claims: claims,
      active_entitlements: entitlements,
      market_grants: markets,
      historical_business_facts: businessFacts,
    };
  }

  const accountRows = accounts.data || [];
  console.log(
    JSON.stringify(
      {
        ok: true,
        events: { source: sourceEvents, accepted_normalized: acceptedEvents, rejected: rejectedEvents },
        reject_taxonomy: {
          reasons: topCounts(rejectReasons),
          sources: topCounts(rejectSources),
          dead_letter_event_names: topCounts(rejectedEventNames),
          dead_letter_entity_types: topCounts(rejectedEntityTypes),
        },
        facts: Object.fromEntries(facts),
        quality: quality.data,
        geography: geography.data,
        hierarchy_checks: hierarchyChecks,
        accounts: {
          total: accountRows.length,
          enabled: accountRows.filter((row) => row.bi_v2_enabled).length,
          external_enabled: accountRows.filter((row) => row.type !== "internal" && row.bi_v2_enabled).length,
        },
        pilot,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeError(error) }, null, 2));
  process.exitCode = 1;
});
