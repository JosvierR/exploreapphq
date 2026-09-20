import {
  mapRoutePreviewRow,
  type RawPublicRouteRow,
} from "../lib/formatRoutePreview";
import { isRouteSlug, normalizeRouteRef, resolveRouteUuid, routeNameToSlug } from "../lib/routeShortCode";
import type { PublicRoutePreviewResult } from "../types";
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabaseClient";

const ROUTE_PREVIEW_SELECT = `
  id,
  name,
  description,
  category,
  difficulty,
  distance_m,
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

/**
 * Public anon read of a published + public route with ordered stops + coords.
 * `ref` may be a UUID, compact hex, short base32 code, or name slug.
 */
export async function fetchPublicRoutePreview(ref: string): Promise<PublicRoutePreviewResult> {
  const value = normalizeRouteRef(ref);
  if (!value) return { status: "not_found" };

  if (!isSupabaseBrowserConfigured()) {
    return { status: "unconfigured" };
  }

  try {
    const supabase = getSupabaseBrowserClient();
    const routeId = resolveRouteUuid(value);
    if (routeId) return fetchRouteById(supabase, routeId);
    if (isRouteSlug(value)) return fetchRouteBySlug(supabase, value.toLowerCase());
    return { status: "not_found" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load route";
    return { status: "error", message };
  }
}
