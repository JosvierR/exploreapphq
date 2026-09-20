import type { PublicRoutePreview, PublicRouteStop, RouteBudgetLevel } from "../types";
import { parsePostgisPoint } from "./parsePostgisPoint";
import { routeNameToSlug, uuidToShortCode } from "./routeShortCode";

export function formatDistanceMeters(distanceM: number | null | undefined): string | null {
  if (distanceM == null || !Number.isFinite(distanceM) || distanceM < 0) return null;
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  const km = distanceM / 1000;
  return `${km >= 10 ? Math.round(km) : Math.round(km * 10) / 10} km`;
}

/** Postgres interval text → short label (e.g. "01:30:00" → "1h 30m"). */
export function formatEstimatedDuration(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hms = trimmed.match(/^(?:(\d+) days? )?(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/i);
  if (hms) {
    const days = Number(hms[1] || 0);
    const hours = Number(hms[2]) + days * 24;
    const minutes = Number(hms[3]);
    if (hours <= 0 && minutes <= 0) return null;
    if (hours <= 0) return `${minutes}m`;
    if (minutes <= 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }

  if (/^\d+\s*(min|mins|minutes|h|hr|hrs|hour|hours)$/i.test(trimmed)) return trimmed;
  return trimmed;
}

/** Rough walking time when DB duration is missing (~4.5 km/h). */
export function estimateDurationFromDistanceM(distanceM: number | null | undefined): string | null {
  if (distanceM == null || !Number.isFinite(distanceM) || distanceM <= 0) return null;
  const minutes = Math.max(15, Math.round((distanceM / 4500) * 60));
  if (minutes < 60) return `~${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `~${h}h ${m}m` : `~${h}h`;
}

export function formatDifficulty(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/_/g, " ");
}

export function formatElevationMeters(meters: number | null | undefined): string | null {
  if (meters == null || !Number.isFinite(meters) || meters <= 0) return null;
  return `${Math.round(meters)} m`;
}

export function formatRating(average: number, total: number): string | null {
  if (!Number.isFinite(average) || average <= 0) return null;
  const score = Math.round(average * 10) / 10;
  if (total > 0) return `${score} · ${total}`;
  return `${score}`;
}

const BUDGET_WEIGHT: Record<string, number> = {
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

/** Heuristic spend vibe from route + stop categories (no budget column in DB yet). */
export function estimateRouteBudgetLevel(
  routeCategory: string | null | undefined,
  stopCategories: Array<string | null | undefined>,
): RouteBudgetLevel {
  const scores: number[] = [];
  if (routeCategory) scores.push(BUDGET_WEIGHT[routeCategory] ?? 1);
  for (const cat of stopCategories) {
    if (cat) scores.push(BUDGET_WEIGHT[cat] ?? 1);
  }
  if (scores.length === 0) return "low";
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg < 0.6) return "free";
  if (avg < 1.4) return "low";
  if (avg < 2.3) return "mid";
  return "high";
}

export function budgetLevelSymbol(level: RouteBudgetLevel): string {
  switch (level) {
    case "free":
      return "Free";
    case "low":
      return "$";
    case "mid":
      return "$$";
    case "high":
      return "$$$";
  }
}

/** Great-circle distance in meters between two WGS84 points. */
export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Prefer DB distance; fall back to stop-to-stop path length. */
export function resolveDisplayDistanceM(
  distanceM: number | null | undefined,
  stops: Array<{ lat: number | null; lng: number | null }>,
): number | null {
  if (distanceM != null && Number.isFinite(distanceM) && distanceM > 0) return distanceM;
  const pts = stops.filter((s): s is { lat: number; lng: number } => s.lat != null && s.lng != null);
  if (pts.length < 2) return null;
  let total = 0;
  for (let i = 1; i < pts.length; i += 1) total += haversineMeters(pts[i - 1], pts[i]);
  return total > 0 ? total : null;
}

type PlacePhotoRow = { url?: string | null; position?: number | null };
type PlaceRow = {
  id?: string | null;
  name?: string | null;
  category?: string | null;
  state?: string | null;
  location?: unknown;
  place_photos?: PlacePhotoRow[] | null;
};
type RoutePlaceRow = {
  position?: number | null;
  places?: PlaceRow | PlaceRow[] | null;
};

export type RawPublicRouteRow = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  difficulty?: string | null;
  distance_m?: number | null;
  elevation_gain?: number | null;
  estimated_duration?: string | null;
  average_rating?: number | null;
  total_ratings?: number | null;
  route_places?: RoutePlaceRow[] | null;
};

function unwrapPlace(places: PlaceRow | PlaceRow[] | null | undefined): PlaceRow | null {
  if (!places) return null;
  return Array.isArray(places) ? places[0] ?? null : places;
}

function firstPhotoUrl(photos: PlacePhotoRow[] | null | undefined): string | null {
  if (!photos?.length) return null;
  const sorted = [...photos].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const url = sorted.find((p) => typeof p.url === "string" && p.url.trim())?.url;
  return url?.trim() || null;
}

export function mapRoutePreviewRow(row: RawPublicRouteRow): PublicRoutePreview {
  const stops: PublicRouteStop[] = (row.route_places ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((rp) => {
      const place = unwrapPlace(rp.places);
      if (!place?.id || !place.name) return null;
      if (place.state && place.state !== "published") return null;
      const point = parsePostgisPoint(place.location);
      return {
        position: rp.position ?? 0,
        placeId: place.id,
        name: place.name,
        category: place.category ?? null,
        photoUrl: firstPhotoUrl(place.place_photos),
        lat: point?.lat ?? null,
        lng: point?.lng ?? null,
      } satisfies PublicRouteStop;
    })
    .filter((stop): stop is PublicRouteStop => Boolean(stop));

  const photoStrip = stops.map((s) => s.photoUrl).filter((url): url is string => Boolean(url)).slice(0, 6);
  const coverUrl = photoStrip[0] ?? null;

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
    coverUrl,
    shortCode: uuidToShortCode(row.id),
    slug: routeNameToSlug(row.name),
    budgetLevel: estimateRouteBudgetLevel(
      row.category,
      stops.map((s) => s.category),
    ),
    photoStrip,
    stops,
  };
}
