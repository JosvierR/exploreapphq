import nodemailer from "nodemailer";
import { config } from "./config.js";
import { buildAppLaunchEmail, buildWaitlistWelcomeEmail } from "./emails/templates.js";

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
});

function emailLinks() {
  return {
    siteUrl: config.siteUrl,
    appleUrl: config.store.apple,
    playUrl: config.store.play,
    logoUrl: `${config.siteUrl}/icon-192.png`,
  };
}

export async function sendWaitlistEmail(email: string) {
  const { subject, html, text } = buildWaitlistWelcomeEmail(email, emailLinks());

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject,
    html,
    text,
  });
}

export async function sendAppLaunchEmail(email: string) {
  const { subject, html, text } = buildAppLaunchEmail(email, emailLinks());

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject,
    html,
    text,
  });
}

export type BulkSendResult = {
  sent: string[];
  failed: { email: string; error: string }[];
  skipped: string[];
};

/** Send launch email to many addresses; marks successful sends in DB via callback */
export async function sendAppLaunchBulk(
  emails: string[],
  onSent: (email: string) => void,
): Promise<BulkSendResult> {
  const result: BulkSendResult = { sent: [], failed: [], skipped: [] };

  for (const email of emails) {
    try {
      await sendAppLaunchEmail(email);
      onSent(email);
      result.sent.push(email);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      result.failed.push({ email, error: message });
    }
    // Gentle throttle for local SMTP / provider limits
    await new Promise((r) => setTimeout(r, 150));
  }

  return result;
}
