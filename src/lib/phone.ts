/** Phone helpers shared by the waitlist form (client side). */

/** Normalize user input to E.164-ish: "+" followed by 8-15 digits. */
export function normalizePhone(raw: string, defaultCountryCode = "1"): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  // Local number without country code: prepend the default (e.g. US/CA "1").
  if (!hasPlus && digits.length === 10) {
    digits = `${defaultCountryCode}${digits}`;
  }

  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

export function isValidPhone(raw: string): boolean {
  return normalizePhone(raw) != null;
}

/** Digits-only id used as Firestore document id (no "+"). */
export function phoneDocId(e164: string): string {
  return e164.replace(/\D/g, "");
}

/** Pretty display, e.g. +1 809 555 1234 (best-effort). */
export function formatPhoneDisplay(e164: string | null | undefined): string {
  if (!e164) return "";
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return e164;
}
