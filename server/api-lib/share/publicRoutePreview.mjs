import { createClient } from "@supabase/supabase-js";

const ROUTE_PREVIEW_SELECT = `
  id,
  name,
  description,
  category,
  difficulty,
  distance_m,
  elevation_gain,
  estimated_duration,
  average_rating,
  total_ratings,
  route_places (
    position,
    places (
      id,
      name,
      category,
      state,
      location,
      place_photos ( url, position )
    )
  )
`;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMPACT_HEX_RE = /^[0-9a-f]{32}$/i;
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";
const BASE = BigInt(ALPHABET.length);

function getSupabaseUrl() {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
}

function getPublishableKey() {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim();
}

function createAnonClient() {
  const url = getSupabaseUrl();
  const key = getPublishableKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function routeNameToSlug(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function shortCodeToUuid(ref) {
  const value = String(ref || "").trim();
  if (UUID_RE.test(value)) return value.toLowerCase();
  if (COMPACT_HEX_RE.test(value)) {
    const h = value.toLowerCase();
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  if (!new RegExp(`^[${ALPHABET}]{8,28}$`, "i").test(value)) return null;
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

function unwrapPlace(places) {
  if (!places) return null;
  return Array.isArray(places) ? places[0] ?? null : places;
}

function parsePoint(raw) {
  if (raw == null) return null;
  if (typeof raw === "object") {
    if (raw.type === "Point" && Array.isArray(raw.coordinates)) {
      const lng = Number(raw.coordinates[0]);
      const lat = Number(raw.coordinates[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    return null;
  }
  if (typeof raw !== "string" || !/^[0-9a-f]+$/i.test(raw) || raw.length < 42) return null;
  try {
    const bytes = new Uint8Array(raw.length / 2);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(raw.slice(i * 2, i * 2 + 2), 16);
    const view = new DataView(bytes.buffer);
    let offset = 0;
    const le = view.getUint8(offset) === 1;
    offset += 1;
    let typeWord = view.getUint32(offset, le);
    offset += 4;
    const hasSrid = (typeWord & 0x20000000) !== 0;
    typeWord &= ~0xe0000000;
    if (typeWord !== 1) return null;
    if (hasSrid) offset += 4;
    const x = view.getFloat64(offset, le);
    offset += 8;
    const y = view.getFloat64(offset, le);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { lat: y, lng: x };
  } catch {
    return null;
  }
}

function firstPhoto(photos) {
  if (!Array.isArray(photos) || !photos.length) return null;
  const sorted = [...photos].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const url = sorted.find((p) => typeof p.url === "string" && p.url.trim())?.url;
  return url?.trim() || null;
}

function uuidToShortCode(uuid) {
  const hex = String(uuid || "").replace(/-/g, "").toLowerCase();
  if (!COMPACT_HEX_RE.test(hex)) return "";
  let n = BigInt(`0x${hex}`);
  if (n === 0n) return ALPHABET[0];
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % BASE)] + out;
    n /= BASE;
  }
  return out;
}

function estimateBudgetLevel(routeCategory, stopCategories) {
  const weights = {
    hiking: 0,
    nature: 0,
    beach: 0,
    camping: 0,
    cycling: 0,
    urban: 1,
    culture: 1,
    history: 1,
    family: 1,
    events: 1,
    other: 1,
    wellness: 2,
    adventure: 2,
    nightlife: 3,
    gastronomy: 3,
    shopping: 3,
  };
  const scores = [];
  if (routeCategory) scores.push(weights[routeCategory] ?? 1);
  for (const cat of stopCategories) {
    if (cat) scores.push(weights[cat] ?? 1);
  }
  if (!scores.length) return "low";
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg < 0.6) return "free";
  if (avg < 1.4) return "low";
  if (avg < 2.3) return "mid";
  return "high";
}

function mapRow(row) {
  const stops = (row.route_places ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((rp) => {
      const place = unwrapPlace(rp.places);
      if (!place?.id || !place.name) return null;
      if (place.state && place.state !== "published") return null;
      const point = parsePoint(place.location);
      return {
        position: rp.position ?? 0,
        placeId: place.id,
        name: place.name,
        category: place.category ?? null,
        photoUrl: firstPhoto(place.place_photos),
        lat: point?.lat ?? null,
        lng: point?.lng ?? null,
      };
    })
    .filter(Boolean);

  const photoStrip = stops.map((s) => s.photoUrl).filter(Boolean).slice(0, 6);

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    category: row.category ?? null,
    difficulty: row.difficulty ?? null,
    distanceM: Number(row.distance_m ?? 0),
    elevationGain: Number(row.elevation_gain ?? 0),
    estimatedDuration: row.estimated_duration ?? null,
    averageRating: Number(row.average_rating ?? 0),
    totalRatings: Number(row.total_ratings ?? 0),
    coverUrl: photoStrip[0] ?? null,
    shortCode: uuidToShortCode(row.id),
    slug: routeNameToSlug(row.name),
    budgetLevel: estimateBudgetLevel(
      row.category,
      stops.map((s) => s.category),
    ),
    photoStrip,
    stops,
  };
}

async function fetchById(supabase, routeId) {
  const { data, error } = await supabase
    .from("routes")
    .select(ROUTE_PREVIEW_SELECT)
    .eq("id", routeId)
    .eq("state", "published")
    .eq("is_public", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, status: 502, error: error.message };
  if (!data) return { ok: false, status: 404, error: "Route not found." };
  return { ok: true, preview: mapRow(data) };
}

async function fetchBySlug(supabase, slug) {
  const firstToken = slug.split("-").find((part) => part.length >= 3) || slug.split("-")[0] || slug;
  const { data, error } = await supabase
    .from("routes")
    .select(ROUTE_PREVIEW_SELECT)
    .eq("state", "published")
    .eq("is_public", true)
    .is("deleted_at", null)
    .ilike("name", `%${firstToken.replace(/[%_]/g, "")}%`)
    .limit(40);
  if (error) return { ok: false, status: 502, error: error.message };
  const exact = (data ?? []).find((row) => routeNameToSlug(row.name) === slug);
  if (!exact) return { ok: false, status: 404, error: "Route not found." };
  return { ok: true, preview: mapRow(exact) };
}

/**
 * Public route preview for share landing pages.
 * Uses anon/publishable key + RLS (published + is_public).
 */
export async function getPublicRoutePreview(ref) {
  const value = String(ref || "").trim();
  if (!value) return { ok: false, status: 404, error: "Missing route ref." };

  const supabase = createAnonClient();
  if (!supabase) {
    return { ok: false, status: 503, error: "Share preview is not configured.", code: "unconfigured" };
  }

  const routeId = shortCodeToUuid(value);
  if (routeId) return fetchById(supabase, routeId);

  const slug = value.toLowerCase();
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2) {
    return fetchBySlug(supabase, slug);
  }

  return { ok: false, status: 404, error: "Route not found." };
}
