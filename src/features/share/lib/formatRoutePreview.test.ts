import assert from "node:assert/strict";
import {
  budgetLevelSymbol,
  estimateRouteBudgetLevel,
  formatDifficulty,
  formatDistanceMeters,
  formatEstimatedDuration,
  mapRoutePreviewRow,
  resolveDisplayDistanceM,
} from "./formatRoutePreview";
import { parsePostgisPoint } from "./parsePostgisPoint";
import {
  buildShortRoutePath,
  resolveRouteUuid,
  routeNameToSlug,
  shortCodeToUuid,
  uuidToShortCode,
} from "./routeShortCode";

const UUID = "a2000000-0000-4000-8002-000000000003";

assert.equal(formatDistanceMeters(450), "450 m");
assert.equal(formatDistanceMeters(1500), "1.5 km");
assert.equal(formatEstimatedDuration("01:30:00"), "1h 30m");
assert.equal(formatDifficulty("easy_walk"), "easy walk");

assert.equal(routeNameToSlug("Playas de Bávaro"), "playas-de-bavaro");
assert.equal(buildShortRoutePath({ id: UUID, name: "Playas de Bávaro" }), "/r/playas-de-bavaro");

const short = uuidToShortCode(UUID);
assert.equal(shortCodeToUuid(short), UUID);
assert.equal(resolveRouteUuid(UUID), UUID);
assert.equal(resolveRouteUuid(UUID.replace(/-/g, "")), UUID);
assert.equal(resolveRouteUuid(short), UUID);
assert.equal(resolveRouteUuid("playas-de-bavaro"), null);

assert.equal(estimateRouteBudgetLevel("beach", ["beach", "nature"]), "free");
assert.equal(estimateRouteBudgetLevel("gastronomy", ["gastronomy", "nightlife"]), "high");
assert.equal(budgetLevelSymbol("mid"), "$$");

const ewkb = "0101000020E61000003611ECAEA21951C0E3BFE556ADAB3240";
const point = parsePostgisPoint(ewkb);
assert.ok(point);
assert.ok(Math.abs(point!.lng - -68.4015) < 0.01, `lng ${point!.lng}`);
assert.ok(Math.abs(point!.lat - 18.6706) < 0.01, `lat ${point!.lat}`);

const preview = mapRoutePreviewRow({
  id: UUID,
  name: "Playas de Bávaro",
  description: "Beach hop",
  category: "beach",
  difficulty: "easy",
  distance_m: 8200,
  elevation_gain: 12,
  estimated_duration: "02:15:00",
  average_rating: 4.8,
  total_ratings: 20,
  route_places: [
    {
      position: 0,
      places: {
        id: "p1",
        name: "Playa Bibijagua",
        category: "beach",
        state: "published",
        location: ewkb,
        place_photos: [{ url: "https://cdn.example/a.jpg", position: 0 }],
      },
    },
    {
      position: 1,
      places: {
        id: "p2",
        name: "Second beach",
        category: "beach",
        state: "published",
        location: { type: "Point", coordinates: [-68.4, 18.68] },
        place_photos: [],
      },
    },
  ],
});

assert.equal(preview.slug, "playas-de-bavaro");
assert.equal(preview.budgetLevel, "free");
assert.equal(preview.elevationGain, 12);
assert.equal(preview.photoStrip[0], "https://cdn.example/a.jpg");
assert.equal(preview.stops.length, 2);
assert.ok(preview.stops[0]?.lat != null);
assert.ok(preview.stops[0]?.lng != null);
assert.equal(preview.stops[1]?.lat, 18.68);

assert.equal(
  resolveDisplayDistanceM(0, [
    { lat: 18.67, lng: -68.4 },
    { lat: 18.68, lng: -68.39 },
  ])! > 1000,
  true,
);
assert.equal(resolveDisplayDistanceM(2500, [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }]), 2500);

console.log("formatRoutePreview.test.ts: ok");
console.log("share link:", buildShortRoutePath({ id: UUID, name: "Playas de Bávaro" }));
