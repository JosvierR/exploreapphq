import { createHash } from "node:crypto";

const cache = new Map();
const MAX_ENTRIES = 250;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function businessCacheKey(route, params, access = {}) {
  const scope = {
    route,
    actor_type: access.actor_type || "admin",
    business_id: access.business_id || params.business_id || null,
    location_id: access.location_id || params.location_id || null,
    authorized_place_ids: access.authorized_place_ids || params.authorized_place_ids || null,
    authorized_market_geo_ids: access.authorized_market_geo_ids || params.authorized_market_geo_ids || null,
    params,
  };
  return createHash("sha256").update(JSON.stringify(stable(scope))).digest("hex");
}

export function businessCacheTtl(params, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return params.end && params.end < today ? 5 * 60_000 : 60_000;
}

export async function readThroughBusinessCache(key, ttlMs, loader) {
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && existing.expires_at > now) {
    return { value: existing.value, cache_hit: true };
  }
  if (existing) cache.delete(key);

  const value = await loader();
  if (cache.size >= MAX_ENTRIES) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, { value, expires_at: now + ttlMs });
  return { value, cache_hit: false };
}

export function clearBusinessIntelligenceCache() {
  cache.clear();
}

