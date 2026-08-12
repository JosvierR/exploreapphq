import {
  argValue,
  createBusinessServiceClient,
  daysInclusive,
  exactCount,
  hasFlag,
  nextDay,
  parseDay,
  safeError,
} from "./business-runtime.mjs";

const FACT_TABLES = [
  "fact_place_daily",
  "fact_route_daily",
  "fact_market_daily",
  "fact_search_daily",
  "fact_content_attribution",
  "fact_business_daily",
];

async function factCountForDay(supabase, day) {
  const counts = await Promise.all(
    FACT_TABLES.map((table) => exactCount(supabase.from(table).select("*", { count: "exact", head: true }).eq("day", day))),
  );
  return counts.reduce((sum, value) => sum + value, 0);
}

async function countRange(supabase, table, from, to, column = "received_at") {
  return exactCount(
    supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .gte(column, `${from}T00:00:00.000Z`)
      .lt(column, `${nextDay(to)}T00:00:00.000Z`),
  );
}

async function main() {
  const from = parseDay(argValue("from"), "--from");
  const to = parseDay(argValue("to"), "--to");
  const days = daysInclusive(from, to);
  if (days.length > 3_660 && !hasFlag("allow-long-range")) {
    throw new Error("Backfill exceeds 3,660 days; pass --allow-long-range after reviewing the target.");
  }

  const supabase = createBusinessServiceClient();
  const { data: dimensions, error: dimensionError } = await supabase.rpc("backfill_business_dimensions");
  if (dimensionError) throw dimensionError;

  const [eventsProcessed, validEvents, rejectedEvents] = await Promise.all([
    countRange(supabase, "analytics_events", from, to),
    countRange(supabase, "analytics_normalized_events", from, to),
    countRange(supabase, "analytics_rejected_events", from, to),
  ]);

  const { data: run, error: runError } = await supabase
    .from("business_backfill_runs")
    .insert({
      from_day: from,
      to_day: to,
      status: "running",
      events_processed: eventsProcessed,
      valid_events: validEvents,
      rejected_events: rejectedEvents,
      places_mapped: Number(dimensions?.places_mapped || 0),
      routes_mapped: Number(dimensions?.routes_mapped || 0),
      geo_entities_mapped: Number(dimensions?.geo_entities_mapped || 0),
    })
    .select("id")
    .single();
  if (runError) throw runError;

  let factsGenerated = 0;
  try {
    for (let index = 0; index < days.length; index += 1) {
      const day = days[index];
      const base = await supabase.rpc("aggregate_analytics_events_for_day", { target_day: day });
      if (base.error) throw base.error;
      const business = await supabase.rpc("run_business_intelligence_aggregation", {
        target_day: day,
        run_trigger: "backfill",
        run_request_id: run.id,
      });
      if (business.error) throw business.error;
      if (!business.data?.ok) {
        throw new Error(`Business aggregation failed for ${day} (${business.data?.code || "unknown"}).`);
      }
      factsGenerated += await factCountForDay(supabase, day);

      const progress = {
        run_id: run.id,
        day,
        dates_processed: index + 1,
        dates_total: days.length,
        progress_pct: Math.round(((index + 1) / days.length) * 1000) / 10,
        facts_generated: factsGenerated,
      };
      console.log(JSON.stringify(progress));
      const { error: progressError } = await supabase
        .from("business_backfill_runs")
        .update({ current_day: day, dates_processed: index + 1, facts_generated: factsGenerated })
        .eq("id", run.id);
      if (progressError) throw progressError;
    }

    const { error: completeError } = await supabase
      .from("business_backfill_runs")
      .update({ status: "succeeded", finished_at: new Date().toISOString(), facts_generated: factsGenerated })
      .eq("id", run.id);
    if (completeError) throw completeError;

    console.log(
      JSON.stringify(
        {
          ok: true,
          run_id: run.id,
          from,
          to,
          events_processed: eventsProcessed,
          valid_events: validEvents,
          rejected_events: rejectedEvents,
          ...dimensions,
          facts_generated: factsGenerated,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const safe = safeError(error);
    await supabase
      .from("business_backfill_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error_code: safe.code, error_message: safe.message })
      .eq("id", run.id);
    throw error;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeError(error) }, null, 2));
  process.exitCode = 1;
});
