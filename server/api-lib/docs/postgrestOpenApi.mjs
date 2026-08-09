import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import { errorSummary, logger } from "../observability/logger.mjs";
import { convertSwagger2LiteToOpenApi31 } from "./convertSwagger2Lite.mjs";

const require = createRequire(import.meta.url);

/** Short in-memory cache for the serverless/Express instance. */
const CACHE_TTL_MS = 60_000;
/** Vercel serverless response body limit is ~4.5MB; stay under with margin. */
const MAX_JSON_BYTES = 3_500_000;

/** @type {{ expiresAt: number, spec: Record<string, unknown>, json: string } | null} */
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

function loadSwagger2OpenApi() {
  try {
    return require("swagger2openapi");
  } catch (error) {
    logger.warn("swagger2openapi require failed; using lite converter", {
      error: errorSummary(error),
    });
    return null;
  }
}

/**
 * @param {Record<string, unknown>} doc
 * @returns {Record<string, unknown>}
 */
export function normalizeOpenApi31(doc) {
  const spec = /** @type {Record<string, unknown>} */ ({ ...doc, openapi: "3.1.0" });
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
 * Convert Swagger 2.0 → OpenAPI 3.1 (swagger2openapi preferred, lite fallback).
 * @param {Record<string, unknown>} swagger
 * @returns {Promise<Record<string, unknown>>}
 */
export async function convertSwaggerToOpenApi31(swagger) {
  if (typeof swagger.openapi === "string") {
    return normalizeOpenApi31(swagger);
  }

  const swagger2openapi = loadSwagger2OpenApi();
  if (swagger2openapi?.convertObj) {
    try {
      const result = await swagger2openapi.convertObj(swagger, {
        patch: true,
        warnOnly: true,
        resolve: false,
      });
      if (result?.openapi && typeof result.openapi === "object") {
        return normalizeOpenApi31(/** @type {Record<string, unknown>} */ (result.openapi));
      }
      logger.warn("swagger2openapi returned no document; using lite converter");
    } catch (error) {
      logger.warn("swagger2openapi conversion failed; using lite converter", {
        error: errorSummary(error),
      });
    }
  }

  return convertSwagger2LiteToOpenApi31(swagger);
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function stripHeavyFields(value) {
  if (Array.isArray(value)) return value.map((item) => stripHeavyFields(item));
  if (!value || typeof value !== "object") return value;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, child] of Object.entries(/** @type {Record<string, unknown>} */ (value))) {
    if (key === "description" || key === "example" || key === "examples" || key === "externalDocs") {
      continue;
    }
    out[key] = stripHeavyFields(child);
  }
  return out;
}

/**
 * @param {Record<string, unknown>} spec
 * @returns {{ spec: Record<string, unknown>, json: string }}
 */
export function fitOpenApiForServerless(spec) {
  let current = spec;
  let json = JSON.stringify(current);
  if (json.length <= MAX_JSON_BYTES) return { spec: current, json };

  current = /** @type {Record<string, unknown>} */ (stripHeavyFields(current));
  json = JSON.stringify(current);
  if (json.length <= MAX_JSON_BYTES) {
    logger.warn("PostgREST OpenAPI pruned descriptions/examples to fit serverless limit", {
      bytes: json.length,
    });
    return { spec: current, json };
  }

  throw Object.assign(
    new Error(
      `PostgREST OpenAPI is too large for serverless response (${json.length} bytes after prune; limit ${MAX_JSON_BYTES}).`,
    ),
    { status: 502, code: "postgrest_openapi_too_large" },
  );
}

/**
 * @param {Request} request
 * @param {number} status
 * @param {string} json
 * @param {Record<string, string>} [headers]
 */
export function openApiJsonResponse(request, status, json, headers = {}) {
  const acceptEncoding = request.headers.get("accept-encoding") || "";
  const baseHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Request-ID",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Expose-Headers": "X-Request-ID, X-Explore-OpenAPI, X-Explore-OpenAPI-Cache",
    "X-Explore-OpenAPI": "postgrest",
    ...headers,
  };

  if (json.length > 80_000 && /\bgzip\b/i.test(acceptEncoding)) {
    const compressed = gzipSync(Buffer.from(json, "utf8"));
    return new Response(compressed, {
      status,
      headers: {
        ...baseHeaders,
        "Content-Encoding": "gzip",
        Vary: "Accept-Encoding",
        "Content-Length": String(compressed.length),
      },
    });
  }

  return new Response(json, {
    status,
    headers: baseHeaders,
  });
}

/**
 * @param {{ fetchImpl?: typeof fetch, now?: () => number }} [options]
 */
export async function fetchLivePostgrestOpenApi(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || Date.now;
  const at = now();

  if (cache && cache.expiresAt > at) {
    return { spec: cache.spec, json: cache.json, cache: "hit" };
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
        // Prefer OpenAPI; fall back to JSON (Swagger 2 on older PostgREST).
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

  let document;
  try {
    document = await response.json();
  } catch (error) {
    throw Object.assign(new Error("PostgREST OpenAPI upstream returned invalid JSON"), {
      status: 502,
      code: "postgrest_openapi_upstream_invalid",
      cause: error,
    });
  }

  if (!document || typeof document !== "object") {
    throw Object.assign(new Error("PostgREST OpenAPI upstream returned an empty document"), {
      status: 502,
      code: "postgrest_openapi_upstream_invalid",
    });
  }

  const converted = await convertSwaggerToOpenApi31(/** @type {Record<string, unknown>} */ (document));
  const fitted = fitOpenApiForServerless(converted);
  cache = { spec: fitted.spec, json: fitted.json, expiresAt: at + CACHE_TTL_MS };
  return { spec: fitted.spec, json: fitted.json, cache: "miss" };
}

/** Test helper */
export function clearPostgrestOpenApiCache() {
  cache = null;
}

export const POSTGREST_OPENAPI_CACHE_TTL_MS = CACHE_TTL_MS;
export const POSTGREST_OPENAPI_MAX_JSON_BYTES = MAX_JSON_BYTES;
