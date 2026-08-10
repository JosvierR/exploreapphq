import assert from "node:assert/strict";
import test from "node:test";
import { parse as parseYaml } from "yaml";
import { readFileSync } from "node:fs";
import {
  EXPRESS_ONLY_API_PATHS,
  extractExpressApiPaths,
  extractOpenApiPaths,
  extractRouterApiPaths,
  getOpenApiAdminYamlPath,
} from "./apiRouteInventory.mjs";

test("openapi.admin.yaml covers 100% of router.mjs routes", () => {
  const yamlText = readFileSync(getOpenApiAdminYamlPath(), "utf8");
  const doc = parseYaml(yamlText);
  const specPaths = new Set(extractOpenApiPaths(doc));
  const routerPaths = extractRouterApiPaths();

  assert.ok(routerPaths.length >= 35, `expected ~35+ router paths, got ${routerPaths.length}`);
  assert.equal(doc.openapi, "3.1.0");

  const missing = routerPaths.filter((path) => !specPaths.has(path));
  assert.deepEqual(
    missing,
    [],
    `Routes in router.mjs missing from openapi.admin.yaml:\n${missing.join("\n")}`,
  );
});

test("router.mjs and server/index.ts stay in parity (shared /api surface)", () => {
  const routerPaths = new Set(expressShared(extractRouterApiPaths()));
  const expressPaths = new Set(expressShared(extractExpressApiPaths()));

  const missingInExpress = [...routerPaths].filter((path) => !expressPaths.has(path)).sort();
  const missingInRouter = [...expressPaths].filter((path) => !routerPaths.has(path)).sort();

  assert.deepEqual(
    missingInExpress,
    [],
    `Routes in router.mjs missing from server/index.ts:\n${missingInExpress.join("\n")}`,
  );
  assert.deepEqual(
    missingInRouter,
    [],
    `Shared Express routes missing from router.mjs:\n${missingInRouter.join("\n")}`,
  );
});

test("Express-only local routes are explicitly allowlisted", () => {
  const expressPaths = extractExpressApiPaths();
  const routerPaths = new Set(extractRouterApiPaths());
  const extras = expressPaths.filter((path) => !routerPaths.has(path)).sort();
  assert.deepEqual(extras, [...EXPRESS_ONLY_API_PATHS].sort());
});

test("POST /api/events documents the analytics batch contract", () => {
  const doc = parseYaml(readFileSync(getOpenApiAdminYamlPath(), "utf8"));
  const events = doc.paths?.["/api/events"]?.post;
  assert.ok(events, "POST /api/events must exist");
  assert.equal(events.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/AnalyticsEventsBatch");
  assert.ok(doc.components?.schemas?.AnalyticsEventsBatch);
  assert.ok(doc.components?.schemas?.AnalyticsEventsResponse);
});

/**
 * @param {string[]} paths
 */
function expressShared(paths) {
  const only = new Set(EXPRESS_ONLY_API_PATHS);
  return paths.filter((path) => !only.has(path));
}
