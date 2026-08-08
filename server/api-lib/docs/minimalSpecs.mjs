/**
 * Minimal valid OpenAPI 3.1 skeletons per surface.
 * Full path inventories are filled in later phases — keep these syntactically valid.
 */

/** @typedef {"postgrest" | "edge" | "admin"} OpenApiSurface */

const SURFACE_META = {
  postgrest: {
    title: "Explore PostgREST API",
    description:
      "Skeleton OpenAPI for the Supabase PostgREST surface. Paths will be documented in a later phase.",
  },
  edge: {
    title: "Explore Edge Functions API",
    description:
      "Skeleton OpenAPI for Supabase Edge Functions. Paths will be documented in a later phase.",
  },
  admin: {
    title: "Explore Admin HTTP API",
    description:
      "Skeleton OpenAPI for admin-only `/api/admin/*` routes. Paths will be documented in a later phase.",
  },
};

/**
 * @param {OpenApiSurface} surface
 * @returns {Record<string, unknown>}
 */
export function buildMinimalOpenApiSpec(surface) {
  const meta = SURFACE_META[surface];
  if (!meta) {
    throw new Error(`Unknown OpenAPI surface: ${surface}`);
  }

  return {
    openapi: "3.1.0",
    info: {
      title: meta.title,
      version: "0.0.0",
      description: meta.description,
    },
    paths: {},
  };
}

/** @type {readonly OpenApiSurface[]} */
export const OPENAPI_SURFACES = Object.freeze(["postgrest", "edge", "admin"]);

/**
 * @param {string} value
 * @returns {value is OpenApiSurface}
 */
export function isOpenApiSurface(value) {
  return OPENAPI_SURFACES.includes(/** @type {OpenApiSurface} */ (value));
}
