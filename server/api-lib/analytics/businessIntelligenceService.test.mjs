import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveBusinessIntelligenceParams,
} from "./businessIntelligenceService.mjs";

test("resolveBusinessIntelligenceParams accepts neighborhood + 12m", () => {
  const request = {
    url: "https://example.test/api/admin/business/dashboard?range=12m&country=DO&region=Santiago&city=Santiago&neighborhood=Centro&compare=previous",
  };
  const params = resolveBusinessIntelligenceParams(request);
  assert.equal(params.preset, "12m");
  assert.equal(params.country, "DO");
  assert.equal(params.region, "Santiago");
  assert.equal(params.city, "Santiago");
  assert.equal(params.neighborhood, "Centro");
  assert.equal(params.compare, "previous");
});

test("resolveBusinessIntelligenceParams rejects oversized custom ranges", () => {
  const request = {
    url: "https://example.test/api/admin/business/dashboard?date_from=2024-01-01&date_to=2026-01-01",
  };
  assert.throws(() => resolveBusinessIntelligenceParams(request), /cannot exceed/i);
});
