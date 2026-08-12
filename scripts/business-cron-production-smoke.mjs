import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { argValue, createBusinessServiceClient, safeError } from "./business-runtime.mjs";

const PRODUCTION_URL = String(process.env.BUSINESS_PRODUCTION_URL || "https://www.exploreapphq.com").replace(/\/$/, "");
const executable = process.platform === "win32" ? "npx.cmd" : "npx";

function runVercel(args, options = {}) {
  const result = spawnSync(executable, ["vercel", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 5_000_000,
    timeout: 15 * 60 * 1_000,
    ...options,
  });
  if (result.status !== 0) {
    const error = new Error(`Vercel command failed: vercel ${args[0]}.`);
    error.code = `vercel_${args[0]}_failed`;
    throw error;
  }
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

async function factFingerprint(supabase) {
  const tables = {
    fact_place_daily: ["day", "place_id", "geo_id", "impressions", "views", "unique_visitors", "saves", "shares", "directions", "calls", "website_clicks", "map_opens"],
    fact_route_daily: ["day", "route_id", "geo_id", "impressions", "views", "unique_visitors", "saves", "starts", "stop_views", "completes"],
    fact_market_daily: ["day", "geo_id", "active_travelers", "sessions", "searches", "place_views", "route_views", "saves", "commercial_actions", "supply_count"],
    fact_search_daily: ["day", "geo_id", "query_hash", "searches", "result_clicks", "no_results", "results_available", "place_conversions", "intent_conversions"],
    fact_business_daily: ["day", "business_id", "location_id", "discovery", "engagement", "commercial_actions"],
    fact_content_attribution: ["day", "content_id", "target_type", "target_id", "attribution_model", "views", "saves", "commercial_actions"],
  };
  const result = {};
  for (const [table, columns] of Object.entries(tables)) {
    const { data, error } = await supabase.from(table).select(columns.join(","));
    if (error) throw error;
    result[table] = JSON.stringify(
      (data || [])
        .map((row) => columns.map((column) => row[column] ?? null))
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    );
  }
  return result;
}

async function invokeCron(secret = null) {
  const started = performance.now();
  const response = await fetch(`${PRODUCTION_URL}/api/cron/analytics/aggregate`, {
    method: "GET",
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, duration_ms: Math.round(performance.now() - started), body };
}

function sameFingerprint(left, right) {
  return Object.keys(left).every((table) => left[table] === right[table]);
}

async function main() {
  const deployment = String(argValue("deployment") || "").trim();
  if (!deployment) throw new Error("--deployment=<final-production-url-or-id> is required.");
  const secret = randomBytes(48).toString("base64url");

  console.log(JSON.stringify({ event: "cron_secret_configuration_started" }));
  runVercel(["env", "add", "CRON_SECRET", "production", "--force", "--sensitive", "--yes"], {
    input: `${secret}\n`,
  });
  console.log(JSON.stringify({ event: "cron_secret_configured", sensitive: true }));

  const redeployOutput = runVercel(["redeploy", deployment, "--target", "production"]);
  const deploymentUrl = [...redeployOutput.matchAll(/https:\/\/[A-Za-z0-9.-]+\.vercel\.app/g)].at(-1)?.[0] || null;
  console.log(JSON.stringify({ event: "production_redeployed", deployment_url: deploymentUrl }));

  const unauthorized = await invokeCron();
  if (unauthorized.status !== 401) throw new Error(`Unauthenticated cron returned HTTP ${unauthorized.status}, expected 401.`);

  const supabase = createBusinessServiceClient();
  const before = await factFingerprint(supabase);
  const first = await invokeCron(secret);
  if (first.status !== 200 || first.body?.ok !== true) throw new Error(`Authorized cron returned HTTP ${first.status}.`);
  const afterFirst = await factFingerprint(supabase);
  const second = await invokeCron(secret);
  if (second.status !== 200 || second.body?.ok !== true) throw new Error(`Second authorized cron returned HTTP ${second.status}.`);
  const afterSecond = await factFingerprint(supabase);

  const quality = await supabase.rpc("business_destination_geography_quality_report");
  if (quality.error) throw quality.error;
  const expectedDays = (first.body.days || []).map((row) => (typeof row === "string" ? row : row?.day)).filter(Boolean);
  if (expectedDays.length !== 4) throw new Error(`Cron recomputed ${expectedDays.length} days instead of four.`);
  if ((first.body.days || []).some((row) => typeof row === "object" && (row.ok !== true || row.business_ok !== true))) {
    throw new Error("At least one base or Business aggregation day failed during the first authorized cron run.");
  }
  if ((second.body.days || []).some((row) => typeof row === "object" && (row.ok !== true || row.business_ok !== true))) {
    throw new Error("At least one base or Business aggregation day failed during the second authorized cron run.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        schedule: "15 5 * * *",
        timezone: "UTC",
        method: "GET",
        unauthorized_status: unauthorized.status,
        first_authorized_status: first.status,
        first_duration_ms: first.duration_ms,
        second_authorized_status: second.status,
        second_duration_ms: second.duration_ms,
        days: expectedDays,
        first_run_changed_current_window: !sameFingerprint(before, afterFirst),
        idempotent_second_run: sameFingerprint(afterFirst, afterSecond),
        last_attempted_aggregation: quality.data?.last_attempted_aggregation || null,
        last_successful_aggregation: quality.data?.last_successful_aggregation || null,
        deployment_url: deploymentUrl,
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
