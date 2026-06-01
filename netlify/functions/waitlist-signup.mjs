import { buildWaitlistWelcomeEmail } from "../../server/emails/waitlistWelcome.mjs";
import { saveWaitlistEntry } from "./lib/saveWaitlistEntry.mjs";
import { sendEmailViaResend } from "./lib/resendSend.mjs";
import { sendSms, isSmsConfigured } from "./lib/sendSms.mjs";
import { buildContact } from "./lib/contact.mjs";
import { SEQUENCE } from "./lib/sequences.mjs";

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

async function sendWelcomeEmail(email) {
  if (!email || !process.env.SMTP_PASS) return;
  const { subject, html, text } = buildWaitlistWelcomeEmail(email, emailLinks());
  await sendEmailViaResend({ to: email, subject, html, text, allowSandbox: true });
}

async function sendWelcomeSms(phone) {
  if (!phone || !isSmsConfigured()) return;
  const body = SEQUENCE[0].sms;
  await sendSms({ to: phone, body });
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

  const { ok, contact, error } = buildContact(body);
  if (!ok) {
    return Response.json({ error }, { status: 400, headers: cors });
  }

  try {
    const { created, addedEmail } = await saveWaitlistEntry(contact);

    // Welcome messages only for brand-new signups (or when an email is newly added).
    if (created || addedEmail) {
      try {
        await sendWelcomeEmail(contact.email);
      } catch (mailErr) {
        console.error("[waitlist] welcome email failed:", mailErr);
      }
    }
    if (created) {
      try {
        await sendWelcomeSms(contact.phone);
      } catch (smsErr) {
        console.error("[waitlist] welcome SMS failed:", smsErr);
      }
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
