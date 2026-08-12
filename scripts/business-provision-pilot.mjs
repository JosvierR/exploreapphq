import { createClient } from "@supabase/supabase-js";
import { createBusinessServiceClient, hasFlag, safeError } from "./business-runtime.mjs";

const PILOT_ACCOUNT = "Explore Internal Business";
const CONTROL_ACCOUNT = "Explore BI Isolation Control";
let currentStep = "startup";

function supabaseUrl() {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
}

function publicKey() {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  ).trim();
}

function createPublicAuthClient() {
  const url = supabaseUrl();
  const key = publicKey();
  if (!url || !key) throw new Error("Supabase public Auth configuration is missing.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function controlledCredentials(prefix) {
  const email = String(process.env[`BI_${prefix}_EMAIL`] || "").trim().toLowerCase();
  const password = String(process.env[`BI_${prefix}_PASSWORD`] || "");
  return { configured: Boolean(email && password), email, password };
}

async function findAuthorizedAdmin(supabase, userId = null) {
  let query = supabase
    .from("admin_users")
    .select("user_id, role")
    .in("role", ["admin", "moderator"])
    .limit(1);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data?.user_id) {
    throw new Error(userId ? "The controlled Admin identity is not active in admin_users." : "No existing identity is active in admin_users.");
  }
  return { id: data.user_id, role: data.role };
}

async function signInControlledUser(authClient, credentials, label) {
  if (!credentials.configured) throw new Error(`${label} credentials are not configured in the protected local environment.`);
  const { data, error } = await authClient.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });
  if (error || !data?.user || !data?.session) {
    const authError = new Error(`${label} could not sign in through normal Supabase Auth.`);
    authError.code = String(error?.code || "controlled_login_failed");
    authError.status = error?.status;
    throw authError;
  }
  return { ...data.user, session: data.session };
}

async function findAccount(supabase, name) {
  const { data, error } = await supabase
    .from("business_accounts")
    .select("id, name, type, status, plan, bi_v2_enabled")
    .eq("name", name)
    .limit(2);
  if (error) throw error;
  if ((data || []).length > 1) throw new Error(`Multiple Business accounts have the name ${name}.`);
  return data?.[0] || null;
}

async function ensureAccount(supabase, name, plan, apply) {
  const existing = await findAccount(supabase, name);
  if (!apply) {
    return existing || { id: null, name, type: "internal", status: "active", plan, bi_v2_enabled: true };
  }
  if (existing) {
    const { data, error } = await supabase
      .from("business_accounts")
      .update({ type: "internal", status: "active", plan, bi_v2_enabled: true, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("id, name, type, status, plan, bi_v2_enabled")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("business_accounts")
    .insert({ name, type: "internal", status: "active", plan, bi_v2_enabled: true })
    .select("id, name, type, status, plan, bi_v2_enabled")
    .single();
  if (error) throw error;
  return data;
}

async function selectPilotPlace(supabase, pilotAccount) {
  if (pilotAccount?.id) {
    const existing = await supabase
      .from("business_locations")
      .select("id, place_id, geo_id, name, status")
      .eq("business_id", pilotAccount.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { ...existing.data, existing: true };
  }

  const [factsResult, occupiedResult] = await Promise.all([
    supabase.from("fact_place_daily").select("place_id, views, saves, shares, directions, calls, website_clicks, map_opens").limit(1_000),
    supabase.from("business_locations").select("place_id").eq("status", "active").limit(1_000),
  ]);
  if (factsResult.error) throw factsResult.error;
  if (occupiedResult.error) throw occupiedResult.error;

  const totals = new Map();
  for (const row of factsResult.data || []) {
    const score =
      Number(row.views || 0) +
      Number(row.saves || 0) +
      Number(row.shares || 0) +
      Number(row.directions || 0) +
      Number(row.calls || 0) +
      Number(row.website_clicks || 0) +
      Number(row.map_opens || 0);
    totals.set(row.place_id, (totals.get(row.place_id) || 0) + score);
  }
  const occupied = new Set((occupiedResult.data || []).map((row) => row.place_id));
  const placeIds = [...totals.keys()].filter((placeId) => !occupied.has(placeId));
  if (!placeIds.length) throw new Error("No unassigned Place with real BI facts is available for the pilot.");

  const { data, error } = await supabase
    .from("dim_places")
    .select("place_id, place_name, geo_id, is_analytics_eligible")
    .in("place_id", placeIds)
    .eq("is_analytics_eligible", true)
    .not("geo_id", "is", null)
    .limit(1_000);
  if (error) throw error;
  const selected = (data || []).sort(
    (left, right) => (totals.get(right.place_id) || 0) - (totals.get(left.place_id) || 0),
  )[0];
  if (!selected) throw new Error("No enriched, analytics-eligible Place with real facts is available for the pilot.");
  return { ...selected, name: selected.place_name, activity_count: totals.get(selected.place_id) || 0, existing: false };
}

async function selectControlPlace(supabase, pilotPlaceId) {
  const [factsResult, occupiedResult] = await Promise.all([
    supabase.from("fact_place_daily").select("place_id, views, saves, shares, directions, calls, website_clicks, map_opens").limit(1_000),
    supabase.from("business_locations").select("place_id").eq("status", "active").limit(1_000),
  ]);
  if (factsResult.error) throw factsResult.error;
  if (occupiedResult.error) throw occupiedResult.error;

  const totals = new Map();
  for (const row of factsResult.data || []) {
    const score =
      Number(row.views || 0) +
      Number(row.saves || 0) +
      Number(row.shares || 0) +
      Number(row.directions || 0) +
      Number(row.calls || 0) +
      Number(row.website_clicks || 0) +
      Number(row.map_opens || 0);
    totals.set(row.place_id, (totals.get(row.place_id) || 0) + score);
  }
  const occupied = new Set((occupiedResult.data || []).map((row) => row.place_id));
  occupied.add(pilotPlaceId);
  const placeIds = [...totals.keys()].filter((placeId) => !occupied.has(placeId));
  if (!placeIds.length) throw new Error("No unassigned Place with real BI facts is available for the isolation control.");

  const { data, error } = await supabase
    .from("dim_places")
    .select("place_id, place_name, geo_id, is_analytics_eligible")
    .in("place_id", placeIds)
    .eq("is_analytics_eligible", true)
    .not("geo_id", "is", null)
    .limit(1_000);
  if (error) throw error;
  const selected = (data || []).sort(
    (left, right) => (totals.get(right.place_id) || 0) - (totals.get(left.place_id) || 0),
  )[0];
  if (!selected) throw new Error("No enriched control Place with real facts is available.");
  return { ...selected, name: selected.place_name, activity_count: totals.get(selected.place_id) || 0 };
}

async function ensureOwnedLocation(supabase, { admin, ownerUser, account, place, purpose }) {
  const now = new Date().toISOString();
  const existingClaim = await supabase
    .from("business_claims")
    .select("id")
    .eq("business_id", account.id)
    .eq("place_id", place.place_id)
    .limit(1)
    .maybeSingle();
  if (existingClaim.error) throw existingClaim.error;
  const claimPayload = {
    business_id: account.id,
    place_id: place.place_id,
    requested_by: ownerUser.id,
    status: "approved",
    verification_method: "internal_admin_review",
    evidence: { purpose, approved_internal_test: true, non_public: true },
    reviewed_by: admin.id,
    reviewed_at: now,
    updated_at: now,
  };
  const claim = existingClaim.data
    ? await supabase.from("business_claims").update(claimPayload).eq("id", existingClaim.data.id)
    : await supabase.from("business_claims").insert(claimPayload);
  if (claim.error) throw claim.error;

  const location = await supabase
    .from("business_locations")
    .upsert(
      {
        business_id: account.id,
        place_id: place.place_id,
        geo_id: place.geo_id,
        name: place.name || place.place_name,
        status: "active",
        updated_at: now,
      },
      { onConflict: "business_id,place_id" },
    )
    .select("id, place_id, geo_id, name, status")
    .single();
  if (location.error) throw location.error;

  const market = await supabase.from("business_market_access").upsert(
    {
      business_id: account.id,
      geo_id: place.geo_id,
      access_type: "included",
      metadata: { source: purpose },
    },
    { onConflict: "business_id,geo_id" },
  );
  if (market.error) throw market.error;
  return location.data;
}

async function ensurePilotRecords(supabase, { admin, pilotUser, pilotAccount, controlUser, controlAccount, place, controlPlace }) {
  const membershipRows = [{ business_id: pilotAccount.id, user_id: pilotUser.id, role: "owner" }];
  if (controlUser && controlAccount) {
    membershipRows.push({ business_id: controlAccount.id, user_id: controlUser.id, role: "owner" });
  }
  const membership = await supabase.from("business_members").upsert(membershipRows, { onConflict: "business_id,user_id" });
  if (membership.error) throw membership.error;

  for (const account of [pilotAccount, controlAccount].filter(Boolean)) {
    const { error } = await supabase.rpc("sync_business_plan_entitlements", { target_business_id: account.id });
    if (error) throw error;
  }

  const location = await ensureOwnedLocation(supabase, {
    admin,
    ownerUser: pilotUser,
    account: pilotAccount,
    place,
    purpose: "controlled_bi_v2_production_pilot",
  });

  let controlLocation = null;
  if (controlUser && controlAccount && controlPlace) {
    controlLocation = await ensureOwnedLocation(supabase, {
      admin,
      ownerUser: controlUser,
      account: controlAccount,
      place: controlPlace,
      purpose: "controlled_bi_v2_isolation_control",
    });
  }
  return { location, controlLocation };
}

async function summarize(supabase, pilotAccount, controlAccount, place, controlPlace, apply) {
  if (!apply) {
    return {
      mode: "dry-run",
      pilot_account: pilotAccount.name,
      control_account: controlAccount?.name || null,
      selected_place: place.name || place.place_name,
      selected_place_real_activity_count: place.activity_count ?? null,
      control_place: controlPlace?.name || controlPlace?.place_name || null,
      writes: false,
    };
  }

  const [members, locations, claims, entitlements, markets, controlLocations, businessFacts] = await Promise.all([
    supabase
      .from("business_members")
      .select("business_id", { count: "exact", head: true })
      .in("business_id", [pilotAccount.id, controlAccount?.id].filter(Boolean)),
    supabase.from("business_locations").select("id", { count: "exact", head: true }).eq("business_id", pilotAccount.id).eq("status", "active"),
    supabase.from("business_claims").select("id", { count: "exact", head: true }).eq("business_id", pilotAccount.id).eq("status", "approved"),
    supabase.from("business_entitlements").select("entitlement").eq("business_id", pilotAccount.id).eq("enabled", true),
    supabase.from("business_market_access").select("geo_id", { count: "exact", head: true }).eq("business_id", pilotAccount.id),
    controlAccount
      ? supabase.from("business_locations").select("id", { count: "exact", head: true }).eq("business_id", controlAccount.id).eq("status", "active")
      : Promise.resolve({ count: 0, error: null }),
    supabase.from("fact_business_daily").select("day", { count: "exact", head: true }).eq("business_id", pilotAccount.id),
  ]);
  for (const result of [members, locations, claims, entitlements, markets, controlLocations, businessFacts]) {
    if (result.error) throw result.error;
  }
  return {
    mode: "apply",
    pilot_account: pilotAccount.name,
    pilot_plan: pilotAccount.plan,
    pilot_bi_v2_enabled: pilotAccount.bi_v2_enabled,
    control_account: controlAccount?.name || null,
    control_plan: controlAccount?.plan || null,
    control_bi_v2_enabled: controlAccount?.bi_v2_enabled ?? null,
    controlled_members: members.count,
    pilot_active_locations: locations.count,
    control_active_locations: controlLocations.count,
    pilot_approved_claims: claims.count,
    pilot_entitlements: (entitlements.data || []).map((row) => row.entitlement).sort(),
    pilot_market_grants: markets.count,
    pilot_business_fact_rows: businessFacts.count,
    selected_place: place.name || place.place_name,
    selected_place_real_activity_count: place.activity_count ?? null,
    control_place: controlPlace?.name || controlPlace?.place_name || null,
    writes: true,
  };
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const apply = hasFlag("apply");
  if (dryRun === apply) throw new Error("Choose exactly one of --dry-run or --apply.");

  const supabase = createBusinessServiceClient();
  const authClient = createPublicAuthClient();
  const adminCredentials = controlledCredentials("ADMIN");
  const pilotCredentials = controlledCredentials("PILOT");
  const controlCredentials = controlledCredentials("CONTROL");
  if (apply && !controlCredentials.configured) {
    throw new Error("Isolation-control credentials are required for the final two-tenant production proof.");
  }
  currentStep = "ensure_controlled_users";
  const adminUser = apply ? await signInControlledUser(authClient, adminCredentials, "Admin") : null;
  const pilotUser = apply ? await signInControlledUser(authClient, pilotCredentials, "Pilot Business user") : null;
  const controlUser = apply && controlCredentials.configured
    ? await signInControlledUser(authClient, controlCredentials, "Isolation-control Business user")
    : null;
  if (apply && adminUser.id === pilotUser.id) throw new Error("Admin and pilot must be distinct identities.");
  if (apply && controlUser && [adminUser.id, pilotUser.id].includes(controlUser.id)) {
    throw new Error("The isolation-control user must be distinct from Admin and pilot.");
  }
  currentStep = "find_authorized_admin";
  const admin = await findAuthorizedAdmin(supabase, adminUser?.id || null);
  currentStep = "ensure_business_accounts";
  const pilotAccount = await ensureAccount(supabase, PILOT_ACCOUNT, "enterprise", apply);
  const controlAccount = controlCredentials.configured
    ? await ensureAccount(supabase, CONTROL_ACCOUNT, "basic", apply)
    : await findAccount(supabase, CONTROL_ACCOUNT);
  currentStep = "select_pilot_place";
  const place = await selectPilotPlace(supabase, pilotAccount);
  currentStep = "select_control_place";
  const controlPlace =
    controlCredentials.configured || controlAccount
      ? await selectControlPlace(supabase, place.place_id)
      : null;

  if (apply) {
    currentStep = "ensure_pilot_records";
    await ensurePilotRecords(supabase, {
      admin,
      pilotUser,
      pilotAccount,
      controlUser,
      controlAccount,
      place,
      controlPlace,
    });
    currentStep = "recompute_business_facts";
    const days = [];
    const { data: dayRows, error: dayError } = await supabase
      .from("fact_place_daily")
      .select("day")
      .in("place_id", [place.place_id, controlPlace?.place_id].filter(Boolean));
    if (dayError) throw dayError;
    for (const row of dayRows || []) {
      if (row.day && !days.includes(row.day)) days.push(row.day);
    }
    days.sort();
    for (const day of days) {
      const business = await supabase.rpc("run_business_intelligence_aggregation", {
        target_day: day,
        run_trigger: "recompute",
        run_request_id: `pilot-provision-${day}`,
      });
      if (business.error) throw business.error;
      if (!business.data?.ok) throw new Error(`Business aggregation failed for ${day}.`);
    }
  }
  currentStep = "summarize";
  console.log(
    JSON.stringify(
      {
        ok: true,
        admin_credentials_configured: adminCredentials.configured,
        pilot_credentials_configured: pilotCredentials.configured,
        control_credentials_configured: controlCredentials.configured,
        ...(await summarize(supabase, pilotAccount, controlAccount, place, controlPlace, apply)),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        step: currentStep,
        error: safeError(error),
        error_type: error?.constructor?.name || typeof error,
        error_status: Number.isFinite(error?.status) ? error.status : null,
        error_fields: error && typeof error === "object" ? Object.keys(error).sort() : [],
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
