import {
  isRouteId,
  mapRoutePreviewRow,
  type RawPublicRouteRow,
} from "@/features/share/lib/formatRoutePreview";
import type { PublicRoutePreviewResult } from "@/features/share/types";
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
      place_photos ( url, position )
    )
  )
`;

/**
 * Public anon read of a published + public route with ordered stops.
 * Relies on RLS: routes_select_public + place_photos_select for published places.
 */
export async function fetchPublicRoutePreview(routeId: string): Promise<PublicRoutePreviewResult> {
  if (!isRouteId(routeId)) {
    return { status: "not_found" };
  }

  if (!isSupabaseBrowserConfigured()) {
    return { status: "unconfigured" };
  }

  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("routes")
      .select(ROUTE_PREVIEW_SELECT)
      .eq("id", routeId.trim())
      .eq("state", "published")
      .eq("is_public", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      return { status: "error", message: error.message };
    }
    if (!data) {
      return { status: "not_found" };
    }

    return { status: "ok", preview: mapRoutePreviewRow(data as unknown as RawPublicRouteRow) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load route";
    return { status: "error", message };
  }
}
