import { createClient } from "@supabase/supabase-js";
import { createBusinessServiceClient, safeError } from "./business-runtime.mjs";

const BASE_URL = String(process.env.BUSINESS_PRODUCTION_URL || "https://www.exploreapphq.com").replace(/\/$/, "");
const RANGE_QUERY = "from=2026-07-04&to=2026-08-12";

function publicAuthClient() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const key = String(
    process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      "",
  ).trim();
  if (!url || !key) throw new Error("Supabase public Auth configuration is missing.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function credentials(prefix) {
  return {
    email: String(process.env[`BI_${prefix}_EMAIL`] || "").trim(),
    password: String(process.env[`BI_${prefix}_PASSWORD`] || ""),
  };
}

async function login(prefix, label) {
  const value = credentials(prefix);
  if (!value.email || !value.password) throw new Error(`${label} credentials are not configured.`);
  const { data, error } = await publicAuthClient().auth.signInWithPassword(value);
  if (error || !data?.session?.access_token) {
    const authError = new Error(`${label} failed normal Supabase authentication.`);
    authError.code = String(error?.code || "authentication_failed");
    authError.status = error?.status;
    throw authError;
  }
  return { token: data.session.access_token, user_id: data.user.id };
}

async function request(path, token = null, init = {}) {
  const started = performance.now();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
    redirect: "follow",
  });
  const bytes = Number(response.headers.get("content-length") || 0);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  return {
    status: response.status,
    duration_ms: Math.round((performance.now() - started) * 10) / 10,
    bytes: bytes || Buffer.byteLength(text),
    body,
  };
}

function assertStatus(result, expected, label) {
  const accepted = Array.isArray(expected) ? expected : [expected];
  if (!accepted.includes(result.status)) {
    const error = new Error(`${label} returned HTTP ${result.status}; expected ${accepted.join("/")}.`);
    error.code = result.body?.code || "unexpected_http_status";
    error.status = result.status;
    throw error;
  }
}

async function measure(label, path, token) {
  const cold = await request(path, token);
  assertStatus(cold, 200, `${label} cold request`);
  const warm = await request(path, token);
  assertStatus(warm, 200, `${label} warm request`);
  return {
    label,
    status: warm.status,
    cold_ms: cold.duration_ms,
    warm_ms: warm.duration_ms,
    payload_bytes: warm.bytes,
    cold_cache_hit: cold.body?.diagnostics?.cache_hit ?? null,
    warm_cache_hit: warm.body?.diagnostics?.cache_hit ?? null,
  };
}

async function accountContext(supabase, name) {
  const account = await supabase
    .from("business_accounts")
    .select("id,name,status,plan,bi_v2_enabled")
    .eq("name", name)
    .limit(1)
    .maybeSingle();
  if (account.error) throw account.error;
  if (!account.data) return null;
  const location = await supabase
    .from("business_locations")
    .select("id,place_id,geo_id,status")
    .eq("business_id", account.data.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (location.error) throw location.error;
  return { account: account.data, location: location.data || null };
}

function withQuery(path, params) {
  return `${path}?${new URLSearchParams(params).toString()}`;
}

function panelState(result) {
  if (result.status !== 200) return "FAIL";
  const body = result.body || {};
  const warningText = JSON.stringify(body.warnings || []).toLowerCase();
  if (body.state === "insufficient_data" || body.state === "low_sample" || /insufficient|low_sample|unavailable/.test(warningText)) {
    return "NOT ENOUGH DATA";
  }
  return "PASS";
}

function businessScoreState(result) {
  if (result.status !== 200) return "FAIL";
  const score = result.body?.business_performance;
  if (!score || score.status === "insufficient_data" || score.score == null) return "NOT ENOUGH DATA";
  return Number.isFinite(Number(score.score)) ? "PASS" : "FAIL";
}

async function main() {
  const supabase = createBusinessServiceClient();
  const [admin, pilot, control] = await Promise.all([
    login("ADMIN", "Admin"),
    login("PILOT", "Pilot Business user"),
    login("CONTROL", "Isolation-control Business user"),
  ]);
  const [pilotContext, controlContext] = await Promise.all([
    accountContext(supabase, "Explore Internal Business"),
    accountContext(supabase, "Explore BI Isolation Control"),
  ]);
  if (!pilotContext?.location) throw new Error("The pilot Business account does not have an active location.");
  if (!controlContext) throw new Error("The isolation-control Business account is not configured.");
  if (pilot.user_id === admin.user_id) throw new Error("Pilot authentication resolved to the Admin identity.");
  if ([admin.user_id, pilot.user_id].includes(control.user_id)) {
    throw new Error("Isolation-control authentication is not a distinct identity.");
  }

  const pilotParams = {
    business_id: pilotContext.account.id,
    location_id: pilotContext.location.id,
    ...Object.fromEntries(new URLSearchParams(RANGE_QUERY)),
  };
  const marketParams = { ...pilotParams, geo_id: pilotContext.location.geo_id };

  const authChecks = {};
  authChecks.unauthenticated_admin = (await request(`/api/admin/business/overview?${RANGE_QUERY}`)).status;
  authChecks.unauthenticated_business = (await request(withQuery("/api/business/v1/overview", pilotParams))).status;
  authChecks.pilot_cannot_be_admin = (await request(`/api/admin/business/overview?${RANGE_QUERY}`, pilot.token)).status;
  assertStatus({ status: authChecks.unauthenticated_admin, body: {} }, 401, "Unauthenticated Admin denial");
  assertStatus({ status: authChecks.unauthenticated_business, body: {} }, 401, "Unauthenticated Business denial");
  assertStatus({ status: authChecks.pilot_cannot_be_admin, body: {} }, 403, "Pilot Admin denial");

  const adminIdentity = await request("/api/admin/me", admin.token);
  assertStatus(adminIdentity, 200, "Admin identity");
  const adminPage = await fetch(`${BASE_URL}/admin/analytics/business`, { redirect: "follow" });
  if (!adminPage.ok) throw new Error(`Admin navigation returned HTTP ${adminPage.status}.`);

  const panelEndpoints = {
    "Executive Summary": "/api/admin/business/executive-summary",
    "Market Pulse": "/api/admin/business/dashboard",
    KPIs: "/api/admin/business/overview",
    "Demand Index": "/api/admin/business/demand",
    Map: "/api/admin/business/geography",
    "Geographic drill-down": "/api/admin/business/markets",
    Trend: "/api/admin/business/timeseries",
    "Intent Funnel": "/api/admin/business/funnel",
    Categories: "/api/admin/business/categories",
    "Search Intelligence": "/api/admin/business/searches",
    Places: "/api/admin/business/places",
    Routes: "/api/admin/business/routes",
    Audience: "/api/admin/business/audience",
    "Time Intelligence": "/api/admin/business/time",
    Attribution: "/api/admin/business/content-attribution",
    Opportunities: "/api/admin/business/opportunities",
    Benchmarks: "/api/admin/business/benchmarks",
    Insights: "/api/admin/business/insights",
    "Analytics Health": "/api/admin/business/health",
  };
  const panels = {};
  for (const [label, path] of Object.entries(panelEndpoints)) {
    const result = await request(`${path}?${RANGE_QUERY}`, admin.token);
    panels[label] = panelState(result);
  }

  const performance = [];
  for (const [label, path] of [
    ["Overview", "/api/admin/business/overview"],
    ["Trend", "/api/admin/business/timeseries"],
    ["Places", "/api/admin/business/places"],
    ["Routes", "/api/admin/business/routes"],
    ["Search", "/api/admin/business/searches"],
    ["Opportunities", "/api/admin/business/opportunities"],
    ["Benchmarks", "/api/admin/business/benchmarks"],
  ]) {
    performance.push(await measure(label, `${path}?${RANGE_QUERY}`, admin.token));
  }

  const pilotOverviewPath = withQuery("/api/business/v1/overview", pilotParams);
  const pilotOverview = await request(pilotOverviewPath, pilot.token);
  assertStatus(pilotOverview, 200, "Pilot own analytics");
  if (pilotOverview.body?.query?.business_id !== pilotContext.account.id) {
    throw new Error("Pilot analytics response has the wrong Business scope.");
  }
  if (pilotOverview.body?.query?.location_id !== pilotContext.location.id) {
    throw new Error("Pilot analytics response has the wrong location scope.");
  }
  const pilotMarket = await request(withQuery("/api/business/v1/demand", marketParams), pilot.token);
  assertStatus(pilotMarket, 200, "Pilot market analytics");
  const place360Path = withQuery(`/api/business/v1/places/${encodeURIComponent(pilotContext.location.place_id)}`, pilotParams);
  performance.push(await measure("Place 360", place360Path, pilot.token));

  const routeCandidate = await supabase
    .from("dim_routes")
    .select("route_id")
    .eq("geo_id", pilotContext.location.geo_id)
    .eq("is_analytics_eligible", true)
    .limit(1)
    .maybeSingle();
  if (routeCandidate.error) throw routeCandidate.error;
  if (routeCandidate.data?.route_id) {
    performance.push(
      await measure(
        "Route 360",
        withQuery(`/api/business/v1/routes/${encodeURIComponent(routeCandidate.data.route_id)}`, marketParams),
        pilot.token,
      ),
    );
  } else {
    performance.push({ label: "Route 360", status: "NOT ENOUGH DATA", cold_ms: null, warm_ms: null, payload_bytes: 0 });
  }

  const isolation = { two_accounts: true };
  if (control && controlContext) {
    const controlParams = {
      business_id: controlContext.account.id,
      ...Object.fromEntries(new URLSearchParams(RANGE_QUERY)),
    };
    const pilotAsControl = await request(withQuery("/api/business/v1/overview", controlParams), pilot.token);
    const controlAsPilot = await request(pilotOverviewPath, control.token);
    const controlLocationIdor = await request(
      withQuery("/api/business/v1/overview", { ...controlParams, location_id: pilotContext.location.id }),
      control.token,
    );
    const controlPlaceIdor = await request(
      withQuery(`/api/business/v1/places/${encodeURIComponent(pilotContext.location.place_id)}`, controlParams),
      control.token,
    );
    for (const [label, result] of [
      ["Pilot cannot select control account", pilotAsControl],
      ["Control cannot select pilot account", controlAsPilot],
      ["Control cannot select pilot location", controlLocationIdor],
      ["Control cannot select pilot Place", controlPlaceIdor],
    ]) {
      assertStatus(result, [403, 404], label);
    }
    isolation.business_id = "PASS";
    isolation.location_id = "PASS";
    isolation.place_id = "PASS";

    const alternateGeo = await supabase
      .from("dim_geo")
      .select("geo_id")
      .neq("geo_id", pilotContext.location.geo_id)
      .limit(1)
      .maybeSingle();
    if (alternateGeo.error) throw alternateGeo.error;
    const marketIdor = await request(
      withQuery("/api/business/v1/demand", { ...pilotParams, geo_id: alternateGeo.data?.geo_id || "unauthorized" }),
      pilot.token,
    );
    assertStatus(marketIdor, 403, "Pilot cannot alter market entitlement");
    isolation.market_geo_id = "PASS";

    const controlOwn = await request(withQuery("/api/business/v1/overview", controlParams), control.token);
    assertStatus(controlOwn, 200, "Control own analytics");
    if (controlOwn.body?.query?.business_id !== controlContext.account.id) throw new Error("Control cache response has the wrong Business scope.");
    const pilotAgain = await request(pilotOverviewPath, pilot.token);
    if (pilotAgain.body?.query?.business_id !== pilotContext.account.id) throw new Error("Pilot cache response has the wrong Business scope.");
    isolation.cache = "PASS";

    const controlBenchmark = await request(withQuery("/api/business/v1/benchmarks", controlParams), control.token);
    assertStatus(controlBenchmark, 403, "Basic control account benchmark entitlement");
    isolation.entitlement_negative = "PASS";
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        production: BASE_URL,
        admin: { login: "PASS", identity: "PASS", navigation: "PASS", panels },
        business: {
          pilot_login: "PASS",
          own_analytics: "PASS",
          market_analytics: "PASS",
          business_score: businessScoreState(pilotOverview),
        },
        authorization: {
          unauthenticated_admin: `${authChecks.unauthenticated_admin} PASS`,
          unauthenticated_business: `${authChecks.unauthenticated_business} PASS`,
          pilot_admin_denial: `${authChecks.pilot_cannot_be_admin} PASS`,
          isolation,
        },
        performance,
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
