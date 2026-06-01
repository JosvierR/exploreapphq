/** Shared contact normalization for Netlify functions (phone-first waitlist). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePhone(raw, defaultCountryCode = "1") {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (!hasPlus && digits.length === 10) {
    digits = `${defaultCountryCode}${digits}`;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

export function phoneDocId(e164) {
  return e164.replace(/\D/g, "");
}

export function normalizeEmail(raw) {
  if (!raw || typeof raw !== "string") return "";
  const email = raw.trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : "";
}

/**
 * Build a normalized contact from request body.
 * Phone is primary; email optional. Returns { ok, contact, error }.
 */
export function buildContact(body) {
  const phone = normalizePhone(body?.phone);
  const email = normalizeEmail(body?.email);

  if (!phone) {
    // Allow legacy email-only signups so nothing breaks.
    if (email) {
      return { ok: true, contact: { id: email, phone: "", email } };
    }
    return { ok: false, error: "A valid phone number is required." };
  }

  return { ok: true, contact: { id: phoneDocId(phone), phone, email } };
}
