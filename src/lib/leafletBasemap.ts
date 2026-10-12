/**
 * Leaflet raster basemap for exploreapphq share / admin maps.
 * Prefer MapTiler (same key family as Explore mobile). OSM fallback without key.
 */

const OSM_FALLBACK = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const MAPTILER_ATTR =
  '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export type LeafletBasemap = {
  url: string;
  attribution: string;
  maxZoom: number;
};

export function leafletBasemapForKey(key: string | null | undefined): LeafletBasemap {
  const trimmed = key?.trim();
  if (trimmed) {
    // streets-v4 matches Explore mobile MAP_STYLE (streets-v4 style.json)
    return {
      url: `https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=${encodeURIComponent(trimmed)}`,
      attribution: MAPTILER_ATTR,
      maxZoom: 22,
    };
  }
  return {
    url: OSM_FALLBACK,
    attribution: OSM_ATTR,
    maxZoom: 19,
  };
}

export function resolveLeafletBasemap(): LeafletBasemap {
  return leafletBasemapForKey(import.meta.env.VITE_MAPTILER_KEY);
}
