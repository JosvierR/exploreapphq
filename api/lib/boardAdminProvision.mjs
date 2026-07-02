import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

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
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
}

function getSupabaseSecretKey() {
  return (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

export function createServiceAdminClient() {
  const url = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();
  if (!url || !secretKey) {
    throw new Error("Supabase server credentials are not configured.");
  }

  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function listUsersByEmail(adminClient) {
  const map = new Map();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const user of data.users) {
      const email = user.email?.trim().toLowerCase();
      if (email) map.set(email, user);
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  return map;
}

async function upsertAdminUser(serviceClient, userId) {
  const { error } = await serviceClient.from("admin_users").upsert(
    { user_id: userId, role: "admin" },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

async function provisionAccount(adminClient, serviceClient, account, existingUsers) {
  const email = boardEmail(account.slot);
  const password = generateSecurePassword();
  const existing = existingUsers.get(email);
  const metadata = {
    explore_admin_slot: account.slot,
    explore_admin_label: account.label,
    explore_admin_board: true,
  };

  if (existing) {
    const { data, error } = await adminClient.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(existing.user_metadata || {}), ...metadata },
    });
    if (error) throw error;
    await upsertAdminUser(serviceClient, data.user.id);
    return { slot: account.slot, label: account.label, email, password, user_id: data.user.id, action: "updated" };
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) throw error;
  await upsertAdminUser(serviceClient, data.user.id);
  return { slot: account.slot, label: account.label, email, password, user_id: data.user.id, action: "created" };
}

export async function provisionBoardAdminAccounts() {
  const adminClient = createServiceAdminClient();
  const serviceClient = adminClient;
  const existingUsers = await listUsersByEmail(adminClient);
  const accounts = [];

  for (const account of BOARD_ACCOUNTS) {
    accounts.push(await provisionAccount(adminClient, serviceClient, account, existingUsers));
  }

  return {
    login_url: "https://www.exploreapphq.com/admin",
    accounts,
    allowed_emails: accounts.map((item) => item.email),
    explore_admin_allowed_emails: accounts.map((item) => item.email).join(","),
  };
}
