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

function serviceHeaders(secretKey) {
  const headers = {
    apikey: secretKey,
    "Content-Type": "application/json",
    "User-Agent": "explore-admin-provision/1.0 (server)",
  };
  headers.Authorization = `Bearer ${secretKey}`;
  return headers;
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

async function listUsersByEmail(config) {
  const map = new Map();
  let page = 1;
  const perPage = 200;

  while (true) {
    const response = await fetch(
      `${config.url}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { headers: serviceHeaders(config.secretKey) },
    );
    const parsed = await parseJson(response);
    if (!response.ok) apiError("listUsers failed", response, parsed);

    const users = parsed.body.users || [];
    for (const user of users) {
      const email = user.email?.trim().toLowerCase();
      if (email) map.set(email, user);
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return map;
}

async function upsertAdminUser(config, userId) {
  const response = await fetch(`${config.url}/rest/v1/admin_users?on_conflict=user_id`, {
    method: "POST",
    headers: {
      ...serviceHeaders(config.secretKey),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ user_id: userId, role: "admin" }),
  });
  const parsed = await parseJson(response);
  if (!response.ok) apiError("admin_users upsert failed", response, parsed);
}

async function provisionAccount(config, account, existingUsers) {
  const email = boardEmail(account.slot);
  const password = generateSecurePassword();
  const existing = existingUsers.get(email);
  const metadata = {
    explore_admin_slot: account.slot,
    explore_admin_label: account.label,
    explore_admin_board: true,
  };

  if (existing) {
    const response = await fetch(`${config.url}/auth/v1/admin/users/${existing.id}`, {
      method: "PUT",
      headers: serviceHeaders(config.secretKey),
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { ...(existing.user_metadata || {}), ...metadata },
      }),
    });
    const parsed = await parseJson(response);
    if (!response.ok) apiError(`updateUser failed for ${email}`, response, parsed);
    const userId = parsed.body.id || existing.id;
    await upsertAdminUser(config, userId);
    return { slot: account.slot, label: account.label, email, password, user_id: userId, action: "updated" };
  }

  const response = await fetch(`${config.url}/auth/v1/admin/users`, {
    method: "POST",
    headers: serviceHeaders(config.secretKey),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    }),
  });
  const parsed = await parseJson(response);
  if (!response.ok) apiError(`createUser failed for ${email}`, response, parsed);
  const userId = parsed.body.id;
  if (!userId) throw new Error(`createUser failed for ${email}: missing user id in response.`);
  await upsertAdminUser(config, userId);
  return { slot: account.slot, label: account.label, email, password, user_id: userId, action: "created" };
}

export async function provisionBoardAdminAccounts() {
  const url = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();
  if (!url || !secretKey) {
    throw new Error("Supabase server credentials are not configured.");
  }

  const config = { url, secretKey };
  const existingUsers = await listUsersByEmail(config);
  const accounts = [];

  for (const account of BOARD_ACCOUNTS) {
    accounts.push(await provisionAccount(config, account, existingUsers));
  }

  return {
    login_url: "https://www.exploreapphq.com/admin",
    accounts,
    allowed_emails: accounts.map((item) => item.email),
    explore_admin_allowed_emails: accounts.map((item) => item.email).join(","),
  };
}
