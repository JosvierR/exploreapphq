import { randomBytes } from "node:crypto";

export const BOARD_ACCOUNTS = [
  { slot: "01", label: "Directiva 01" },
  { slot: "02", label: "Directiva 02" },
  { slot: "03", label: "Directiva 03" },
  { slot: "04", label: "Directiva 04" },
  { slot: "05", label: "Directiva 05" },
  { slot: "06", label: "Directiva 06" },
];

export function boardEmail(slot) {
  return `directiva.ops.${slot}@exploreapphq.com`;
}

export function generateSecurePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*-_";
  const bytes = randomBytes(32);
  let password = "";
  for (let i = 0; i < 28; i += 1) {
    password += alphabet[bytes[i] % alphabet.length];
  }
  return `${password}X9!`;
}

function getSupabaseUrl() {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
}

function getSupabaseSecretKey() {
  return (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

/** Auth Admin API — sb_secret keys must use apikey only (not Bearer JWT parsing). */
function authAdminHeaders(secretKey) {
  const headers = {
    apikey: secretKey,
    "Content-Type": "application/json",
    "User-Agent": "explore-admin-provision/1.0 (server)",
  };
  if (secretKey.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${secretKey}`;
  }
  return headers;
}

/** PostgREST — service key on both headers. */
function restHeaders(secretKey) {
  return {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  };
}

async function parseJson(response) {
  const text = await response.text();
  try {
    return { body: text ? JSON.parse(text) : {}, text };
  } catch {
    return { body: {}, text };
  }
}

function apiError(prefix, response, parsed) {
  const detail =
    parsed.body?.msg ||
    parsed.body?.message ||
    parsed.body?.error_description ||
    parsed.body?.error ||
    parsed.text ||
    `HTTP ${response.status}`;
  const message = typeof detail === "string" ? detail : JSON.stringify(detail);
  throw new Error(`${prefix} (${response.status}): ${message}`);
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
    `${config.url}/auth/v1/admin/users?page=1&per_page=50`,
  ];

  for (const url of attempts) {
    const response = await fetch(url, { headers: authAdminHeaders(config.secretKey) });
    const parsed = await parseJson(response);
    if (!response.ok) continue;

    const users = Array.isArray(parsed.body?.users) ? parsed.body.users : parsed.body?.id ? [parsed.body] : [];
    const match = users.find((user) => user.email?.trim().toLowerCase() === normalized);
    if (match?.id) return match.id;
  }

  return null;
}

async function upsertAdminUser(config, userId) {
  const response = await fetch(`${config.url}/rest/v1/admin_users?on_conflict=user_id`, {
    method: "POST",
    headers: {
      ...restHeaders(config.secretKey),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ user_id: userId, role: "admin" }),
  });
  const parsed = await parseJson(response);
  if (!response.ok) apiError("admin_users upsert failed", response, parsed);
}

async function updateExistingUser(config, account, email, password, userId) {
  const metadata = {
    explore_admin_slot: account.slot,
    explore_admin_label: account.label,
    explore_admin_board: true,
  };

  const response = await fetch(`${config.url}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: authAdminHeaders(config.secretKey),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    }),
  });
  const parsed = await parseJson(response);
  if (!response.ok) apiError(`updateUser failed for ${email}`, response, parsed);

  await upsertAdminUser(config, userId);
  return {
    slot: account.slot,
    label: account.label,
    email,
    password,
    user_id: userId,
    action: "updated",
  };
}

async function provisionAccount(config, account) {
  const email = boardEmail(account.slot);
  const password = generateSecurePassword();
  const metadata = {
    explore_admin_slot: account.slot,
    explore_admin_label: account.label,
    explore_admin_board: true,
  };

  const createResponse = await fetch(`${config.url}/auth/v1/admin/users`, {
    method: "POST",
    headers: authAdminHeaders(config.secretKey),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    }),
  });
  const createParsed = await parseJson(createResponse);

  if (createResponse.ok) {
    const userId = createParsed.body.id;
    if (!userId) throw new Error(`createUser failed for ${email}: missing user id in response.`);
    await upsertAdminUser(config, userId);
    return {
      slot: account.slot,
      label: account.label,
      email,
      password,
      user_id: userId,
      action: "created",
    };
  }

  if (isDuplicateUserError(createParsed)) {
    const userId = await findUserIdByEmail(config, email);
    if (!userId) {
      throw new Error(
        `User already exists for ${email}, but the admin API could not resolve the user id. Update the user manually in Supabase Auth.`,
      );
    }
    return updateExistingUser(config, account, email, password, userId);
  }

  apiError(`createUser failed for ${email}`, createResponse, createParsed);
}

export async function provisionBoardAdminAccounts() {
  const url = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();
  if (!url || !secretKey) {
    throw new Error("Supabase server credentials are not configured.");
  }

  const config = { url, secretKey };
  const accounts = [];

  for (const account of BOARD_ACCOUNTS) {
    accounts.push(await provisionAccount(config, account));
  }

  return {
    login_url: "https://www.exploreapphq.com/admin",
    accounts,
    allowed_emails: accounts.map((item) => item.email),
    explore_admin_allowed_emails: accounts.map((item) => item.email).join(","),
  };
}
