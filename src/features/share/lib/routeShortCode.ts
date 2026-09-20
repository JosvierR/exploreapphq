/** Crockford-ish base32 without ambiguous chars — URL-safe machine refs. */
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";
const BASE = BigInt(ALPHABET.length);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMPACT_HEX_RE = /^[0-9a-f]{32}$/i;
const SHORT_RE = new RegExp(`^[${ALPHABET}]{8,28}$`, "i");

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

export function isUuid(value: string | undefined | null): boolean {
  return Boolean(value && UUID_RE.test(value.trim()));
}

export function normalizeRouteRef(raw: string | undefined | null): string {
  return (raw ?? "").trim();
}

export function routeNameToSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function isRouteSlug(value: string): boolean {
  const v = value.trim();
  return v.length >= 2 && v.length <= 64 && SLUG_RE.test(v) && !isUuid(v) && !COMPACT_HEX_RE.test(v);
}

/** UUID → compact machine code (~22 chars). Prefer slugs for sharing. */
export function uuidToShortCode(uuid: string): string {
  const hex = uuid.replace(/-/g, "").toLowerCase();
  if (!COMPACT_HEX_RE.test(hex)) {
    throw new Error("Invalid UUID for short code");
  }
  let n = BigInt(`0x${hex}`);
  if (n === 0n) return ALPHABET[0];
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % BASE)] + out;
    n /= BASE;
  }
  return out;
}

/** Short code, compact hex, or UUID → UUID. Returns null for slugs / unknown. */
export function shortCodeToUuid(ref: string): string | null {
  const value = ref.trim();
  if (isUuid(value)) return value.toLowerCase();
  if (COMPACT_HEX_RE.test(value)) {
    const h = value.toLowerCase();
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  if (!SHORT_RE.test(value)) return null;

  let n = 0n;
  for (const ch of value.toLowerCase()) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) return null;
    n = n * BASE + BigInt(idx);
  }
  const hex = n.toString(16).padStart(32, "0");
  if (hex.length !== 32) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Resolve machine refs (uuid / compact / base32) to a UUID. Slugs return null. */
export function resolveRouteUuid(ref: string | undefined | null): string | null {
  const value = normalizeRouteRef(ref);
  if (!value) return null;
  return shortCodeToUuid(value);
}

/** Public share path: human slug when possible. */
export function buildShortRoutePath(route: { id: string; name: string }): string {
  const slug = routeNameToSlug(route.name);
  if (slug.length >= 2) return `/r/${slug}`;
  return `/r/${uuidToShortCode(route.id)}`;
}
