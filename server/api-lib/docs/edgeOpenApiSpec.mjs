import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));

/** @type {{ spec: Record<string, unknown>, json: string, pin: Record<string, unknown> } | null} */
let cache = null;

function readPin() {
  try {
    return JSON.parse(readFileSync(join(here, "edgeOpenApi.pin.json"), "utf8"));
  } catch {
    return null;
  }
}

/**
 * Load synced Edge OpenAPI 3.1 and expose the Explore-V2 commit pin.
 * @returns {{ spec: Record<string, unknown>, json: string, pin: Record<string, unknown> }}
 */
export function loadEdgeOpenApiSpec() {
  if (cache) return cache;

  const pin = readPin();
  if (!pin?.commit) {
    throw Object.assign(
      new Error(
        "Edge OpenAPI pin missing. Run: npm run openapi:sync-edge -- --commit <sha>",
      ),
      { status: 503, code: "edge_openapi_pin_missing" },
    );
  }

  let yamlText;
  try {
    yamlText = readFileSync(join(here, "openapi.edge.yaml"), "utf8");
  } catch {
    throw Object.assign(
      new Error(
        "Edge OpenAPI file missing. Run: npm run openapi:sync-edge -- --commit <sha>",
      ),
      { status: 503, code: "edge_openapi_missing" },
    );
  }

  const spec = /** @type {Record<string, unknown>} */ (parseYaml(yamlText));
  if (!spec || typeof spec !== "object" || typeof spec.openapi !== "string") {
    throw Object.assign(new Error("openapi.edge.yaml is invalid"), {
      status: 500,
      code: "edge_openapi_invalid",
    });
  }

  const info = /** @type {Record<string, unknown>} */ (
    spec.info && typeof spec.info === "object" ? { .../** @type {object} */ (spec.info) } : {}
  );
  const baseDescription = typeof info.description === "string" ? info.description : "";
  info["x-explore-source-repo"] = pin.repo;
  info["x-explore-source-path"] = pin.path;
  info["x-explore-source-commit"] = pin.commit;
  info["x-explore-source-commit-short"] = pin.commit_short || String(pin.commit).slice(0, 7);
  info["x-explore-source-url"] = pin.source_url;
  info["x-explore-synced-at"] = pin.synced_at;
  info.description = [
    baseDescription.trim(),
    "",
    `Synced from Explore-V2 @ \`${pin.commit_short || String(pin.commit).slice(0, 7)}\` (${pin.commit}).`,
    pin.source_url ? `Source: ${pin.source_url}` : "",
    pin.synced_at ? `Synced at: ${pin.synced_at}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  spec.info = info;

  const json = JSON.stringify(spec);
  cache = { spec, json, pin };
  return cache;
}

export function edgeOpenApiPinStatus() {
  const pin = readPin();
  return {
    edge_openapi_pinned: Boolean(pin?.commit),
    edge_openapi_repo: pin?.repo || "",
    edge_openapi_commit: pin?.commit || "",
    edge_openapi_commit_short: pin?.commit_short || "",
    edge_openapi_source_url: pin?.source_url || "",
    edge_openapi_synced_at: pin?.synced_at || "",
  };
}

/** Test helper */
export function clearEdgeOpenApiCache() {
  cache = null;
}
