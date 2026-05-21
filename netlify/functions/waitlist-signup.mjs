import nodemailer from "nodemailer";
import { getStore } from "@netlify/blobs";
import { buildWaitlistWelcomeEmail } from "../../server/emails/waitlistWelcome.mjs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function emailLinks() {
  const siteUrl = process.env.SITE_URL ?? "https://exploreapphq.com";
  return {
    siteUrl,
    appleUrl:
      process.env.APP_STORE_URL ??
      "https://apps.apple.com/do/app/explore-tourism/id6748882805?l=en-GB",
    playUrl:
      process.env.PLAY_STORE_URL ??
      "https://play.google.com/store/apps/details?id=com.explore.miapp&hl=es",
    logoUrl: `${siteUrl}/icon-192.png`,
  };
}

async function saveEmail(email) {
  try {
    const store = getStore("waitlist");
    const existing = await store.get(email, { type: "json" });
    if (existing) return false;
    await store.setJSON(email, { email, createdAt: new Date().toISOString() });
    return true;
  } catch (err) {
    console.warn("[waitlist] Blobs store unavailable:", err.message);
    return true;
  }
}

async function sendWelcome(email) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    console.warn("[waitlist] SMTP_HOST not set — skipping email");
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: user && pass ? { user, pass } : undefined,
  });

  const { subject, html, text } = buildWaitlistWelcomeEmail(email, emailLinks());
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "Explore <noreply@exploreapphq.com>",
    to: email,
    subject,
    html,
    text,
  });
}

export default async (req) => {
  if (req.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    };
  }

  if (req.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = JSON.parse(req.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return json(400, { error: "Invalid email address." });
  }

  try {
    const created = await saveEmail(email);
    try {
      await sendWelcome(email);
    } catch (mailErr) {
      console.error("[waitlist] email failed:", mailErr);
      if (created) {
        return json(503, {
          error: "You're on the list, but we could not send the confirmation email yet.",
        });
      }
    }

    return json(200, {
      ok: true,
      created,
      message: created ? "You're on the list." : "You're already on the list.",
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: "Something went wrong." });
  }
};
