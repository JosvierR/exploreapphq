import { listSequenceContacts, advanceSeqStep } from "./lib/waitlistFirestore.mjs";
import { cronSteps, buildStepEmail } from "./lib/sequences.mjs";
import { sendEmailViaResend } from "./lib/resendSend.mjs";
import { sendSms, isSmsConfigured } from "./lib/sendSms.mjs";

// Netlify scheduled function: runs once a day.
export const config = { schedule: "@daily" };

const DAY_MS = 24 * 60 * 60 * 1000;

function emailLinks() {
  const siteUrl = process.env.SITE_URL || "https://example.com";
  return {
    siteUrl,
    appleUrl: process.env.APP_STORE_URL || "",
    playUrl: process.env.PLAY_STORE_URL || "",
    logoUrl: `${siteUrl.replace(/\/$/, "")}/icon-192.png`,
  };
}

/** Earliest step a contact is due for that hasn't been sent yet. */
function nextDueStep(contact, steps, now) {
  if (!contact.createdAt) return null;
  const ageDays = (now - contact.createdAt.getTime()) / DAY_MS;
  for (const step of steps) {
    if (step.index > contact.seqStep && ageDays >= step.day) {
      return step;
    }
  }
  return null;
}

async function runSequence() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return { ran: false, reason: "FIREBASE_SERVICE_ACCOUNT_JSON missing" };
  }

  const steps = cronSteps();
  const contacts = await listSequenceContacts();
  const now = Date.now();
  const links = emailLinks();
  const smsReady = isSmsConfigured();
  const emailReady = Boolean(process.env.SMTP_PASS);

  let emailsSent = 0;
  let smsSent = 0;
  let advanced = 0;
  const errors = [];

  for (const contact of contacts) {
    if (contact.unsubscribed) continue;
    const step = nextDueStep(contact, steps, now);
    if (!step) continue;

    let delivered = false;

    if (emailReady && contact.email) {
      try {
        const mail = buildStepEmail(step, links);
        if (mail) {
          await sendEmailViaResend({
            to: contact.email,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
          });
          emailsSent++;
          delivered = true;
        }
      } catch (err) {
        errors.push(`email ${contact.email}: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (smsReady && contact.consentSms && contact.phone) {
      try {
        await sendSms({ to: contact.phone, body: step.sms });
        smsSent++;
        delivered = true;
      } catch (err) {
        errors.push(`sms ${contact.phone}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Advance even if neither channel was configured, so we don't get stuck
    // re-trying the same step forever once delivery becomes available.
    if (delivered || (!emailReady && !smsReady)) {
      await advanceSeqStep(contact.id, step.index);
      advanced++;
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  return { ran: true, emailsSent, smsSent, advanced, contacts: contacts.length, errors };
}

export default async () => {
  try {
    const result = await runSequence();
    console.log("[sequence-tick]", JSON.stringify(result));
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sequence-tick]", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
