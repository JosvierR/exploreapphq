import { createBusinessServiceClient, exactCount, safeError } from "./business-runtime.mjs";

const DAY_MS = 86_400_000;
const PAGE_SIZE = 1_000;
const MAX_ROWS = 25_000;

function isoAgo(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function increment(map, value) {
  const key = String(value || "unknown").trim().slice(0, 120) || "unknown";
  map.set(key, (map.get(key) || 0) + 1);
}

function topCounts(map, limit = 30) {
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

async function pagedDeadLetters(supabase) {
  const rows = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("analytics_event_dead_letters")
      .select("event_id,reason,source,created_at,payload")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < PAGE_SIZE) return rows;
  }
  throw new Error(`analytics_event_dead_letters exceeded the reviewed ${MAX_ROWS}-row audit bound.`);
}

async function countWindow(supabase, table, timestamp, since = null) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (since) query = query.gte(timestamp, since);
  return exactCount(query);
}

async function main() {
  const supabase = createBusinessServiceClient();
  const windows = [
    ["24h", isoAgo(1)],
    ["7d", isoAgo(7)],
    ["30d", isoAgo(30)],
  ];

  const [acceptedTotal, rejectedTotal, deadLetters, firstResult, latestResult, ...windowCounts] = await Promise.all([
    countWindow(supabase, "analytics_events", "received_at"),
    countWindow(supabase, "analytics_event_dead_letters", "created_at"),
    pagedDeadLetters(supabase),
    supabase.from("analytics_event_dead_letters").select("created_at").order("created_at", { ascending: true }).limit(1).maybeSingle(),
    supabase.from("analytics_event_dead_letters").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ...windows.flatMap(([, since]) => [
      countWindow(supabase, "analytics_events", "received_at", since),
      countWindow(supabase, "analytics_event_dead_letters", "created_at", since),
    ]),
  ]);
  if (firstResult.error) throw firstResult.error;
  if (latestResult.error) throw latestResult.error;

  const reasons = new Map();
  const sources = new Map();
  const eventNames = new Map();
  const entityTypes = new Map();
  const rejectionDays = new Map();
  const eventIds = new Map();
  for (const row of deadLetters) {
    increment(reasons, row.reason);
    increment(sources, row.source);
    increment(rejectionDays, String(row.created_at || "unknown").slice(0, 10));
    if (row.event_id) increment(eventIds, row.event_id);
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    increment(eventNames, payload.event_name || payload.name || payload.event);
    increment(entityTypes, payload.entity_type || payload.type);
  }

  const byWindow = {};
  windows.forEach(([label], index) => {
    const accepted = windowCounts[index * 2];
    const rejected = windowCounts[index * 2 + 1];
    byWindow[label] = {
      accepted,
      rejected,
      rejection_rate_pct: accepted + rejected > 0 ? Math.round((rejected / (accepted + rejected)) * 10_000) / 100 : 0,
    };
  });

  const duplicateDeadLetterIds = [...eventIds.values()].filter((count) => count > 1);
  console.log(JSON.stringify({
    ok: true,
    generated_at: new Date().toISOString(),
    scope: "read_only",
    cumulative: {
      accepted: acceptedTotal,
      rejected: rejectedTotal,
      rejection_rate_pct: acceptedTotal + rejectedTotal > 0
        ? Math.round((rejectedTotal / (acceptedTotal + rejectedTotal)) * 10_000) / 100
        : 0,
      first_rejection_at: firstResult.data?.created_at || null,
      latest_rejection_at: latestResult.data?.created_at || null,
    },
    windows: byWindow,
    taxonomy: {
      reasons: topCounts(reasons),
      sources: topCounts(sources),
      event_names: topCounts(eventNames),
      entity_types: topCounts(entityTypes),
    },
    duplicate_behavior: {
      dead_letter_rows_with_repeated_event_id: duplicateDeadLetterIds.reduce((sum, count) => sum + count, 0),
      repeated_event_ids: duplicateDeadLetterIds.length,
      accepted_event_id_constraint: "analytics_events.event_id is UNIQUE",
    },
    recent_rejections_by_day: topCounts(rejectionDays, 31),
    limitations: {
      authentication_failures: "Bearer-token failures return before event validation and are not represented in the dead-letter table.",
      payloads: "Only event_name and entity_type categories are emitted; raw payload values are not printed.",
      reprocessing: "No records were replayed. Corrected events can rely on the accepted-table event_id uniqueness guard, but replay still needs a reviewed idempotent tool.",
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeError(error) }, null, 2));
  process.exitCode = 1;
});
