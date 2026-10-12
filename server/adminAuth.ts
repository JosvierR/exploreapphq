import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { getAuthAdmin, isFirebaseAdminConfigured } from "./firebaseAdmin.js";

export type AdminPayload = { role: "admin" | "moderator"; email: string };

type SupabaseAdminResult =
  | { status: "authorized"; admin: AdminPayload }
  | { status: "forbidden" }
  | { status: "unavailable" | "invalid" };

function adminEmails(): string[] {
  const raw =
    process.env.EXPLORE_ADMIN_ALLOWED_EMAILS ||
    process.env.ADMIN_ALLOWED_EMAILS ||
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

async function verifySupabaseAdmin(token: string): Promise<SupabaseAdminResult> {
  const { url, secret } = supabaseConfig();
  if (!url || !secret) return { status: "unavailable" };

  const client = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { status: "invalid" };

  const email = data.user.email?.trim().toLowerCase() || "";
  const { data: adminRow } = await client
    .from("admin_users")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (adminRow && (adminRow.role === "admin" || adminRow.role === "moderator")) {
    return { status: "authorized", admin: { role: adminRow.role, email } };
  }
  if (email && adminEmails().includes(email)) {
    return { status: "authorized", admin: { role: "admin", email } };
  }
  return { status: "forbidden" };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  void (async () => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      res.status(401).json({ error: "Admin token required." });
      return;
    }

    try {
      const supabaseResult = await verifySupabaseAdmin(token);
      if (supabaseResult.status === "authorized") {
        (req as Request & { admin: AdminPayload }).admin = supabaseResult.admin;
        next();
        return;
      }
      if (supabaseResult.status === "forbidden") {
        res.status(403).json({ error: "This account does not have admin access." });
        return;
      }
    } catch {
      // A secondary configured identity provider can still validate the token.
    }

    if (isFirebaseAdminConfigured()) {
      try {
        const decoded = await getAuthAdmin().verifyIdToken(token);
        const email = decoded.email?.toLowerCase();
        if (email && adminEmails().includes(email)) {
          (req as Request & { admin: AdminPayload }).admin = { role: "admin", email };
          next();
          return;
        }
      } catch {
        /* Return the common invalid-session response below. */
      }
    }

    res.status(401).json({ error: "Invalid or expired token." });
  })();
}
