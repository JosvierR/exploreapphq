import assert from "node:assert/strict";
import test from "node:test";
import { buildMinimalOpenApiSpec, isOpenApiSurface, OPENAPI_SURFACES } from "./minimalSpecs.mjs";
import { isOpenApiDocsRoute } from "./docsRouter.mjs";

test("OPENAPI_SURFACES covers the three ticket surfaces", () => {
  assert.deepEqual([...OPENAPI_SURFACES], ["postgrest", "edge", "admin"]);
});

for (const surface of OPENAPI_SURFACES) {
  test(`minimal OpenAPI 3.1 skeleton is valid for ${surface}`, () => {
    assert.equal(isOpenApiSurface(surface), true);
    const spec = buildMinimalOpenApiSpec(surface);
    assert.equal(spec.openapi, "3.1.0");
    assert.equal(typeof spec.info?.title, "string");
    assert.equal(spec.info?.version, "0.0.0");
    assert.ok(spec.paths && typeof spec.paths === "object");
    assert.equal(Object.keys(spec.paths).length, 0);
  });
}

test("isOpenApiDocsRoute matches only known surfaces", () => {
  assert.equal(isOpenApiDocsRoute("admin/openapi/postgrest"), true);
  assert.equal(isOpenApiDocsRoute("admin/openapi/edge"), true);
  assert.equal(isOpenApiDocsRoute("admin/openapi/admin"), true);
  assert.equal(isOpenApiDocsRoute("admin/openapi/other"), false);
  assert.equal(isOpenApiDocsRoute("admin/openapi"), false);
});
