import nodemailer from "nodemailer";
import { getStore } from "@netlify/blobs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function buildWaitlistWelcomeEmail(email, links) {
  const body = `
    <tr><td style="background:#0b0f14;padding:28px 32px;text-align:center;">
      <p style="margin:0;font-size:26px;font-weight:800;color:#fff;">Explore</p>
      <p style="margin:10px 0 0;font-size:14px;color:#b8c2cc;">Discover real places through videos</p>
    </td></tr>
    <tr><td style="background:#fff;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:24px;color:#0b0f14;">Thanks for joining Explore</h1>
      <p style="margin:0;font-size:16px;line-height:1.65;color:#3d4654;">
        We saved <strong>${email}</strong> on our early access list.
      </p>
    </td></tr>`;
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#eef2f7;font-family:system-ui,sans-serif;">
    <table width="100%" style="padding:32px 16px;"><tr><td align="center">
    <table style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;">${body}</table>
    </td></tr></table></body></html>`;
  return {
    subject: "You're on the Explore list — we'll notify you when it's ready",
    html,
    text: `Thanks for joining Explore!\n\nWe saved ${email} on our early access list.\n\n— The Explore team`,
  };
}

function emailLinks() {
  const siteUrl = process.env.SITE_URL || "https://example.com";
  return {
    siteUrl,
    appleUrl: process.env.APP_STORE_URL || "",
    playUrl: process.env.PLAY_STORE_URL || "",
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
    console.warn("[waitlist] Blobs:", err?.message ?? err);
    return true;
  }
}

async function sendWelcome(email) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !pass) {
    console.warn("[waitlist] SMTP not configured — skip email");
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user: user || process.env.SMTP_USER, pass },
  });

  const { subject, html, text } = buildWaitlistWelcomeEmail(email, emailLinks());
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "Explore <noreply@example.com>",
    to: email,
    subject,
    html,
    text,
  });
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "Invalid email address." }, { status: 400, headers: cors });
  }

  try {
    const created = await saveEmail(email);
    try {
      await sendWelcome(email);
    } catch (mailErr) {
      console.error("[waitlist] email failed:", mailErr);
    }

    return Response.json(
      {
        ok: true,
        created,
        message: created ? "You're on the list." : "You're already on the list.",
      },
      { status: 200, headers: cors },
    );
  } catch (err) {
    console.error("[waitlist]", err);
    return Response.json({ error: "Something went wrong." }, { status: 500, headers: cors });
  }
};
