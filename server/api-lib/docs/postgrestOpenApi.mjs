import { createRequire } from "node:module";
import { errorSummary, logger } from "../observability/logger.mjs";

const require = createRequire(import.meta.url);
const swagger2openapi = require("swagger2openapi");

/** Short in-memory cache for the serverless/Express instance. */
const CACHE_TTL_MS = 60_000;

/** @type {{ expiresAt: number, spec: Record<string, unknown> } | null} */
let cache = null;

function configured(value) {
  return Boolean(String(value || "").trim());
}

/**
 * Server-side project URL only. Prefer SUPABASE_URL; URL is not secret so
 * VITE_SUPABASE_URL is an allowed fallback for existing deploys.
 */
export function getPostgrestSupabaseUrl() {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
}

/**
 * Anon/publishable key for PostgREST OpenAPI fetch — server-only.
 * Never read VITE_* here so the key is not coupled to the browser bundle.
 */
export function getPostgrestAnonKey() {
  return (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();
}

export function postgrestOpenApiConfigStatus() {
  return {
    supabase_url_configured: configured(getPostgrestSupabaseUrl()),
    supabase_anon_key_configured: configured(getPostgrestAnonKey()),
  };
}

/**
 * Convert Swagger 2.0 → OpenAPI 3.x, then normalize to 3.1.0 for Scalar.
 * @param {Record<string, unknown>} swagger
 * @returns {Promise<Record<string, unknown>>}
 */
export async function convertSwaggerToOpenApi31(swagger) {
  const result = await swagger2openapi.convertObj(swagger, {
    patch: true,
    warnOnly: true,
  });
  const openapi = result?.openapi;
  if (!openapi || typeof openapi !== "object") {
    throw Object.assign(new Error("swagger2openapi did not return an OpenAPI document"), { status: 502 });
  }

  const spec = /** @type {Record<string, unknown>} */ ({ ...openapi, openapi: "3.1.0" });
  if (!spec.info || typeof spec.info !== "object") {
    spec.info = { title: "Explore PostgREST API", version: "0.0.0" };
  } else {
    const info = /** @type {Record<string, unknown>} */ ({ .../** @type {object} */ (spec.info) });
    if (!info.title) info.title = "Explore PostgREST API";
    if (!info.version) info.version = "0.0.0";
    spec.info = info;
  }
  if (!spec.paths || typeof spec.paths !== "object") {
    spec.paths = {};
  }
  return spec;
}

/**
 * @param {{ fetchImpl?: typeof fetch, now?: () => number }} [options]
 */
export async function fetchLivePostgrestOpenApi(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || Date.now;
  const at = now();

  if (cache && cache.expiresAt > at) {
    return { spec: cache.spec, cache: "hit" };
  }

  const url = getPostgrestSupabaseUrl();
  const anonKey = getPostgrestAnonKey();
  if (!url || !anonKey) {
    throw Object.assign(
      new Error(
        "PostgREST OpenAPI requires server-side SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY). Do not use VITE_* for the anon key.",
      ),
      { status: 503, code: "postgrest_openapi_config_missing" },
    );
  }

  const endpoint = `${url}/rest/v1/`;
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/openapi+json, application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });
  } catch (error) {
    logger.warn("PostgREST OpenAPI upstream fetch failed", { error: errorSummary(error) });
    throw Object.assign(new Error("Failed to reach PostgREST OpenAPI upstream"), {
      status: 502,
      code: "postgrest_openapi_upstream_unreachable",
    });
  }

  if (!response.ok) {
    logger.warn("PostgREST OpenAPI upstream returned error", {
      status: response.status,
    });
    throw Object.assign(new Error(`PostgREST OpenAPI upstream returned ${response.status}`), {
      status: 502,
      code: "postgrest_openapi_upstream_error",
    });
  }

  let swagger;
  try {
    swagger = await response.json();
  } catch (error) {
    throw Object.assign(new Error("PostgREST OpenAPI upstream returned invalid JSON"), {
      status: 502,
      code: "postgrest_openapi_upstream_invalid",
      cause: error,
    });
  }

  if (!swagger || typeof swagger !== "object") {
    throw Object.assign(new Error("PostgREST OpenAPI upstream returned an empty document"), {
      status: 502,
      code: "postgrest_openapi_upstream_invalid",
    });
  }

  const spec = await convertSwaggerToOpenApi31(/** @type {Record<string, unknown>} */ (swagger));
  cache = { spec, expiresAt: at + CACHE_TTL_MS };
  return { spec, cache: "miss" };
}

/** Test helper */
export function clearPostgrestOpenApiCache() {
  cache = null;
}

export const POSTGREST_OPENAPI_CACHE_TTL_MS = CACHE_TTL_MS;
