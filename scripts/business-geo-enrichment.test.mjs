import assert from "node:assert/strict";
import test from "node:test";
import { coordinateHash, normalizeNominatimResult } from "./business-geo-enrichment-lib.mjs";

test("normalizes Santiago into the country, province, and canonical city hierarchy", () => {
  const result = normalizeNominatimResult({
    osm_type: "relation",
    osm_id: 123,
    category: "boundary",
    type: "administrative",
    addresstype: "town",
    licence: "Data © OpenStreetMap contributors, ODbL 1.0",
    address: {
      country_code: "do",
      country: "Dominican Republic",
      state: "Santiago",
      "ISO3166-2-lvl4": "DO-25",
      city: "Santiago de los Caballeros",
      town: "San Francisco de Jacagua",
    },
  });
  assert.equal(result.country_code, "DO");
  assert.equal(result.admin_level_1, "Santiago");
  assert.equal(result.admin_level_1_code, "DO-25");
  assert.equal(result.locality, "Santiago de los Caballeros");
  assert.equal(result.locality_type, "city");
  assert.equal(result.confidence, 0.95);
});

test("normalizes Miami without confusing county and city", () => {
  const result = normalizeNominatimResult({
    address: {
      country_code: "us",
      country: "United States",
      state: "Florida",
      "ISO3166-2-lvl4": "US-FL",
      county: "Miami-Dade County",
      city: "Miami",
    },
  });
  assert.equal(result.country_code, "US");
  assert.equal(result.admin_level_1, "Florida");
  assert.equal(result.admin_level_2, "Miami-Dade County");
  assert.equal(result.locality, "Miami");
});

test("returns unknown rather than guessing when country is absent", () => {
  const result = normalizeNominatimResult({ address: { city: "Somewhere" } });
  assert.equal(result.status, "unknown");
  assert.equal(result.locality, null);
  assert.equal(result.confidence, 0);
});

test("coordinate cache key is deterministic at six decimal places", () => {
  assert.equal(coordinateHash(19.45117, -70.692581), coordinateHash("19.451170", "-70.692581"));
  assert.notEqual(coordinateHash(19.45117, -70.692581), coordinateHash(19.45118, -70.692581));
});

