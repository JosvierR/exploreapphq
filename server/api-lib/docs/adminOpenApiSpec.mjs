import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { getOpenApiAdminYamlPath } from "./apiRouteInventory.mjs";

/** @type {{ spec: Record<string, unknown>, json: string } | null} */
let cache = null;

/**
 * Load hand-authored Admin HTTP OpenAPI 3.1 (`openapi.admin.yaml`).
 * @returns {{ spec: Record<string, unknown>, json: string }}
 */
export function loadAdminOpenApiSpec() {
  if (cache) return cache;
  const yamlText = readFileSync(getOpenApiAdminYamlPath(), "utf8");
  const spec = /** @type {Record<string, unknown>} */ (parseYaml(yamlText));
  if (!spec || typeof spec !== "object" || typeof spec.openapi !== "string") {
    throw Object.assign(new Error("openapi.admin.yaml is missing or invalid"), {
      status: 500,
      code: "admin_openapi_invalid",
    });
  }
  if (!String(spec.openapi).startsWith("3.")) {
    throw Object.assign(new Error(`Expected OpenAPI 3.x, got ${spec.openapi}`), {
      status: 500,
      code: "admin_openapi_invalid",
    });
  }
  const json = JSON.stringify(spec);
  cache = { spec, json };
  return cache;
}

/** Test helper */
export function clearAdminOpenApiCache() {
  cache = null;
}
