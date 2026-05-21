import { buildWaitlistWelcomeEmail } from "../../server/emails/waitlistWelcome.mjs";
import { saveWaitlistEntry } from "./lib/saveWaitlistEntry.mjs";
import { sendEmailViaResend } from "./lib/resendSend.mjs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function emailLinks() {
  const siteUrl = process.env.SITE_URL || "https://example.com";
  return {
    siteUrl,
    appleUrl: process.env.APP_STORE_URL || "",
    playUrl: process.env.PLAY_STORE_URL || "",
    logoUrl: `${siteUrl.replace(/\/$/, "")}/icon-192.png`,
  };
}

async function sendWelcome(email) {
  if (!process.env.SMTP_PASS) {
    console.warn("[waitlist] SMTP_PASS (Resend API key) not set — skip email");
    return;
  }

  const { subject, html, text } = buildWaitlistWelcomeEmail(email, emailLinks());
  await sendEmailViaResend({ to: email, subject, html, text, allowSandbox: true });
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
    const { created } = await saveWaitlistEntry(email);
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
    return Response.json(
      { error: err instanceof Error ? err.message : "Something went wrong." },
      { status: 500, headers: cors },
    );
  }
};
