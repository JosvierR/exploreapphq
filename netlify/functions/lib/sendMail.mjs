import nodemailer from "nodemailer";
import { buildAppLaunchEmail } from "../../../server/emails/appLaunch.mjs";

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
  const host = process.env.SMTP_HOST;
  const pass = process.env.SMTP_PASS;
  if (!host || !pass) throw new Error("SMTP is not configured.");

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: {
      user: process.env.SMTP_USER || "resend",
      pass,
    },
  });

  const { subject, html, text } = buildAppLaunchEmail(to, emailLinksFromEnv());
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "Explore <noreply@example.com>",
    to,
    subject,
    html,
    text,
  });
}

export async function sendLaunchBulk(emails, onSent) {
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
    await new Promise((r) => setTimeout(r, 200));
  }

  return { sent, failed };
}
