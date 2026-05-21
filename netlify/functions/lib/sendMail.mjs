import { buildAppLaunchEmail } from "../../../server/emails/appLaunch.mjs";
import { sendEmailViaResend } from "./resendSend.mjs";

export function emailLinksFromEnv() {
  const siteUrl = process.env.SITE_URL || "https://example.com";
  return {
    siteUrl,
    appleUrl: process.env.APP_STORE_URL || "",
    playUrl: process.env.PLAY_STORE_URL || "",
    logoUrl: `${siteUrl.replace(/\/$/, "")}/icon-192.png`,
  };
}

export async function sendLaunchEmail(to) {
  const { subject, html, text } = buildAppLaunchEmail(to, emailLinksFromEnv());
  const result = await sendEmailViaResend({ to, subject, html, text });
  return result;
}

export async function sendLaunchBulk(emails, onSent) {
  const { assertResendProductionReady } = await import("./resendSend.mjs");
  assertResendProductionReady();

  const sent = [];
  const failed = [];

  for (const email of emails) {
    try {
      await sendLaunchEmail(email);
      await onSent(email);
      sent.push(email);
    } catch (err) {
      failed.push({
        email,
        error: err instanceof Error ? err.message : "Send failed",
      });
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  return { sent, failed };
}
