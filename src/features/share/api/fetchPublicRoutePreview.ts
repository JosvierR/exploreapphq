import { apiUrl } from "@/lib/api";
import {
  estimateRouteBudgetLevel,
  mapRoutePreviewRow,
  type RawPublicRouteRow,
} from "../lib/formatRoutePreview";
import {
  isRouteSlug,
  normalizeRouteRef,
  resolveRouteUuid,
  routeNameToSlug,
  uuidToShortCode,
} from "../lib/routeShortCode";
import type { PublicRoutePreview, PublicRoutePreviewResult } from "../types";
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabaseClient";

const CACHE_PREFIX = "explore-route-preview:";

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

type ApiPreviewPayload = {
  ok?: boolean;
  preview?: PublicRoutePreview;
  error?: string;
  code?: string;
};

function withDerivedFields(preview: PublicRoutePreview): PublicRoutePreview {
  return {
    ...preview,
    shortCode: preview.shortCode || uuidToShortCode(preview.id),
    budgetLevel:
      preview.budgetLevel ||
      estimateRouteBudgetLevel(
        preview.category,
        preview.stops.map((stop) => stop.category),
      ),
    photoStrip: preview.photoStrip?.length
      ? preview.photoStrip
      : preview.stops.map((s) => s.photoUrl).filter((url): url is string => Boolean(url)).slice(0, 6),
    coverUrl: preview.coverUrl || preview.photoStrip?.[0] || null,
  };
}

function readCache(ref: string): PublicRoutePreview | null {
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${ref.toLowerCase()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublicRoutePreview;
    if (!parsed?.id || !parsed?.name) return null;
    return withDerivedFields(parsed);
  } catch {
    return null;
  }
}

function writeCache(ref: string, preview: PublicRoutePreview) {
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${ref.toLowerCase()}`, JSON.stringify(preview));
    if (preview.slug) {
      sessionStorage.setItem(`${CACHE_PREFIX}${preview.slug}`, JSON.stringify(preview));
    }
    sessionStorage.setItem(`${CACHE_PREFIX}${preview.id}`, JSON.stringify(preview));
  } catch {
    /* ignore quota */
  }
}

async function fetchViaApi(ref: string): Promise<PublicRoutePreviewResult> {
  const response = await fetch(apiUrl(`/api/public/routes/${encodeURIComponent(ref)}`), {
    headers: { Accept: "application/json" },
  });
  let body: ApiPreviewPayload | null = null;
  try {
    body = (await response.json()) as ApiPreviewPayload;
  } catch {
    body = null;
  }

  if (response.status === 503 || body?.code === "unconfigured") {
    return { status: "unconfigured" };
  }
  if (response.status === 404 && body && body.ok === false) {
    return { status: "not_found" };
  }
  if (!response.ok || !body?.ok || !body.preview) {
    return { status: "error", message: body?.error || `HTTP ${response.status}` };
  }

  return { status: "ok", preview: withDerivedFields(body.preview) };
}

async function fetchRouteById(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  routeId: string,
): Promise<PublicRoutePreviewResult> {
  const { data, error } = await supabase
    .from("routes")
    .select(ROUTE_PREVIEW_SELECT)
    .eq("id", routeId)
    .eq("state", "published")
    .eq("is_public", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "not_found" };
  return { status: "ok", preview: mapRoutePreviewRow(data as unknown as RawPublicRouteRow) };
}

async function fetchRouteBySlug(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  slug: string,
): Promise<PublicRoutePreviewResult> {
  const firstToken = slug.split("-").find((part) => part.length >= 3) || slug.split("-")[0] || slug;
  const { data, error } = await supabase
    .from("routes")
    .select(ROUTE_PREVIEW_SELECT)
    .eq("state", "published")
    .eq("is_public", true)
    .is("deleted_at", null)
    .ilike("name", `%${firstToken.replace(/[%_]/g, "")}%`)
    .limit(40);

  if (error) return { status: "error", message: error.message };

  const rows = (data ?? []) as unknown as RawPublicRouteRow[];
  const exact = rows.find((row) => routeNameToSlug(row.name) === slug);
  if (!exact) return { status: "not_found" };
  return { status: "ok", preview: mapRoutePreviewRow(exact) };
}

async function fetchViaBrowserSupabase(ref: string): Promise<PublicRoutePreviewResult> {
  if (!isSupabaseBrowserConfigured()) return { status: "unconfigured" };

  const supabase = getSupabaseBrowserClient();
  const routeId = resolveRouteUuid(ref);
  if (routeId) return fetchRouteById(supabase, routeId);
  if (isRouteSlug(ref)) return fetchRouteBySlug(supabase, ref.toLowerCase());
  return { status: "not_found" };
}

/**
 * Public route preview for the share landing.
 * Prefers same-origin API (server keys), falls back to browser Supabase.
 */
export async function fetchPublicRoutePreview(ref: string): Promise<PublicRoutePreviewResult> {
  const value = normalizeRouteRef(ref);
  if (!value) return { status: "not_found" };

  const cached = readCache(value);
  if (cached) return { status: "ok", preview: cached };

  let apiResult: PublicRoutePreviewResult | null = null;
  try {
    apiResult = await fetchViaApi(value);
    if (apiResult.status === "ok") {
      writeCache(value, apiResult.preview);
      return apiResult;
    }
  } catch {
    apiResult = null;
  }

  try {
    const viaBrowser = await fetchViaBrowserSupabase(value);
    if (viaBrowser.status === "ok") {
      writeCache(value, viaBrowser.preview);
      return viaBrowser;
    }
    // Prefer a concrete API miss over a generic browser miss when both fail.
    if (apiResult?.status === "not_found") return apiResult;
    return viaBrowser;
  } catch (err) {
    if (apiResult) return apiResult;
    const message = err instanceof Error ? err.message : "Failed to load route";
    return { status: "error", message };
  }
}

/** Synchronous cache hit for first paint without interstitial flash. */
export function peekCachedRoutePreview(ref: string): PublicRoutePreview | null {
  const value = normalizeRouteRef(ref);
  if (!value) return null;
  return readCache(value);
}
