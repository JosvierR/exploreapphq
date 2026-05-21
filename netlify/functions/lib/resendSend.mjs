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
export function assertResendProductionReady() {
  const from = parseFromAddress(process.env.SMTP_FROM);
  if (isSandboxFromAddress(from.email)) {
    throw new Error(
      "Resend: add and verify domain exploreapphq.com at https://resend.com/domains — " +
        "then in Netlify set SMTP_FROM=Explore <onboarding@exploreapphq.com> and redeploy. " +
        "onboarding@resend.dev cannot deliver to Gmail for your waitlist.",
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
      reason: "Missing SMTP_PASS (Resend API key re_...) in Netlify environment variables.",
    };
  }
  if (isSandboxFromAddress(from.email)) {
    return {
      ready: false,
      from: `${from.name} <${from.email}>`,
      reason:
        "SMTP_FROM uses @resend.dev (test only). Add domain exploreapphq.com in Resend, verify DNS, then SMTP_FROM=Explore <onboarding@exploreapphq.com>.",
    };
  }
  return { ready: true, from: `${from.name} <${from.email}>` };
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
