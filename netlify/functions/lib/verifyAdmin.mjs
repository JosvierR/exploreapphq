import { getAuthAdmin } from "./firebaseAdmin.mjs";

function adminEmails() {
  const raw = process.env.VITE_ADMIN_EMAILS || process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function verifyAdminRequest(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return { ok: false, status: 401, error: "Sign in required. Use /team and try again." };
  }

  try {
    const decoded = await getAuthAdmin().verifyIdToken(token);
    const email = decoded.email?.toLowerCase();
    if (!email || !adminEmails().includes(email)) {
      return { ok: false, status: 403, error: "This account does not have admin access." };
    }
    return { ok: true, email };
  } catch {
    return { ok: false, status: 401, error: "Invalid or expired session. Sign in again at /team." };
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
