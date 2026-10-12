import assert from "node:assert/strict";
import { leafletBasemapForKey } from "./leafletBasemap";

const withKey = leafletBasemapForKey("test-key-123");
assert.ok(withKey.url.includes("api.maptiler.com/maps/streets-v4/"));
assert.ok(withKey.url.includes("key=test-key-123"));
assert.equal(withKey.maxZoom, 22);

const withoutKey = leafletBasemapForKey("");
assert.ok(withoutKey.url.includes("openstreetmap.org"));
assert.equal(withoutKey.maxZoom, 19);

const nullKey = leafletBasemapForKey(undefined);
assert.ok(nullKey.url.includes("openstreetmap.org"));

console.log("leafletBasemap ok");
