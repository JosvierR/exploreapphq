import cors from "cors";
import express from "express";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import jwt from "jsonwebtoken";
// Plain ESM handlers are shared with Vercel serverless functions.
// @ts-ignore
import {
  handleAdminModerationAction,
  handleAdminMe,
  handleAdminReportById,
  handleAdminReports,
  handleHealth,
  handleReports,
} from "../api/lib/supabaseModeration.mjs";
import { requireAdmin } from "./adminAuth.js";
import { config } from "./config.js";
import {
  addToWaitlist,
  getWaitlistStats,
  listWaitlist,
  listWaitlistPendingLaunch,
  markLaunchNotified,
} from "./db.js";
import { isFirebaseAdminConfigured } from "./firebaseAdmin.js";
import { sendAppLaunchBulk, sendWaitlistEmail } from "./mail.js";
import {
  listPendingLaunchEmailsMergedAsync,
  listWaitlistMergedAsync,
} from "./waitlistMerged.js";
import { markLaunchNotifiedFirestore } from "./waitlistFirestore.js";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

type FetchHandler = (request: Request) => Promise<Response>;

function expressHeaders(req: ExpressRequest) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

function expressUrl(req: ExpressRequest) {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${config.port}`;
  return `${protocol}://${host}${req.originalUrl || req.url}`;
}

async function sendFetchResponse(
  handler: FetchHandler,
  req: ExpressRequest,
  res: ExpressResponse,
) {
  try {
    const headers = expressHeaders(req);
    let body: string | undefined;
    if (req.method !== "GET" && req.method !== "HEAD" && req.body !== undefined) {
      body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      if (!headers.has("content-type")) headers.set("content-type", "application/json");
    }

    const request = new Request(expressUrl(req), {
      method: req.method,
      headers,
      body,
    });
    const response = await handler(request);

    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "transfer-encoding") {
        res.setHeader(key, value);
      }
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 0) res.send(buffer);
    else res.end();
  } catch (err) {
    console.error("[moderation-api]", err);
    res.status(500).json({ ok: false, error: "Unexpected server error." });
  }
}

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

app.all("/api/health", (req, res) => {
  void sendFetchResponse(handleHealth, req, res);
});

app.all("/api/reports", (req, res) => {
  void sendFetchResponse(handleReports, req, res);
});

app.all("/api/admin/reports", (req, res) => {
  void sendFetchResponse(handleAdminReports, req, res);
});

app.all("/api/admin/me", (req, res) => {
  void sendFetchResponse(handleAdminMe, req, res);
});

app.all("/api/admin/reports/:id", (req, res) => {
  void sendFetchResponse((request) => handleAdminReportById(request, req.params.id), req, res);
});

app.all("/api/admin/moderation/action", (req, res) => {
  void sendFetchResponse(handleAdminModerationAction, req, res);
});

/** Public waitlist signup (email only) — used by the Firebase front-end */
app.post("/api/waitlist/signup", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";

    if (!email && !phone) {
      return res.status(400).json({ error: "A phone number or email is required." });
    }

    // Phone-only signup: Firestore (client) is the source of truth in dev; nothing to email.
    if (!email) {
      return res.json({ ok: true, created: true, message: "You're on the list." });
    }

    const { created } = addToWaitlist(email);
    try {
      await sendWaitlistEmail(email);
    } catch (mailErr) {
      console.error("[mail]", mailErr);
      return res.status(503).json({
        error: "Could not send confirmation email. Try again later.",
      });
    }

    return res.json({
      ok: true,
      created,
      message: created
        ? "You're on the list."
        : "You're already on the list.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong." });
  }
});

app.post("/api/access", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : undefined;

    if (!email) {
      return res.status(400).json({ error: "Invalid email address." });
    }

    if (email === config.adminEmail) {
      if (!password) {
        return res.json({ access: "password_required" as const });
      }
      if (password !== config.adminPassword) {
        return res.status(401).json({ error: "Incorrect password." });
      }
      const token = jwt.sign({ role: "admin", email }, config.jwtSecret, { expiresIn: "7d" });
      return res.json({ access: "full" as const, token });
    }

    const { created } = addToWaitlist(email);
    try {
      await sendWaitlistEmail(email);
    } catch (mailErr) {
      console.error("[mail]", mailErr);
      return res.status(503).json({
        error: "Could not send confirmation email. Is Mailpit running on port 1025?",
      });
    }

    return res.json({
      access: "waitlist" as const,
      created,
      message: created
        ? "You're on the list. Check your inbox — we'll notify you when the app is 100% ready."
        : "You're already on the list. We'll notify you when the app is 100% ready.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

/** Admin: view who signed up (Firebase ID token from /team or legacy JWT) */
app.get("/api/admin/waitlist", requireAdmin, async (req, res) => {
  if (isFirebaseAdminConfigured()) {
    try {
      const data = await listWaitlistMergedAsync();
      return res.json(data);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Could not load Firestore waitlist." });
    }
  }

  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const stats = getWaitlistStats();
  const rows = listWaitlist(limit, offset);
  return res.json({ stats, rows, source: "local" });
});

/**
 * Admin: email everyone on the waitlist that the app is ready.
 * ?dryRun=1 — only returns who would receive it.
 * By default only emails rows where launch_notified_at IS NULL.
 */
app.post("/api/admin/waitlist/notify-launch", requireAdmin, async (req, res) => {
  const dryRun = req.query.dryRun === "1" || req.body?.dryRun === true;

  try {
    if (isFirebaseAdminConfigured()) {
      const pending = await listPendingLaunchEmailsMergedAsync();

      if (dryRun) {
        return res.json({ dryRun: true, count: pending.length, emails: pending });
      }

      if (pending.length === 0) {
        const { stats } = await listWaitlistMergedAsync();
        return res.json({ sent: [], failed: [], message: "No pending recipients.", stats });
      }

      const result = await sendAppLaunchBulk(pending, markLaunchNotifiedFirestore);
      const { stats } = await listWaitlistMergedAsync();
      return res.json({ ...result, stats, message: `Sent ${result.sent.length} launch email(s).` });
    }

    const pending = listWaitlistPendingLaunch();

    if (dryRun) {
      return res.json({
        dryRun: true,
        count: pending.length,
        emails: pending.map((r) => r.email),
      });
    }

    if (pending.length === 0) {
      return res.json({ sent: [], failed: [], message: "No pending recipients." });
    }

    const result = await sendAppLaunchBulk(
      pending.map((r) => r.email),
      markLaunchNotified,
    );
    const message =
      result.failed.length > 0
        ? `Sent ${result.sent.length}. Failed ${result.failed.length}.`
        : `Sent ${result.sent.length} launch email(s) via Mailpit/local SMTP.`;

    return res.json({
      ...result,
      stats: getWaitlistStats(),
      message,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Bulk send failed." });
  }
});

app.get("/api/me", (req, res) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const payload = jwt.verify(token, config.jwtSecret) as { role?: string; email?: string };
    if (payload.role !== "admin") return res.status(401).json({ error: "Unauthorized" });
    return res.json({ role: "admin", email: payload.email });
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
});

app.listen(config.port, () => {
  console.log(`API http://localhost:${config.port}`);
  console.log(`Admin: ${config.adminEmail}`);
  console.log(`SMTP ${config.smtp.host}:${config.smtp.port} (Mailpit)`);
});
