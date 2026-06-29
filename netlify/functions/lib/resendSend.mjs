/**
 * Resend HTTP API — production requires a verified domain (not @resend.dev).
 */

export function parseFromAddress(raw) {
  const value = raw || "Explore <onboarding@resend.dev>";
  const match = value.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: "Explore", email: value.trim() };
}

export function isSandboxFromAddress(fromEmail) {
  return fromEmail.endsWith("@resend.dev");
}

/** Call before bulk / production sends */
function mailDomainFromEnv() {
  const from = parseFromAddress(process.env.SMTP_FROM);
  const host = from.email.split("@")[1];
  if (host && !isSandboxFromAddress(from.email)) return host;
  try {
    return new URL(process.env.SITE_URL || "").hostname.replace(/^www\./, "");
  } catch {
    return "your-domain.com";
  }
}

export function assertResendProductionReady() {
  const from = parseFromAddress(process.env.SMTP_FROM);
  if (isSandboxFromAddress(from.email)) {
    const d = mailDomainFromEnv();
    throw new Error(
      `Resend: verify ${d} at https://resend.com/domains — set SMTP_FROM=Explore <onboarding@${d}> in Vercel and redeploy. onboarding@resend.dev cannot email your waitlist.`,
    );
  }
}

export function getResendEmailStatus() {
  const apiKey = process.env.SMTP_PASS;
  const from = parseFromAddress(process.env.SMTP_FROM);
  if (!apiKey || !apiKey.startsWith("re_")) {
    return {
      ready: false,
      from: `${from.name} <${from.email}>`,
      reason: "Missing SMTP_PASS (Resend API key re_...) in Vercel environment variables.",
    };
  }
  const mailDomain = mailDomainFromEnv();
  if (isSandboxFromAddress(from.email)) {
    return {
      ready: false,
      from: `${from.name} <${from.email}>`,
      mailDomain,
      reason: `SMTP_FROM uses @resend.dev (test only). Verify ${mailDomain} in Resend (Google DNS), then SMTP_FROM=Explore <onboarding@${mailDomain}>.`,
    };
  }
  return { ready: true, from: `${from.name} <${from.email}>`, mailDomain };
}

/** @returns {{ id: string }} */
export async function sendEmailViaResend({ to, subject, html, text, allowSandbox = false }) {
  const apiKey = process.env.SMTP_PASS;
  if (!apiKey || !apiKey.startsWith("re_")) {
    throw new Error("SMTP_PASS must be your Resend API key (re_...).");
  }

  const from = parseFromAddress(process.env.SMTP_FROM);
  if (!allowSandbox) {
    assertResendProductionReady();
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${from.name} <${from.email}>`,
      to: [to],
      subject,
      html,
      text: text || undefined,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data?.message ||
      data?.error?.message ||
      (typeof data?.error === "string" ? data.error : null) ||
      `Resend rejected the email (${res.status}).`;
    throw new Error(msg);
  }

  return { id: data.id };
}
