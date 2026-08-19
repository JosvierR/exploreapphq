import assert from "node:assert/strict";
import test from "node:test";
import {
  OPENAPI_STATIC_SURFACES,
  buildPostgrestLintSpec,
  lintOpenApiSurfaces,
  redoclyArguments,
} from "./lint-openapi-surfaces.mjs";

test("OpenAPI lint inventory includes all three surfaces", async () => {
  assert.deepEqual(
    OPENAPI_STATIC_SURFACES.map((surface) => surface.name),
    ["Admin HTTP", "Edge Functions"],
  );
  const postgrest = await buildPostgrestLintSpec();
  assert.equal(postgrest.openapi, "3.1.0");
  assert.equal(postgrest.servers[0].url, "https://ci.supabase.invalid/rest/v1");
  const args = redoclyArguments("/tmp/postgrest.json");
  assert.equal(args.filter((value) => /openapi\.(admin|edge)|postgrest\.json/.test(value)).length, 3);
});

test("OpenAPI lint propagates a Redocly failure", async () => {
  const status = await lintOpenApiSurfaces({
    run(_command, args) {
      assert.equal(args[0], "lint");
      return { status: 1 };
    },
  });
  assert.equal(status, 1);
});
