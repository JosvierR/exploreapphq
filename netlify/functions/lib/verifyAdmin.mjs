import { getAuthAdmin } from "./firebaseAdmin.mjs";
import { createClient } from "@supabase/supabase-js";

const HARDCODED_ADMIN_EMAIL = "admin@example.com";
const HARDCODED_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin";

function hardcodedAdminToken() {
  return `hc_${Buffer.from(`${HARDCODED_ADMIN_EMAIL}:${HARDCODED_ADMIN_PASSWORD}`).toString("base64")}`;
}

function verifyHardcodedToken(token) {
  if (token !== hardcodedAdminToken()) return null;
  return HARDCODED_ADMIN_EMAIL;
}

function adminEmails() {
  const raw =
    process.env.EXPLORE_ADMIN_ALLOWED_EMAILS ||
    process.env.VITE_ADMIN_EMAILS ||
    process.env.ADMIN_EMAILS ||
    "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const secret = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return { url, secret };
}

async function verifySupabaseAdmin(token) {
  const { url, secret } = supabaseConfig();
  if (!url || !secret) return null;

  const client = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;

  const email = data.user.email?.trim().toLowerCase() || "";
  const { data: adminRow } = await client
    .from("admin_users")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (adminRow && ["admin", "moderator"].includes(adminRow.role)) {
    return { ok: true, email };
  }

  const allowed = adminEmails();
  if (email && allowed.includes(email)) {
    return { ok: true, email };
  }

  if (email) {
    return { ok: false, status: 403, error: "This account does not have admin access." };
  }

  return null;
}

export async function verifyAdminRequest(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return { ok: false, status: 401, error: "Sign in required. Use /admin and try again." };
  }

  const hardcodedEmail = verifyHardcodedToken(token);
  if (hardcodedEmail) {
    return { ok: true, email: hardcodedEmail };
  }

  const supabaseAuth = await verifySupabaseAdmin(token);
  if (supabaseAuth?.ok) {
    return supabaseAuth;
  }
  if (supabaseAuth && !supabaseAuth.ok) {
    return supabaseAuth;
  }

  try {
    const decoded = await getAuthAdmin().verifyIdToken(token);
    const email = decoded.email?.toLowerCase();
    if (!email || !adminEmails().includes(email)) {
      return { ok: false, status: 403, error: "This account does not have admin access." };
    }
    return { ok: true, email };
  } catch {
    return { ok: false, status: 401, error: "Invalid or expired session. Sign in again at /admin." };
  }
}

export function jsonResponse(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      ...extraHeaders,
    },
  });
}
