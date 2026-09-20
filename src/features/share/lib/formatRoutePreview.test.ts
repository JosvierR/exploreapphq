import assert from "node:assert/strict";
import {
  formatDifficulty,
  formatDistanceMeters,
  formatEstimatedDuration,
  isRouteId,
  mapRoutePreviewRow,
} from "./formatRoutePreview";

assert.equal(isRouteId("550e8400-e29b-41d4-a716-446655440000"), true);
assert.equal(isRouteId("not-a-uuid"), false);
assert.equal(isRouteId(""), false);
assert.equal(isRouteId(null), false);

assert.equal(formatDistanceMeters(450), "450 m");
assert.equal(formatDistanceMeters(1500), "1.5 km");
assert.equal(formatDistanceMeters(12500), "13 km");
assert.equal(formatDistanceMeters(-1), null);
assert.equal(formatDistanceMeters(undefined), null);

assert.equal(formatEstimatedDuration("01:30:00"), "1h 30m");
assert.equal(formatEstimatedDuration("00:45:00"), "45m");
assert.equal(formatEstimatedDuration("02:00:00"), "2h");
assert.equal(formatEstimatedDuration("1 day 01:00:00"), "25h");
assert.equal(formatEstimatedDuration(""), null);
assert.equal(formatEstimatedDuration(null), null);

assert.equal(formatDifficulty("easy_walk"), "easy walk");
assert.equal(formatDifficulty(null), null);

const preview = mapRoutePreviewRow({
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Old San Juan sunset",
  description: "Walk the walls at golden hour.",
  category: "urban",
  difficulty: "easy",
  distance_m: 3200,
  estimated_duration: "01:20:00",
  average_rating: 4.5,
  total_ratings: 12,
  route_places: [
    {
      position: 1,
      places: {
        id: "p2",
        name: "La Fortaleza",
        category: "landmark",
        state: "published",
        place_photos: [{ url: "https://cdn.example/fort.jpg", position: 0 }],
      },
    },
    {
      position: 0,
      places: {
        id: "p1",
        name: "El Morro",
        category: "landmark",
        state: "published",
        place_photos: [
          { url: "https://cdn.example/morro-b.jpg", position: 1 },
          { url: "https://cdn.example/morro-a.jpg", position: 0 },
        ],
      },
    },
    {
      position: 2,
      places: {
        id: "p3",
        name: "Draft spot",
        category: "cafe",
        state: "draft",
        place_photos: [{ url: "https://cdn.example/draft.jpg", position: 0 }],
      },
    },
  ],
});

assert.equal(preview.name, "Old San Juan sunset");
assert.equal(preview.stops.length, 2);
assert.equal(preview.stops[0]?.name, "El Morro");
assert.equal(preview.stops[0]?.photoUrl, "https://cdn.example/morro-a.jpg");
assert.equal(preview.stops[1]?.name, "La Fortaleza");
assert.equal(preview.coverUrl, "https://cdn.example/morro-a.jpg");

const empty = mapRoutePreviewRow({
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "Empty route",
  route_places: [],
});
assert.equal(empty.coverUrl, null);
assert.equal(empty.stops.length, 0);

console.log("formatRoutePreview.test.ts: ok");
