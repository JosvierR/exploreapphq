/**
 * Provision controlled BI QA Auth identities for production closure.
 * Writes credentials only to gitignored .tmp/bi-qa.env — never prints passwords.
 */
import { randomBytes, createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createBusinessServiceClient, safeError } from "./business-runtime.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = resolve(ROOT, ".tmp", "bi-qa.env");

const IDENTITIES = [
  {
    prefix: "ADMIN",
    email: "bi.qa.admin.closure@exploreapphq.com",
    role: "admin",
    metadata: { purpose: "bi_v2_production_closure", kind: "qa_admin" },
  },
  {
    prefix: "PILOT",
    email: "bi.qa.pilot.closure@exploreapphq.com",
    role: null,
    metadata: { purpose: "bi_v2_production_closure", kind: "qa_pilot" },
  },
  {
    prefix: "CONTROL",
    email: "bi.qa.control.closure@exploreapphq.com",
    role: null,
    metadata: { purpose: "bi_v2_production_closure", kind: "qa_control" },
  },
];

function generateSecurePassword() {
  // Avoid # and $ so gitignored .env loaders do not truncate or interpolate values.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@%&*-_";
  const bytes = randomBytes(32);
  let password = "";
  for (let i = 0; i < 28; i += 1) password += alphabet[bytes[i] % alphabet.length];
  return `${password}X9!`;
}

function passwordFingerprint(password) {
  return createHash("sha256").update(password, "utf8").digest("hex").slice(0, 12);
}

function authAdminHeaders(secretKey) {
  const headers = {
    apikey: secretKey,
    "Content-Type": "application/json",
    "User-Agent": "explore-bi-qa-provision/1.0",
  };
  if (secretKey.startsWith("eyJ")) headers.Authorization = `Bearer ${secretKey}`;
  return headers;
}

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !secretKey) throw new Error("Supabase server credentials are not configured.");
  return { url, secretKey };
}

async function parseJson(response) {
  const text = await response.text();
  try {
    return { body: text ? JSON.parse(text) : {}, text };
  } catch {
    return { body: {}, text };
  }
}

function isDuplicateUserError(parsed) {
  const code = String(parsed.body?.error_code || parsed.body?.code || "").toLowerCase();
  const message = String(parsed.body?.msg || parsed.body?.message || parsed.body?.error || "").toLowerCase();
  return (
    code === "email_exists" ||
    code === "user_already_exists" ||
    message.includes("already been registered") ||
    message.includes("already exists") ||
    message.includes("duplicate")
  );
}

async function findUserIdByEmail(config, email) {
  const normalized = email.toLowerCase();
  const attempts = [
    `${config.url}/auth/v1/admin/users?email=${encodeURIComponent(normalized)}`,
    `${config.url}/auth/v1/admin/users?page=1&per_page=200`,
    `${config.url}/auth/v1/admin/users?page=2&per_page=200`,
  ];

  for (const url of attempts) {
    const response = await fetch(url, { headers: authAdminHeaders(config.secretKey) });
    const parsed = await parseJson(response);
    if (!response.ok) continue;
    if (parsed.body?.id && String(parsed.body.email || "").toLowerCase() === normalized) {
      return parsed.body.id;
    }
    const users = parsed.body?.users || (Array.isArray(parsed.body) ? parsed.body : []);
    const match = users.find((user) => String(user.email || "").toLowerCase() === normalized);
    if (match?.id) return match.id;
  }

  // Fallback through supabase-js admin API.
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(config.url, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const match = (data?.users || []).find((user) => String(user.email || "").toLowerCase() === normalized);
    if (match?.id) return match.id;
    if ((data?.users || []).length < 200) break;
  }
  return null;
}

async function upsertAuthUser(config, identity, password) {
  const createResponse = await fetch(`${config.url}/auth/v1/admin/users`, {
    method: "POST",
    headers: authAdminHeaders(config.secretKey),
    body: JSON.stringify({
      email: identity.email,
      password,
      email_confirm: true,
      user_metadata: identity.metadata,
      app_metadata: { bi_qa: true, purpose: "bi_v2_production_closure" },
    }),
  });
  const createParsed = await parseJson(createResponse);
  if (createResponse.ok) {
    const userId = createParsed.body.id;
    if (!userId) throw new Error(`createUser missing id for ${identity.prefix}`);
    return { user_id: userId, action: "created" };
  }

  if (!isDuplicateUserError(createParsed)) {
    const detail = createParsed.body?.msg || createParsed.body?.message || createParsed.text || `HTTP ${createResponse.status}`;
    throw new Error(`createUser failed for ${identity.prefix}: ${detail}`);
  }

  const userId = await findUserIdByEmail(config, identity.email);
  if (!userId) throw new Error(`Existing user for ${identity.prefix} could not be resolved.`);

  const updateResponse = await fetch(`${config.url}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: authAdminHeaders(config.secretKey),
    body: JSON.stringify({
      email: identity.email,
      password,
      email_confirm: true,
      user_metadata: identity.metadata,
      app_metadata: { bi_qa: true, purpose: "bi_v2_production_closure" },
    }),
  });
  const updateParsed = await parseJson(updateResponse);
  if (!updateResponse.ok) {
    const detail = updateParsed.body?.msg || updateParsed.body?.message || updateParsed.text || `HTTP ${updateResponse.status}`;
    throw new Error(`updateUser failed for ${identity.prefix}: ${detail}`);
  }
  return { user_id: userId, action: "updated" };
}

async function ensureAdminRoster(supabase, userId) {
  const { error } = await supabase.from("admin_users").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id" });
  if (error) throw error;
}

async function verifySignIn(email, password) {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const key = (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  ).trim();
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.user?.id) throw new Error(`Sign-in verification failed for ${email}.`);
  await client.auth.signOut();
  return data.user.id;
}

async function main() {
  const config = supabaseConfig();
  const supabase = createBusinessServiceClient();
  mkdirSync(dirname(OUT_PATH), { recursive: true });

  const lines = [
    "# Controlled BI QA identities — gitignored temporary file",
    `# generated_at=${new Date().toISOString()}`,
    "# Do not commit. Do not share. Destroy after closure.",
  ];
  const summary = [];

  for (const identity of IDENTITIES) {
    const password = generateSecurePassword();
    const result = await upsertAuthUser(config, identity, password);
    if (identity.role === "admin") await ensureAdminRoster(supabase, result.user_id);
    const verifiedId = await verifySignIn(identity.email, password);
    if (verifiedId !== result.user_id) throw new Error(`Sign-in user mismatch for ${identity.prefix}`);

    lines.push(`BI_${identity.prefix}_EMAIL="${identity.email}"`);
    lines.push(`BI_${identity.prefix}_PASSWORD="${password}"`);
    summary.push({
      prefix: identity.prefix,
      email: identity.email,
      user_id: result.user_id,
      action: result.action,
      admin_roster: identity.role === "admin",
      password_fingerprint: passwordFingerprint(password),
      sign_in: "PASS",
    });
  }

  writeFileSync(OUT_PATH, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  console.log(
    JSON.stringify(
      {
        ok: true,
        credentials_path: ".tmp/bi-qa.env",
        identities: summary,
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
