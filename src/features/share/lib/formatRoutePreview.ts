import type { PublicRoutePreview, PublicRouteStop } from "@/features/share/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRouteId(value: string | undefined | null): value is string {
  return Boolean(value && UUID_RE.test(value.trim()));
}

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

export function formatDifficulty(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/_/g, " ");
}

type PlacePhotoRow = { url?: string | null; position?: number | null };
type PlaceRow = {
  id?: string | null;
  name?: string | null;
  category?: string | null;
  state?: string | null;
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
      return {
        position: rp.position ?? 0,
        placeId: place.id,
        name: place.name,
        category: place.category ?? null,
        photoUrl: firstPhotoUrl(place.place_photos),
      } satisfies PublicRouteStop;
    })
    .filter((stop): stop is PublicRouteStop => Boolean(stop));

  const coverUrl = stops.find((s) => s.photoUrl)?.photoUrl ?? null;

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    category: row.category ?? null,
    difficulty: row.difficulty ?? null,
    distanceM: Number(row.distance_m ?? 0),
    estimatedDuration: row.estimated_duration ?? null,
    averageRating: Number(row.average_rating ?? 0),
    totalRatings: Number(row.total_ratings ?? 0),
    coverUrl,
    stops,
  };
}
