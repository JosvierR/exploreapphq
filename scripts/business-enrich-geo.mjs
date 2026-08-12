import { createBusinessServiceClient, argValue, hasFlag, safeError } from "./business-runtime.mjs";
import {
  buildNominatimReverseUrl,
  coordinateHash,
  normalizeNominatimResult,
} from "./business-geo-enrichment-lib.mjs";

const DEFAULT_RESOLVER = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "ExploreBI-GeoEnrichment/1.0 (+https://www.exploreapphq.com/)";

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function positiveInteger(value, fallback, label) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

async function fetchJsonWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
        signal: controller.signal,
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`resolver_http_${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(500 * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const apply = hasFlag("apply");
  if (dryRun === apply) throw new Error("Choose exactly one of --dry-run or --apply.");

  const endpoint = (process.env.BUSINESS_GEO_RESOLVER_URL || DEFAULT_RESOLVER).trim();
  const resolverUrl = new URL(endpoint);
  const publicNominatim = resolverUrl.hostname === "nominatim.openstreetmap.org";
  if (publicNominatim && !hasFlag("accept-public-nominatim-policy")) {
    throw new Error(
      "Public Nominatim requires an explicit --accept-public-nominatim-policy acknowledgement. " +
        "The run is single-threaded, cached on apply, and limited to at most one request per second.",
    );
  }

  const limit = positiveInteger(argValue("limit"), 500, "--limit");
  const minimumInterval = Math.max(
    publicNominatim ? 1_100 : 0,
    positiveInteger(process.env.BUSINESS_GEO_MIN_INTERVAL_MS, publicNominatim ? 1_100 : 250, "BUSINESS_GEO_MIN_INTERVAL_MS"),
  );
  const fromId = argValue("from-id");
  const requestedNames = (argValue("names") || "")
    .split("|")
    .map((value) => value.trim().toLocaleLowerCase())
    .filter(Boolean);
  const onlyUnresolved = hasFlag("only-unresolved") || !hasFlag("include-resolved");
  const supabase = createBusinessServiceClient();

  let query = supabase
    .from("dim_places")
    .select("place_id, place_name, latitude, longitude, geo_id")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("place_id", { ascending: true })
    .limit(1_000);
  if (fromId) query = query.gt("place_id", fromId);
  const { data: places, error: placeError } = await query;
  if (placeError) throw placeError;

  const { data: cachedRows, error: cacheError } = await supabase
    .from("business_place_geo_enrichment")
    .select("place_id, coordinate_hash, status, confidence, source")
    .limit(1_000);
  const cacheAvailable = !cacheError;
  if (cacheError && !dryRun) throw cacheError;
  const cache = new Map((cachedRows || []).map((row) => [String(row.place_id), row]));

  const candidates = (places || [])
    .filter((place) => {
      if (requestedNames.length && !requestedNames.includes(String(place.place_name).toLocaleLowerCase())) return false;
      if (!onlyUnresolved) return true;
      const cached = cache.get(String(place.place_id));
      return !cached || cached.coordinate_hash !== coordinateHash(place.latitude, place.longitude);
    })
    .slice(0, limit);

  const summary = {
    mode: dryRun ? "dry-run" : "apply",
    provider: publicNominatim ? "nominatim-public" : resolverUrl.hostname,
    cache_available: cacheAvailable,
    eligible: places?.length || 0,
    selected: candidates.length,
    resolved: 0,
    applied: 0,
    unknown: 0,
    failed: 0,
    skipped_cached: Math.max(0, (places?.length || 0) - candidates.length),
  };
  console.log(JSON.stringify({ event: "geo_enrichment_started", ...summary }));

  for (let index = 0; index < candidates.length; index += 1) {
    const place = candidates[index];
    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);
    const requestStarted = Date.now();
    try {
      const payload = await fetchJsonWithRetry(buildNominatimReverseUrl(endpoint, latitude, longitude));
      const normalized = normalizeNominatimResult(payload);
      let application = { status: dryRun ? "dry_run" : normalized.status };

      if (apply) {
        const { data, error } = await supabase.rpc("apply_business_place_geo_enrichment", {
          target_place_id: place.place_id,
          target_latitude: latitude,
          target_longitude: longitude,
          target_source: "provider",
          target_provider: "openstreetmap_nominatim",
          target_provider_ref: normalized.provider_ref,
          target_country_code: normalized.country_code,
          target_country_name: normalized.country_name,
          target_admin_level_1: normalized.admin_level_1,
          target_admin_level_1_code: normalized.admin_level_1_code,
          target_admin_level_2: normalized.admin_level_2,
          target_admin_level_2_code: normalized.admin_level_2_code,
          target_locality: normalized.locality,
          target_locality_type: normalized.locality_type,
          target_sub_locality: normalized.sub_locality,
          target_confidence: normalized.confidence,
          target_evidence: normalized.evidence,
        });
        if (error) throw error;
        application = data || application;
      }

      if (normalized.status === "applied") summary.resolved += 1;
      else summary.unknown += 1;
      if (apply && application.status === "applied") summary.applied += 1;
      console.log(
        JSON.stringify({
          event: "geo_enrichment_place",
          sequence: index + 1,
          total: candidates.length,
          place: place.place_name,
          coordinates: { latitude, longitude },
          destination: {
            country_code: normalized.country_code,
            country: normalized.country_name,
            admin_level_1: normalized.admin_level_1,
            admin_level_1_code: normalized.admin_level_1_code,
            admin_level_2: normalized.admin_level_2,
            locality: normalized.locality,
            locality_type: normalized.locality_type,
            confidence: normalized.confidence,
          },
          result: application.status,
        }),
      );
    } catch (error) {
      summary.failed += 1;
      console.error(
        JSON.stringify({
          event: "geo_enrichment_failure",
          sequence: index + 1,
          total: candidates.length,
          place: place.place_name,
          error: safeError(error),
        }),
      );
    }

    const waitFor = minimumInterval - (Date.now() - requestStarted);
    if (index < candidates.length - 1 && waitFor > 0) await sleep(waitFor);
  }

  let routes = null;
  if (apply && summary.failed === 0) {
    const { data, error } = await supabase.rpc("refresh_business_route_geography");
    if (error) throw error;
    routes = data;
  }
  console.log(JSON.stringify({ event: "geo_enrichment_finished", ...summary, routes }, null, 2));
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeError(error) }, null, 2));
  process.exitCode = 1;
});
