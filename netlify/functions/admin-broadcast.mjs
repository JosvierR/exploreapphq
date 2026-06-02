import { verifyAdminRequest, jsonResponse } from "./lib/verifyAdmin.mjs";
import { listWaitlistMerged } from "./lib/waitlistMerged.mjs";
import { sendSms, isSmsConfigured } from "./lib/sendSms.mjs";
import { sendEmailViaResend, getResendEmailStatus } from "./lib/resendSend.mjs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function esc(s = "") {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
}

function buildEmailHtml(subject, message) {
  const siteUrl = (process.env.SITE_URL || "https://exploreapphq.com").replace(/\/$/, "");
  const body = esc(message).replace(/\n/g, "<br/>");
  return `<!doctype html><html><body style="margin:0;background:#0b0f14;padding:24px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#0f1620;border:1px solid #1d2733;border-radius:16px;padding:28px;color:#e8eef5">
      <h1 style="margin:0 0 16px;font-size:20px;color:#fff">${esc(subject)}</h1>
      <div style="font-size:15px;line-height:1.6;color:#c2cdd9">${body}</div>
      <p style="margin:24px 0 0;font-size:12px;color:#6b7280">
        <a href="${siteUrl}" style="color:#3aa0ff;text-decoration:none">exploreapphq.com</a>
      </p>
    </div></body></html>`;
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const auth = await verifyAdminRequest(request);
  if (!auth.ok) return jsonResponse(auth.status, { error: auth.error });

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return jsonResponse(503, {
      error: "Add FIREBASE_SERVICE_ACCOUNT_JSON in Netlify, then redeploy.",
    });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* empty ok */
  }

  const smsBody = typeof body.smsBody === "string" ? body.smsBody.trim() : "";
  const emailSubject = typeof body.emailSubject === "string" ? body.emailSubject.trim() : "";
  const emailBody = typeof body.emailBody === "string" ? body.emailBody.trim() : "";
  const dryRun = body.dryRun === true;
  const sendSmsChannel = Boolean(smsBody);
  const sendEmailChannel = Boolean(emailSubject && emailBody);

  if (!sendSmsChannel && !sendEmailChannel) {
    return jsonResponse(400, {
      error: "Write an SMS message, or an email subject + body (or both).",
    });
  }

  const { rows } = await listWaitlistMerged();
  const phones = [
    ...new Set(
      rows
        .filter((r) => r.phone && r.consentSms !== false && r.unsubscribed !== true)
        .map((r) => r.phone),
    ),
  ];
  const emails = [
    ...new Set(rows.filter((r) => r.email && r.unsubscribed !== true).map((r) => r.email)),
  ];

  if (dryRun) {
    return jsonResponse(200, {
      dryRun: true,
      smsRecipients: sendSmsChannel ? phones.length : 0,
      emailRecipients: sendEmailChannel ? emails.length : 0,
      total: rows.length,
    });
  }

  const result = { smsSent: 0, smsFailed: [], emailSent: 0, emailFailed: [] };

  if (sendSmsChannel) {
    if (!isSmsConfigured()) {
      result.smsError = "Twilio not configured (TWILIO_* in Netlify).";
    } else {
      for (const to of phones) {
        try {
          await sendSms({ to, body: smsBody });
          result.smsSent += 1;
        } catch (err) {
          result.smsFailed.push({ to, error: err instanceof Error ? err.message : "failed" });
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }

  if (sendEmailChannel) {
    const status = getResendEmailStatus();
    if (!status.ready) {
      result.emailError = status.reason || "Resend not ready.";
    } else {
      const html = buildEmailHtml(emailSubject, emailBody);
      for (const to of emails) {
        try {
          await sendEmailViaResend({ to, subject: emailSubject, html, text: emailBody });
          result.emailSent += 1;
        } catch (err) {
          result.emailFailed.push({ to, error: err instanceof Error ? err.message : "failed" });
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  return jsonResponse(200, {
    ...result,
    message: `Broadcast done — ${result.smsSent} SMS, ${result.emailSent} email(s).`,
  });
};
