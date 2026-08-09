import { createRequire } from "node:module";
import { errorSummary, logger } from "../observability/logger.mjs";
import { convertSwagger2LiteToOpenApi31 } from "./convertSwagger2Lite.mjs";

const require = createRequire(import.meta.url);

/** Short in-memory cache for the serverless/Express instance. */
const CACHE_TTL_MS = 60_000;
/** Vercel serverless response body limit is ~4.5MB; stay under with margin. */
const MAX_JSON_BYTES = 3_500_000;
/** Prefer lite converter on Vercel — swagger2openapi is heavy and often OOMs/times out. */
const PREFER_LITE = process.env.VERCEL === "1" || process.env.POSTGREST_OPENAPI_LITE === "1";

/** @type {{ expiresAt: number, spec: Record<string, unknown>, json: string } | null} */
let cache = null;

function configured(value) {
  return Boolean(String(value || "").trim());
}

/**
 * Strip paste artifacts common in Vercel env values (quotes, Bearer prefix, whitespace).
 * @param {string} value
 */
export function sanitizeSupabaseEnvValue(value) {
  let next = String(value || "").trim();
  if (
    (next.startsWith('"') && next.endsWith('"')) ||
    (next.startsWith("'") && next.endsWith("'"))
  ) {
    next = next.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(next)) {
    next = next.replace(/^bearer\s+/i, "").trim();
  }
  return next;
}

/**
 * Server-side project URL only. Prefer SUPABASE_URL; URL is not secret so
 * VITE_SUPABASE_URL is an allowed fallback for existing deploys.
 */
export function getPostgrestSupabaseUrl() {
  return sanitizeSupabaseEnvValue(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(
    /\/$/,
    "",
  );
}

/**
 * Preferred server-only anon/publishable key.
 * Prefer SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY (never required in the browser bundle).
 */
export function getPostgrestAnonKey() {
  return sanitizeSupabaseEnvValue(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "");
}

function getServiceRoleKey() {
  return sanitizeSupabaseEnvValue(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
}

/**
 * Candidate keys to try against PostgREST (anon/publishable first, then optional extras, then service role).
 * @param {string[]} [extraKeys] e.g. public publishable key forwarded from the admin SPA (already in the Vite bundle)
 * @returns {string[]}
 */
export function getPostgrestAnonKeyCandidates(extraKeys = []) {
  const keys = [
    sanitizeSupabaseEnvValue(process.env.SUPABASE_ANON_KEY || ""),
    sanitizeSupabaseEnvValue(process.env.SUPABASE_PUBLISHABLE_KEY || ""),
    // Runtime VITE_* may be missing on Vercel functions; still try if present.
    sanitizeSupabaseEnvValue(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ""),
    sanitizeSupabaseEnvValue(process.env.VITE_SUPABASE_ANON_KEY || ""),
    ...extraKeys.map((key) => sanitizeSupabaseEnvValue(key)),
    // Admin-only endpoint: service role is already used elsewhere on the server.
    getServiceRoleKey(),
  ].filter(Boolean);
  return [...new Set(keys)];
}

function anonKeyFingerprint(anonKey) {
  if (!anonKey) return { present: false };
  return {
    present: true,
    length: anonKey.length,
    kind: anonKey.startsWith("eyJ")
      ? "legacy_jwt"
      : anonKey.startsWith("sb_publishable_")
        ? "sb_publishable"
        : anonKey.startsWith("sb_")
          ? "sb_other"
          : "unknown",
  };
}

export function postgrestOpenApiConfigStatus() {
  const url = getPostgrestSupabaseUrl();
  let host = "";
  try {
    host = url ? new URL(url).host : "";
  } catch {
    host = "";
  }
  const candidates = getPostgrestAnonKeyCandidates();
  return {
    supabase_url_configured: configured(url),
    supabase_url_host: host,
    supabase_anon_key_configured: candidates.length > 0,
    supabase_anon_key: anonKeyFingerprint(candidates[0] || ""),
    supabase_anon_key_candidates: candidates.length,
    prefer_lite: PREFER_LITE,
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
 * @param {Record<string, unknown>} document
 */
function prepareUpstreamDocument(document) {
  let json;
  try {
    json = JSON.stringify(document);
  } catch {
    return document;
  }
  if (json.length <= 1_200_000) return document;
  logger.warn("PostgREST upstream document large; stripping heavy fields before convert", {
    bytes: json.length,
  });
  return /** @type {Record<string, unknown>} */ (stripHeavyFields(document));
}

/**
 * Convert Swagger 2.0 → OpenAPI 3.1 (lite on Vercel; swagger2openapi when available).
 * @param {Record<string, unknown>} swagger
 * @returns {Promise<{ spec: Record<string, unknown>, converter: string }>}
 */
export async function convertSwaggerToOpenApi31(swagger) {
  if (typeof swagger.openapi === "string") {
    return { spec: normalizeOpenApi31(swagger), converter: "passthrough" };
  }

  if (!PREFER_LITE) {
    const swagger2openapi = loadSwagger2OpenApi();
    if (swagger2openapi?.convertObj) {
      try {
        const result = await swagger2openapi.convertObj(swagger, {
          patch: true,
          warnOnly: true,
          resolve: false,
        });
        if (result?.openapi && typeof result.openapi === "object") {
          return {
            spec: normalizeOpenApi31(/** @type {Record<string, unknown>} */ (result.openapi)),
            converter: "swagger2openapi",
          };
        }
        logger.warn("swagger2openapi returned no document; using lite converter");
      } catch (error) {
        logger.warn("swagger2openapi conversion failed; using lite converter", {
          error: errorSummary(error),
        });
      }
    }
  }

  return {
    spec: convertSwagger2LiteToOpenApi31(swagger),
    converter: "lite",
  };
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
 * Plain JSON response (no manual gzip — Vercel/CDN compresses; double-gzip breaks Scalar).
 * @param {number} status
 * @param {string} json
 * @param {Record<string, string>} [headers]
 */
export function openApiJsonResponse(status, json, headers = {}) {
  return new Response(json, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Request-ID, X-Explore-Supabase-Anon-Key",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Expose-Headers":
        "X-Request-ID, X-Explore-OpenAPI, X-Explore-OpenAPI-Cache, X-Explore-OpenAPI-Converter",
      "X-Explore-OpenAPI": "postgrest",
      ...headers,
    },
  });
}

/**
 * @param {{ fetchImpl?: typeof fetch, now?: () => number, anonKeyCandidates?: string[] }} [options]
 */
export async function fetchLivePostgrestOpenApi(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || Date.now;
  const at = now();

  if (cache && cache.expiresAt > at) {
    return { spec: cache.spec, json: cache.json, cache: "hit", converter: "cache" };
  }

  const url = getPostgrestSupabaseUrl();
  const keyCandidates = getPostgrestAnonKeyCandidates(options.anonKeyCandidates || []);
  if (!url || keyCandidates.length === 0) {
    throw Object.assign(
      new Error(
        "PostgREST OpenAPI requires SUPABASE_URL and at least one of SUPABASE_ANON_KEY, VITE_SUPABASE_PUBLISHABLE_KEY, or SUPABASE_SECRET_KEY.",
      ),
      { status: 503, code: "postgrest_openapi_config_missing" },
    );
  }

  const endpoint = `${url}/rest/v1/`;
  const accept = "application/openapi+json, application/json";

  let response = null;
  let lastStatus = 0;
  let usedKeySource = "primary";
  try {
    for (let keyIndex = 0; keyIndex < keyCandidates.length; keyIndex += 1) {
      const anonKey = keyCandidates[keyIndex];
      /** @type {Array<Record<string, string>>} */
      const authAttempts = [
        { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        { apikey: anonKey },
      ];
      for (const authHeaders of authAttempts) {
        response = await fetchImpl(endpoint, {
          method: "GET",
          headers: {
            Accept: accept,
            ...authHeaders,
          },
        });
        lastStatus = response.status;
        if (response.ok) {
          usedKeySource = keyIndex === 0 ? "primary" : `fallback_${keyIndex}`;
          if (keyIndex > 0) {
            logger.warn("PostgREST OpenAPI succeeded with fallback anon key candidate", {
              key_index: keyIndex,
              key: anonKeyFingerprint(anonKey),
            });
          }
          break;
        }
        if (response.status !== 401) break;
      }
      if (response?.ok || (response && response.status !== 401)) break;
    }
  } catch (error) {
    logger.warn("PostgREST OpenAPI upstream fetch failed", { error: errorSummary(error) });
    throw Object.assign(new Error("Failed to reach PostgREST OpenAPI upstream"), {
      status: 502,
      code: "postgrest_openapi_upstream_unreachable",
    });
  }

  if (!response || !response.ok) {
    const config = postgrestOpenApiConfigStatus();
    logger.warn("PostgREST OpenAPI upstream returned error", {
      status: lastStatus || response?.status,
      ...config,
    });
    if (lastStatus === 401 || response?.status === 401) {
      throw Object.assign(
        new Error(
          `Supabase rejected all configured anon/publishable keys for ${config.supabase_url_host || "SUPABASE_URL"} (HTTP 401). In Vercel, set SUPABASE_ANON_KEY to the same value as VITE_SUPABASE_PUBLISHABLE_KEY from this project (Dashboard → Settings → API → anon public), then Redeploy.`,
        ),
        { status: 502, code: "postgrest_openapi_upstream_unauthorized" },
      );
    }
    throw Object.assign(new Error(`PostgREST OpenAPI upstream returned ${lastStatus || response?.status}`), {
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

  const prepared = prepareUpstreamDocument(/** @type {Record<string, unknown>} */ (document));
  const { spec: converted, converter } = await convertSwaggerToOpenApi31(prepared);
  const fitted = fitOpenApiForServerless(converted);
  cache = { spec: fitted.spec, json: fitted.json, expiresAt: at + CACHE_TTL_MS };
  logger.info("PostgREST OpenAPI ready", {
    converter,
    key_source: usedKeySource,
    bytes: fitted.json.length,
    path_count: Object.keys(/** @type {object} */ (fitted.spec.paths || {})).length,
  });
  return { spec: fitted.spec, json: fitted.json, cache: "miss", converter };
}

/** Test helper */
export function clearPostgrestOpenApiCache() {
  cache = null;
}

export const POSTGREST_OPENAPI_CACHE_TTL_MS = CACHE_TTL_MS;
export const POSTGREST_OPENAPI_MAX_JSON_BYTES = MAX_JSON_BYTES;
