import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { clearEdgeOpenApiCache, edgeOpenApiPinStatus, loadEdgeOpenApiSpec } from "./edgeOpenApiSpec.mjs";

const here = dirname(fileURLToPath(import.meta.url));

test("synced Edge OpenAPI documents upload + webhook and exposes commit pin", () => {
  clearEdgeOpenApiCache();
  const pinFile = JSON.parse(readFileSync(join(here, "edgeOpenApi.pin.json"), "utf8"));
  assert.ok(pinFile.commit, "edgeOpenApi.pin.json must include commit");

  const { spec, pin } = loadEdgeOpenApiSpec();
  assert.equal(spec.openapi, "3.1.0");
  assert.ok(spec.paths?.["/generate-upload-url"]?.post);
  assert.ok(spec.paths?.["/cloudflare-stream-webhook"]?.post);
  assert.equal(pin.commit, pinFile.commit);
  assert.equal(spec.info?.["x-explore-source-commit"], pinFile.commit);
  assert.match(String(spec.info?.description || ""), /Synced from Explore-V2/);

  const status = edgeOpenApiPinStatus();
  assert.equal(status.edge_openapi_pinned, true);
  assert.equal(status.edge_openapi_commit, pinFile.commit);
});
