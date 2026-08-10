import { jsonResponse, optionsResponse } from "../http/responses.mjs";
import { requireAdmin } from "./supabaseModeration.mjs";

const ADMIN_ROLES = new Set(["admin", "moderator"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class RosterError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "RosterError";
    this.status = status;
  }
}

function methodNotAllowed() {
  return jsonResponse(405, { ok: false, error: "Method not allowed." });
}

function handleRosterError(error) {
  const status = error instanceof RosterError ? error.status : error?.status || 500;
  const message =
    status >= 500
      ? "Internal server error."
      : error instanceof Error
        ? error.message
        : "Request failed.";
  return jsonResponse(status, { ok: false, error: message });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new RosterError(400, "Request body must be valid JSON.");
  }
}

function requireRosterManager(context) {
  if (context.role !== "admin") {
    throw new RosterError(403, "Only full admins can manage the admin roster.");
  }
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeRole(value) {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!ADMIN_ROLES.has(role)) {
    throw new RosterError(400, "role must be admin or moderator.");
  }
  return role;
}

function normalizeUserId(value) {
  const userId = typeof value === "string" ? value.trim() : "";
  if (!UUID_RE.test(userId)) {
    throw new RosterError(400, "user_id must be a valid UUID.");
  }
  return userId;
}

function allowedAdminEmails() {
  const raw =
    process.env.EXPLORE_ADMIN_ALLOWED_EMAILS ||
    process.env.ADMIN_ALLOWED_EMAILS ||
    process.env.VITE_ADMIN_EMAILS ||
    "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function findAuthUserByEmail(supabase, email) {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) {
    throw new RosterError(400, "A valid email is required.");
  }

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new RosterError(502, "Unable to look up auth users.");
    const users = data?.users || [];
    const match = users.find((user) => normalizeEmail(user.email) === normalized);
    if (match) return match;
    if (users.length < 200) break;
  }

  return null;
}

async function enrichAdminRows(supabase, rows) {
  const enriched = [];
  for (const row of rows) {
    let email = null;
    let lastSignInAt = null;
    let emailConfirmed = null;
    let label = null;
    let slot = null;

    try {
      const { data, error } = await supabase.auth.admin.getUserById(row.user_id);
      if (!error && data?.user) {
        email = data.user.email || null;
        lastSignInAt = data.user.last_sign_in_at || null;
        emailConfirmed = Boolean(data.user.email_confirmed_at);
        label = data.user.user_metadata?.explore_admin_label || null;
        slot = data.user.user_metadata?.explore_admin_slot || null;
      }
    } catch {
      // Keep roster readable even if Auth Admin lookup fails for one row.
    }

    enriched.push({
      user_id: row.user_id,
      role: row.role,
      created_at: row.created_at,
      email,
      label,
      slot,
      last_sign_in_at: lastSignInAt,
      email_confirmed: emailConfirmed,
    });
  }

  return enriched.sort((a, b) => {
    const emailA = a.email || a.user_id;
    const emailB = b.email || b.user_id;
    return emailA.localeCompare(emailB);
  });
}

async function listAdminRoster(supabase) {
  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id, role, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw new RosterError(503, "admin_users table is not available.");
  }

  return enrichAdminRows(supabase, data || []);
}

async function countAdmins(supabase) {
  const { count, error } = await supabase
    .from("admin_users")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new RosterError(503, "admin_users table is not available.");
  return count || 0;
}

export async function handleAdminRoster(request) {
  try {
    if (request.method === "OPTIONS") return optionsResponse();
    if (!["GET", "POST", "PATCH", "DELETE"].includes(request.method)) return methodNotAllowed();

    const context = await requireAdmin(request);
    const { supabase, user, role, email, fallback } = context;

    if (request.method === "GET") {
      const admins = await listAdminRoster(supabase);
      return jsonResponse(200, {
        ok: true,
        admins,
        total: admins.length,
        current_user_id: user.id,
        current_role: role,
        can_manage: role === "admin",
        fallback: Boolean(fallback),
        allowlist_emails: allowedAdminEmails(),
      });
    }

    requireRosterManager(context);
    const body = await readJson(request);

    if (request.method === "POST") {
      const nextRole = body.role === undefined ? "moderator" : normalizeRole(body.role);
      const authUser = await findAuthUserByEmail(supabase, body.email);
      if (!authUser?.id) {
        throw new RosterError(
          404,
          "No Supabase Auth user exists for that email. Create the account in Auth first, then add it here.",
        );
      }

      const { data, error } = await supabase
        .from("admin_users")
        .upsert({ user_id: authUser.id, role: nextRole }, { onConflict: "user_id" })
        .select("user_id, role, created_at")
        .single();

      if (error) throw new RosterError(502, "Unable to add admin user.");

      const [admin] = await enrichAdminRows(supabase, [data]);
      return jsonResponse(200, { ok: true, admin, action: "upserted" });
    }

    if (request.method === "PATCH") {
      const userId = normalizeUserId(body.user_id);
      const nextRole = normalizeRole(body.role);

      const current = await supabase.from("admin_users").select("user_id, role, created_at").eq("user_id", userId).maybeSingle();
      if (current.error) throw new RosterError(502, "Unable to load admin user.");
      if (!current.data) throw new RosterError(404, "Admin user not found.");

      if (current.data.role === "admin" && nextRole !== "admin") {
        const adminCount = await countAdmins(supabase);
        if (adminCount <= 1) {
          throw new RosterError(400, "Cannot demote the last full admin.");
        }
      }

      if (userId === user.id && nextRole !== "admin") {
        throw new RosterError(400, "You cannot demote your own admin role.");
      }

      const { data, error } = await supabase
        .from("admin_users")
        .update({ role: nextRole })
        .eq("user_id", userId)
        .select("user_id, role, created_at")
        .single();

      if (error) throw new RosterError(502, "Unable to update admin role.");

      const [admin] = await enrichAdminRows(supabase, [data]);
      return jsonResponse(200, { ok: true, admin, action: "updated" });
    }

    // DELETE
    const userId = normalizeUserId(body.user_id);
    if (userId === user.id) {
      throw new RosterError(400, "You cannot remove your own admin access.");
    }

    const current = await supabase.from("admin_users").select("user_id, role").eq("user_id", userId).maybeSingle();
    if (current.error) throw new RosterError(502, "Unable to load admin user.");
    if (!current.data) throw new RosterError(404, "Admin user not found.");

    if (current.data.role === "admin") {
      const adminCount = await countAdmins(supabase);
      if (adminCount <= 1) {
        throw new RosterError(400, "Cannot remove the last full admin.");
      }
    }

    const { error } = await supabase.from("admin_users").delete().eq("user_id", userId);
    if (error) throw new RosterError(502, "Unable to remove admin user.");

    return jsonResponse(200, {
      ok: true,
      action: "removed",
      user_id: userId,
      actor_email: email || null,
    });
  } catch (error) {
    return handleRosterError(error);
  }
}
