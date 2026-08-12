/**
 * Business Intelligence aggregates for Admin > Business.
 * Privacy-safe, geo-filterable, name-enriched place/route rankings.
 */

import {
  BUSINESS_ANALYTICS_CORE_VERSION,
  MIN_SEARCHES_FOR_OPPORTUNITY,
  MIN_USERS_FOR_SEGMENT,
  MIN_RELIABLE_SAMPLE,
  MIN_TREND_BASELINE,
  buildBusinessBenchmark,
  buildDecisionInsights,
  buildExecutiveSummary,
  calculateCanonicalKpis,
  calculateDemandIndex,
  categoryMatrix,
  enrichCategoryIntelligence,
  eventTaxonomyForClient,
  metricDefinitionsForClient,
  periodDelta,
} from "./businessAnalyticsCore.mjs";

const EVENTS_TABLE = "analytics_events";
const VALID_EVENTS_VIEW = "analytics_normalized_events";
const PAGE_SIZE = 1000;
const MAX_EVENTS = 100_000;
const MAX_RANGE_DAYS = 366;
const LOCATION_MIN_EVENTS = MIN_USERS_FOR_SEGMENT;
const SEARCH_DISPLAY_MIN = MIN_SEARCHES_FOR_OPPORTUNITY;
const MOVER_MIN_PREVIOUS = MIN_TREND_BASELINE;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_PRESETS = new Set(["7d", "30d", "90d", "365d", "12m"]);
const VALID_COMPARE = new Set(["previous", "previous_year", "none"]);
const VALID_GRANULARITY = new Set(["daily", "weekly", "monthly"]);
const VALID_PLATFORMS = new Set(["ios", "android", "web", "server"]);
const VALID_SOURCES = new Set(["mobile", "web", "backend", "admin"]);
const VALID_MAP_METRICS = new Set([
  "demand",
  "activity",
  "users",
  "place_views",
  "route_views",
  "intent",
  "saves",
  "searches",
  "growth",
  "supply",
  "opportunity",
]);

const VIDEO_ENGAGEMENT_EVENTS = new Set([
  "video_impression",
  "video_view_start",
  "video_view_3s",
  "video_view_25",
  "video_view_50",
  "video_view_75",
  "video_view_complete",
  "video_like",
  "video_share",
  "video_open_places_routes",
]);

const COUNTRY_NAME_TO_ISO = {
  "united states": "US",
  usa: "US",
  "dominican republic": "DO",
  "republica dominicana": "DO",
  "república dominicana": "DO",
  spain: "ES",
  españa: "ES",
  mexico: "MX",
  méxico: "MX",
  italy: "IT",
  italia: "IT",
  france: "FR",
  germany: "DE",
  "united kingdom": "GB",
  "saudi arabia": "SA",
  egypt: "EG",
  iran: "IR",
  india: "IN",
  pakistan: "PK",
};

const VIEW_EVENTS = new Set([
  "content_view",
  "video_view",
  "video_view_start",
  "place_view",
  "route_view",
  "user_profile_view",
  "profile_view",
  "place_photo_view",
]);
const SAVE_EVENTS = new Set(["content_save", "video_save", "place_save", "route_save", "place_photo_save"]);
const SHARE_EVENTS = new Set(["content_share", "video_share", "place_share", "route_share", "place_photo_share"]);
const SEARCH_EVENTS = new Set(["search_performed", "search_submitted", "search_no_results", "search_result_clicked"]);
const IMPRESSION_EVENTS = new Set(["video_impression", "place_impression", "route_impression"]);
const PLACE_COMMERCE_EVENTS = new Set([
  "place_get_directions",
  "place_call",
  "place_website_click",
  "place_map_open",
  "place_open_map",
]);

const COUNTRY_NAMES = {
  US: "United States",
  CA: "Canada",
  MX: "Mexico",
  DO: "Dominican Republic",
  PR: "Puerto Rico",
  CU: "Cuba",
  JM: "Jamaica",
  HT: "Haiti",
  CR: "Costa Rica",
  PA: "Panama",
  GT: "Guatemala",
  BR: "Brazil",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  PE: "Peru",
  VE: "Venezuela",
  GB: "United Kingdom",
  IE: "Ireland",
  FR: "France",
  ES: "Spain",
  PT: "Portugal",
  DE: "Germany",
  IT: "Italy",
  NL: "Netherlands",
  BE: "Belgium",
  CH: "Switzerland",
  AT: "Austria",
  PL: "Poland",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  GR: "Greece",
  TR: "Turkey",
  RU: "Russia",
  UA: "Ukraine",
  EG: "Egypt",
  MA: "Morocco",
  ZA: "South Africa",
  NG: "Nigeria",
  KE: "Kenya",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  IL: "Israel",
  IR: "Iran",
  IQ: "Iraq",
  IN: "India",
  PK: "Pakistan",
  BD: "Bangladesh",
  CN: "China",
  JP: "Japan",
  KR: "South Korea",
  TH: "Thailand",
  VN: "Vietnam",
  ID: "Indonesia",
  MY: "Malaysia",
  PH: "Philippines",
  SG: "Singapore",
  AU: "Australia",
  NZ: "New Zealand",
};

const REGION_LABELS = {
  US: "State",
  CA: "Province",
  MX: "State",
  DO: "Province",
  ES: "Autonomous community",
  FR: "Region",
  IT: "Region",
  DE: "State",
  BR: "State",
  AR: "Province",
  CO: "Department",
  PE: "Region",
  CL: "Region",
  default: "Region",
};

export class BusinessIntelligenceError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.name = "BusinessIntelligenceError";
    this.status = status;
    this.code = options.code;
  }
}

function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addDays(day, delta) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return utcDay(date);
}

function parseDay(value, label) {
  const day = String(value || "").trim();
  if (!DATE_RE.test(day)) {
    throw new BusinessIntelligenceError(400, `${label} must be YYYY-MM-DD.`, { code: "bi_invalid_date" });
  }
  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || utcDay(parsed) !== day) {
    throw new BusinessIntelligenceError(400, `${label} must be a valid calendar date.`, { code: "bi_invalid_date" });
  }
  return day;
}

function rate(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function buildDelta(current, previous) {
  const absolute = current - previous;
  if (previous === 0) {
    return {
      current,
      previous,
      absolute,
      percent: null,
      label: current > 0 ? "New activity" : "No previous data",
    };
  }
  return {
    current,
    previous,
    absolute,
    percent: Math.round((absolute / previous) * 1000) / 10,
    label: null,
  };
}

function marketCountry(row) {
  const raw = row?._destination_country || row?._place_country || null;
  return raw ? normalizeCountryCode(raw) : null;
}

function countryFromLocale(locale) {
  const match = String(locale || "")
    .trim()
    .match(/[_-]([A-Za-z]{2})$/);
  return match ? match[1].toUpperCase() : null;
}

function normalizeCountryCode(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const mapped = COUNTRY_NAME_TO_ISO[raw.toLowerCase()];
  if (mapped) return mapped;
  // Fall back to uppercase token; keep 2-letter if possible.
  if (raw.length === 2) return raw.toUpperCase();
  return raw;
}

function marketRegion(row) {
  const value = row?._destination_region || row?._place_region;
  return value ? String(value).trim() : null;
}

function marketCity(row) {
  const value = row?._destination_city || row?._place_city;
  return value ? String(value).trim() : null;
}

function marketNeighborhood(row) {
  const value = row?._destination_neighborhood || row?._place_neighborhood;
  return value ? String(value).trim() : null;
}

export function destinationMarketForRow(row) {
  return {
    country: marketCountry(row),
    region: marketRegion(row),
    city: marketCity(row),
    neighborhood: marketNeighborhood(row),
  };
}

export function travelerOriginForRow(row) {
  const country =
    row?._origin_country ||
    row?.origin_country ||
    row?.properties?.origin_country ||
    row?.context?.origin_country ||
    row?.country ||
    countryFromLocale(row?.locale);
  return {
    country: country ? normalizeCountryCode(country) : null,
    region: row?._origin_region || row?.origin_region || row?.region || null,
    city: row?._origin_city || row?.origin_city || row?.city || null,
  };
}

function eventLatLng(row) {
  const lat = Number(row?._lat ?? row?.properties?.lat ?? row?.properties?.latitude);
  const lng = Number(row?._lng ?? row?.properties?.lng ?? row?.properties?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function countryLabel(code) {
  if (!code) return "Unknown";
  const normalized = normalizeCountryCode(code);
  return COUNTRY_NAMES[normalized] || normalized || code;
}

function regionLabelFor(country) {
  return REGION_LABELS[country] || REGION_LABELS.default;
}

function firstField(row, names) {
  if (!row) return null;
  for (const name of names) {
    const value = row[name];
    if (value != null && String(value).trim()) return value;
  }
  return null;
}

function warning(code, message, severity = "warning") {
  return { code, severity, message };
}

function latestDataAsOf(rows) {
  return rows.map((row) => row.received_at || row.occurred_at).filter(Boolean).sort().at(-1) || null;
}

function isPlaceView(row) {
  return row.event_name === "place_view" || (row.entity_type === "place" && VIEW_EVENTS.has(row.event_name));
}

function isRouteView(row) {
  return row.event_name === "route_view" || (row.entity_type === "route" && VIEW_EVENTS.has(row.event_name));
}

function isSearchEvent(row) {
  return SEARCH_EVENTS.has(row.event_name) && row.event_name !== "search_result_clicked";
}

function extractCategoryHint(row, meta) {
  if (meta?.category) return String(meta.category);
  const props = row?.properties || {};
  return props.category || props.place_category || props.entity_category || null;
}

function hourBucket(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCHours();
}

function weekdayBucket(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCDay(); // 0 Sun
}

const TIME_PART_FORMATTERS = new Map();

function localTimeBuckets(iso, timezone) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const zone = String(timezone || "UTC").trim() || "UTC";
  try {
    let formatter = TIME_PART_FORMATTERS.get(zone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hour: "2-digit",
        hourCycle: "h23",
        weekday: "short",
      });
      TIME_PART_FORMATTERS.set(zone, formatter);
    }
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { hour: Number(parts.hour), weekday: weekdays[parts.weekday] };
  } catch {
    return { hour: hourBucket(iso), weekday: weekdayBucket(iso) };
  }
}

function daypart(hour) {
  if (hour == null) return null;
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export function resolveBusinessIntelligenceParams(request) {
  const url = new URL(request.url);
  const presetRaw = url.searchParams.get("range") || "30d";
  const preset = presetRaw === "12m" ? "365d" : presetRaw;
  const startParam = url.searchParams.get("from") || url.searchParams.get("date_from") || url.searchParams.get("start");
  const endParam = url.searchParams.get("to") || url.searchParams.get("date_to") || url.searchParams.get("end");
  const compareFromParam = url.searchParams.get("compare_from");
  const compareToParam = url.searchParams.get("compare_to");
  const compareRaw = url.searchParams.get("compare") || "previous";
  const compare = VALID_COMPARE.has(compareRaw) ? compareRaw : "previous";
  const granularity = VALID_GRANULARITY.has(url.searchParams.get("granularity") || "")
    ? url.searchParams.get("granularity")
    : "daily";
  const mapMetric = VALID_MAP_METRICS.has(url.searchParams.get("map_metric") || "")
    ? url.searchParams.get("map_metric")
    : "activity";

  const country = (url.searchParams.get("country") || "").trim().toUpperCase() || null;
  const region = (url.searchParams.get("region") || "").trim() || null;
  const city = (url.searchParams.get("city") || "").trim() || null;
  const neighborhood = (url.searchParams.get("neighborhood") || "").trim() || null;
  const geoId = (url.searchParams.get("geo_id") || "").trim() || null;
  const category = (url.searchParams.get("category") || url.searchParams.get("category_id") || "").trim() || null;
  const categoryId = (url.searchParams.get("category_id") || "").trim() || null;
  const businessId = (url.searchParams.get("business_id") || "").trim() || null;
  const locationId = (url.searchParams.get("location_id") || "").trim() || null;
  const placeId = (url.searchParams.get("place_id") || "").trim() || null;
  const routeId = (url.searchParams.get("route_id") || "").trim() || null;
  const platform = (url.searchParams.get("platform") || "").trim().toLowerCase() || null;
  const source = (url.searchParams.get("source") || "").trim().toLowerCase() || null;
  const compareMarkets = url.searchParams
    .getAll("compare_market")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (platform && !VALID_PLATFORMS.has(platform)) {
    throw new BusinessIntelligenceError(400, "Invalid platform filter.", { code: "bi_invalid_platform" });
  }
  if (source && !VALID_SOURCES.has(source)) {
    throw new BusinessIntelligenceError(400, "Invalid source filter.", { code: "bi_invalid_source" });
  }

  let range;
  if (startParam || endParam) {
    if (!startParam || !endParam) {
      throw new BusinessIntelligenceError(400, "Custom range requires date_from and date_to.", { code: "bi_invalid_range" });
    }
    const start = parseDay(startParam, "date_from");
    const end = parseDay(endParam, "date_to");
    if (start > end) {
      throw new BusinessIntelligenceError(400, "date_from must be on or before date_to.", { code: "bi_invalid_range" });
    }
    const days = Math.floor((Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86_400_000) + 1;
    if (days > MAX_RANGE_DAYS) {
      throw new BusinessIntelligenceError(400, `Range cannot exceed ${MAX_RANGE_DAYS} days.`, { code: "bi_range_too_large" });
    }
    range = {
      preset: "custom",
      start,
      end,
      since: `${start}T00:00:00.000Z`,
      until: `${addDays(end, 1)}T00:00:00.000Z`,
    };
  } else {
    if (!VALID_PRESETS.has(preset) && preset !== "24h") {
      throw new BusinessIntelligenceError(400, "Invalid range. Use 7d, 30d, 90d, 12m, or custom dates.", {
        code: "bi_invalid_range",
      });
    }
    const hours = preset === "24h" ? 24 : preset === "7d" ? 24 * 7 : preset === "90d" ? 24 * 90 : preset === "365d" ? 24 * 365 : 24 * 30;
    const untilDate = new Date();
    const sinceDate = new Date(untilDate.getTime() - hours * 60 * 60 * 1000);
    range = {
      preset: preset === "365d" ? "12m" : preset,
      start: utcDay(sinceDate),
      end: utcDay(untilDate),
      since: sinceDate.toISOString(),
      until: untilDate.toISOString(),
    };
  }

  let explicitComparison = null;
  if (compareFromParam || compareToParam) {
    if (!compareFromParam || !compareToParam) {
      throw new BusinessIntelligenceError(400, "Custom comparison requires compare_from and compare_to.", { code: "bi_invalid_comparison" });
    }
    const compareStart = parseDay(compareFromParam, "compare_from");
    const compareEnd = parseDay(compareToParam, "compare_to");
    if (compareStart > compareEnd) {
      throw new BusinessIntelligenceError(400, "compare_from must be on or before compare_to.", { code: "bi_invalid_comparison" });
    }
    explicitComparison = {
      preset: "custom_comparison",
      start: compareStart,
      end: compareEnd,
      since: `${compareStart}T00:00:00.000Z`,
      until: `${addDays(compareEnd, 1)}T00:00:00.000Z`,
    };
  }

  return {
    ...range,
    compare,
    granularity,
    map_metric: mapMetric,
    country,
    region,
    city,
    neighborhood,
    geo_id: geoId,
    category,
    category_id: categoryId,
    business_id: businessId,
    location_id: locationId,
    place_id: placeId,
    route_id: routeId,
    platform,
    source,
    compare_markets: compareMarkets,
    explicit_comparison: explicitComparison,
  };
}

function previousParams(params) {
  if (params.compare === "none") return null;
  if (params.explicit_comparison) return { ...params, ...params.explicit_comparison };
  if (params.compare === "previous_year") {
    const start = addDays(params.start, -365);
    const end = addDays(params.end, -365);
    return {
      ...params,
      preset: "previous_year",
      start,
      end,
      since: `${start}T00:00:00.000Z`,
      until: `${addDays(end, 1)}T00:00:00.000Z`,
    };
  }
  const startMs = Date.parse(params.since);
  const endMs = Date.parse(params.until);
  const duration = endMs - startMs;
  const previousUntil = new Date(startMs).toISOString();
  const previousSince = new Date(startMs - duration).toISOString();
  return {
    ...params,
    preset: "previous",
    start: utcDay(new Date(previousSince)),
    end: utcDay(new Date(startMs - 1)),
    since: previousSince,
    until: previousUntil,
  };
}

async function fetchEventsFrom(supabase, table, params, extended = false) {
  const rows = [];
  let offset = 0;
  let truncated = false;

  while (offset < MAX_EVENTS) {
    let query = supabase
      .from(table)
      .select(
        `event_id, event_name, entity_type, entity_id, user_id, anonymous_id, session_id, source, platform, locale, timezone, country, region, city, received_at, occurred_at, properties, context${extended ? ", source_type, source_id, geo_id" : ""}`,
      )
      .gte("received_at", params.since)
      .lt("received_at", params.until)
      .order("received_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    // `country` is coarse traveler origin. Destination market filtering is
    // applied against canonical geo_id/hierarchy after catalog enrichment.
    if (params.platform) query = query.eq("platform", params.platform);
    if (params.source) query = query.eq("source", params.source);
    if (extended && params.geo_ids?.length) query = query.in("geo_id", params.geo_ids);
    else if (extended && params.geo_id) query = query.eq("geo_id", params.geo_id);

    const { data, error } = await query;
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (offset >= MAX_EVENTS) {
      truncated = true;
      break;
    }
  }

  return { rows, truncated, fetched: rows.length };
}

async function fetchEventsInRange(supabase, params) {
  try {
    return await fetchEventsFrom(supabase, VALID_EVENTS_VIEW, params, true);
  } catch (error) {
    const code = String(error?.code || "").toUpperCase();
    const message = String(error?.message || "").toLowerCase();
    const viewMissing =
      code === "42P01" ||
      code === "PGRST205" ||
      message.includes("analytics_normalized_events") ||
      message.includes("analytics_valid_events");
    if (!viewMissing) throw error;
    const fallback = await fetchEventsFrom(supabase, EVENTS_TABLE, params, false);
    return { ...fallback, validity_view_missing: true };
  }
}

async function enrichRowsWithCatalogGeo(supabase, rows) {
  const placeIds = rows.filter((row) => row.entity_type === "place" && row.entity_id).map((row) => row.entity_id);
  const routeIds = rows.filter((row) => row.entity_type === "route" && row.entity_id).map((row) => row.entity_id);
  const places = await fetchEntityMeta(supabase, "places", placeIds);
  const routes = await fetchEntityMeta(supabase, "routes", routeIds);
  const placeDestinations = await fetchRecordsBy(
    supabase,
    "business_place_destination_geography",
    "place_id",
    placeIds,
  );
  const routeDestinations = await fetchRecordsBy(
    supabase,
    "business_route_destination_geography",
    "route_id",
    routeIds,
  );
  const geoIds = rows.map((row) => row.geo_id).filter(Boolean);
  const destinationHierarchy = await fetchRecordsBy(
    supabase,
    "business_destination_geo_hierarchy",
    "leaf_geo_id",
    geoIds,
  );

  return rows.map((row) => {
    const next = { ...row, properties: row.properties || {}, context: row.context || {} };
    const props = next.properties;
    next._origin_country = row.origin_country || row.country || null;
    next._origin_region = row.origin_region || row.region || null;
    next._origin_city = row.origin_city || row.city || null;

    let destination = row.geo_id ? destinationHierarchy.get(String(row.geo_id)) : null;
    if (!destination && row.entity_type === "place") destination = placeDestinations.get(String(row.entity_id));
    if (!destination && row.entity_type === "route") destination = routeDestinations.get(String(row.entity_id));
    next._destination_country = destination?.country_code || props.destination_country || props.target_country || null;
    next._destination_region = destination?.admin_level_1 || props.destination_region || props.target_region || null;
    next._destination_city = destination?.locality || props.destination_city || props.target_city || null;
    next._destination_neighborhood =
      destination?.sub_locality || props.destination_neighborhood || props.target_neighborhood || null;

    if (row.entity_type === "place" && row.entity_id && places.has(row.entity_id)) {
      const info = placeMeta(places.get(row.entity_id));
      next._place_country = destination?.country_code || (info.country ? normalizeCountryCode(info.country) : null);
      next._place_region = destination?.admin_level_1 || info.region;
      next._place_city = destination?.locality || info.city;
      next._place_neighborhood = destination?.sub_locality || info.neighborhood;
      next._category = info.category;
      if (info.lat != null) next._lat = info.lat;
      if (info.lng != null) next._lng = info.lng;
    }
    if (row.entity_type === "route" && row.entity_id && routes.has(row.entity_id)) {
      const info = routeMeta(routes.get(row.entity_id));
      next._category = info.category;
      next._place_country = destination?.country_code || null;
      next._place_region = destination?.admin_level_1 || null;
      next._place_city = destination?.locality || null;
      next._place_neighborhood = destination?.sub_locality || null;
    }

    const propLat = Number(props.lat ?? props.latitude);
    const propLng = Number(props.lng ?? props.longitude ?? props.lon);
    if (next._lat == null && Number.isFinite(propLat)) next._lat = propLat;
    if (next._lng == null && Number.isFinite(propLng)) next._lng = propLng;

    return next;
  });
}

function filterRows(rows, params) {
  return rows.filter((row) => {
    const country = marketCountry(row);
    const region = marketRegion(row);
    const city = marketCity(row);
    const neighborhood = marketNeighborhood(row);
    if (params.country && country !== params.country) return false;
    if (params.region && region !== params.region) return false;
    if (params.city && city !== params.city) return false;
    if (params.neighborhood && neighborhood !== params.neighborhood) return false;
    if (params.geo_ids?.length && !params.geo_ids.includes(row.geo_id)) return false;
    if (!params.geo_ids?.length && params.geo_id && row.geo_id !== params.geo_id) return false;
    if (params.platform && row.platform !== params.platform) return false;
    if (params.source && row.source !== params.source) return false;
    if (params.category || params.category_id) {
      const category = extractCategoryHint(row, { category: row._category });
      const selectedCategory = params.category_id || params.category;
      const normalizedCategory = String(category || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const normalizedSelected = String(selectedCategory || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!normalizedCategory || normalizedCategory !== normalizedSelected) return false;
    }
    if (Array.isArray(params.authorized_place_ids)) {
      if (params.authorized_place_ids.length === 0) return false;
      const directPlace = row.entity_type === "place" ? row.entity_id : null;
      const attributedPlace = row.properties?.place_id || row.properties?.target_place_id || null;
      if (!params.authorized_place_ids.includes(directPlace) && !params.authorized_place_ids.includes(attributedPlace)) return false;
    }
    if (params.place_id && !(row.entity_type === "place" && row.entity_id === params.place_id)) return false;
    if (params.route_id && !(row.entity_type === "route" && row.entity_id === params.route_id)) return false;
    return true;
  });
}

async function fetchEntityMeta(supabase, table, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map();
  if (!unique.length) return map;

  // Chunk to stay under PostgREST URL limits
  for (let i = 0; i < unique.length; i += 80) {
    const chunk = unique.slice(i, i + 80);
    const { data, error } = await supabase.from(table).select("*").in("id", chunk);
    if (error || !data) continue;
    for (const row of data) {
      map.set(String(row.id), row);
    }
  }
  return map;
}

async function fetchRecordsBy(supabase, table, key, ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  const map = new Map();
  if (!unique.length) return map;
  for (let index = 0; index < unique.length; index += 80) {
    const chunk = unique.slice(index, index + 80);
    const { data, error } = await supabase.from(table).select("*").in(key, chunk);
    if (error) throw error;
    if (!data) continue;
    for (const row of data) map.set(String(row[key]), row);
  }
  return map;
}

function placeMeta(row) {
  if (!row) {
    return { name: null, category: null, city: null, region: null, country: null, neighborhood: null, rating: null, lat: null, lng: null };
  }
  const lat = Number(firstField(row, ["lat", "latitude", "geo_lat"]));
  const lng = Number(firstField(row, ["lng", "lon", "longitude", "geo_lng"]));
  return {
    name: firstField(row, ["place_name", "name", "title"]),
    category: firstField(row, ["category", "category_name", "type"]),
    city: firstField(row, ["city", "locality", "municipality"]),
    region: firstField(row, ["region", "state", "province", "departamento", "department"]),
    country: firstField(row, ["country", "country_code"]),
    neighborhood: firstField(row, ["neighborhood", "neighbourhood", "area", "district", "barrio"]),
    rating: firstField(row, ["rating", "avg_rating", "average_rating"]),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

function routeMeta(row) {
  if (!row) return { name: null, category: null, stops: null };
  const stops =
    firstField(row, ["stops_count", "stop_count", "places_count"]) ??
    (Array.isArray(row.stops) ? row.stops.length : Array.isArray(row.place_ids) ? row.place_ids.length : null);
  return {
    name: firstField(row, ["name", "title"]),
    category: firstField(row, ["category", "category_name", "type"]),
    stops: typeof stops === "number" ? stops : Number(stops) || null,
  };
}

function videoMeta(row) {
  if (!row) return { name: null };
  return { name: firstField(row, ["title", "caption", "description", "name"]) };
}

export function computeKpis(rows) {
  return calculateCanonicalKpis(rows);
}

function kpiDefinitions() {
  const canonical = metricDefinitionsForClient().metrics;
  return {
    active_users: canonical.active_travelers.description,
    active_travelers: canonical.active_travelers.description,
    sessions: canonical.sessions.description,
    place_discoveries: canonical.place_discoveries.description,
    place_views: canonical.place_views.description,
    route_views: canonical.route_views.description,
    route_starts: canonical.route_starts.description,
    route_completions: canonical.route_completions.description,
    saves: canonical.saves.description,
    shares: canonical.shares.description,
    commercial_intent: canonical.commercial_actions.description,
    commercial_actions: canonical.commercial_actions.description,
    intent_rate: canonical.intent_rate.description,
  };
}

function buildGeography(rows, params, mapMetric, previousRows = []) {
  const level = params.neighborhood
    ? "neighborhood"
    : params.city
      ? "city"
      : params.region
        ? "region"
        : params.country
          ? "country"
          : "global";
  const childKey =
    level === "global" ? "country" : level === "country" ? "region" : level === "region" ? "city" : "neighborhood";
  const childLabel =
    level === "global"
      ? "Country"
      : level === "country"
        ? regionLabelFor(params.country)
        : level === "region"
          ? "City"
          : "Neighborhood / Area";

  const buckets = new Map();
  for (const row of rows) {
    let key = null;
    if (childKey === "country") key = marketCountry(row);
    else if (childKey === "region") key = marketRegion(row);
    else if (childKey === "city") key = marketCity(row);
    else key = marketNeighborhood(row);
    if (!key) continue;

    const current = buckets.get(key) || {
      key,
      label: childKey === "country" ? countryLabel(key) : key,
      events: 0,
      users: new Set(),
      sessions: new Set(),
      place_views: 0,
      route_views: 0,
      intent: 0,
      saves: 0,
      searches: 0,
      supply: new Set(),
      latSum: 0,
      lngSum: 0,
      geoCount: 0,
    };
    current.events += 1;
    if (row.user_id) current.users.add(`u:${row.user_id}`);
    else if (row.anonymous_id) current.users.add(`a:${row.anonymous_id}`);
    if (row.session_id) current.sessions.add(row.session_id);
    if (isPlaceView(row)) current.place_views += 1;
    if (isRouteView(row)) current.route_views += 1;
    if (PLACE_COMMERCE_EVENTS.has(row.event_name)) current.intent += 1;
    if (SAVE_EVENTS.has(row.event_name)) current.saves += 1;
    if (isSearchEvent(row)) current.searches += 1;
    if (["place", "route"].includes(row.entity_type) && row.entity_id) current.supply.add(`${row.entity_type}:${row.entity_id}`);
    const point = eventLatLng(row);
    if (point) {
      current.latSum += point.lat;
      current.lngSum += point.lng;
      current.geoCount += 1;
    }
    buckets.set(key, current);
  }

  const previousCounts = new Map();
  for (const row of previousRows) {
    let key = null;
    if (childKey === "country") key = marketCountry(row);
    else if (childKey === "region") key = marketRegion(row);
    else if (childKey === "city") key = marketCity(row);
    else key = marketNeighborhood(row);
    if (key) previousCounts.set(key, (previousCounts.get(key) || 0) + 1);
  }

  const children = [...buckets.values()]
    .filter((item) => item.events >= LOCATION_MIN_EVENTS)
    .map((item) => {
      const users = item.users.size;
      const sessions = item.sessions.size;
      return {
        key: item.key,
        label: item.label,
        level: childKey,
        events: item.events,
        users,
        sessions,
        place_views: item.place_views,
        route_views: item.route_views,
        intent: item.intent,
        saves: item.saves,
        searches: item.searches,
        demand: users + item.place_views + item.route_views + item.intent + item.saves + item.searches,
        supply: item.supply.size,
        previous_events: previousCounts.get(item.key) || 0,
        growth_pct:
          (previousCounts.get(item.key) || 0) >= MOVER_MIN_PREVIOUS
            ? periodDelta(item.events, previousCounts.get(item.key) || 0).percent
            : null,
        metric: 0,
        share_pct: null,
        lat: item.geoCount ? item.latSum / item.geoCount : null,
        lng: item.geoCount ? item.lngSum / item.geoCount : null,
      };
    })
    .slice(0, 25);

  function cohortRank(value, values, inverse = false) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return null;
    if (sorted.length === 1) return 50;
    const below = sorted.filter((item) => item < value).length;
    const score = Math.round((below / (sorted.length - 1)) * 100);
    return inverse ? 100 - score : score;
  }

  const demandValues = children.map((item) => item.demand);
  const supplyValues = children.map((item) => item.supply);
  for (const child of children) {
    child.demand_index = cohortRank(child.demand, demandValues);
    child.supply_index = cohortRank(child.supply, supplyValues);
    child.opportunity_score = Math.round((child.demand_index + cohortRank(child.supply, supplyValues, true)) / 2);
    if (mapMetric === "users") child.metric = child.users;
    else if (mapMetric === "place_views") child.metric = child.place_views;
    else if (mapMetric === "route_views") child.metric = child.route_views;
    else if (mapMetric === "intent") child.metric = child.intent;
    else if (mapMetric === "saves") child.metric = child.saves;
    else if (mapMetric === "searches") child.metric = child.searches;
    else if (mapMetric === "growth") child.metric = child.growth_pct ?? 0;
    else if (mapMetric === "supply") child.metric = child.supply_index;
    else if (mapMetric === "opportunity") child.metric = child.opportunity_score;
    else if (mapMetric === "demand") child.metric = child.demand_index;
    else child.metric = child.events;
  }
  children.sort((a, b) => b.metric - a.metric);

  const totalMetric = children.reduce((sum, item) => sum + Math.abs(item.metric), 0) || 1;
  for (const child of children) {
    child.share_pct = Math.round((Math.abs(child.metric) / totalMetric) * 1000) / 10;
  }

  const breadcrumb = [{ level: "global", key: null, label: "Global" }];
  if (params.country) breadcrumb.push({ level: "country", key: params.country, label: countryLabel(params.country) });
  if (params.region) breadcrumb.push({ level: "region", key: params.region, label: params.region });
  if (params.city) breadcrumb.push({ level: "city", key: params.city, label: params.city });
  if (params.neighborhood) breadcrumb.push({ level: "neighborhood", key: params.neighborhood, label: params.neighborhood });

  return {
    level,
    child_level: childKey,
    child_label: childLabel,
    region_terminology: params.country ? regionLabelFor(params.country) : "Region",
    breadcrumb,
    children,
    map_metric: mapMetric,
    missing_child_geo: rows.length > 0 && children.length === 0,
  };
}

function buildCommerceFunnel(rows) {
  const impressions = rows.filter((row) => row.event_name === "place_impression" || isPlaceView(row)).length;
  const views = rows.filter(isPlaceView).length;
  const saves = rows.filter((row) => row.event_name === "place_save").length;
  const actions = rows.filter((row) => PLACE_COMMERCE_EVENTS.has(row.event_name)).length;
  const steps = [
    { key: "discovery", label: "Place impression / discovery", count: impressions || views },
    { key: "view", label: "Place view", count: views },
    { key: "save", label: "Save", count: saves },
    { key: "commercial", label: "Directions / Call / Website", count: actions },
  ];
  return steps.map((step, index) => ({
    ...step,
    dropoff_pct: index === 0 ? 0 : rate(steps[index - 1].count - step.count, steps[index - 1].count) || 0,
    conversion_from_previous: index === 0 ? null : rate(step.count, steps[index - 1].count),
  }));
}

function buildTimeseries(rows, granularity) {
  const buckets = new Map();
  for (const row of rows) {
    const iso = row.received_at || row.occurred_at;
    if (!iso) continue;
    const day = String(iso).slice(0, 10);
    let key = day;
    if (granularity === "monthly") key = day.slice(0, 7);
    if (granularity === "weekly") {
      const date = new Date(`${day}T00:00:00.000Z`);
      const week = Math.floor((date.getUTCDate() - 1) / 7) + 1;
      key = `${day.slice(0, 7)}-W${week}`;
    }
    const current = buckets.get(key) || {
      period: key,
      users: new Set(),
      sessions: new Set(),
      place_views: 0,
      route_views: 0,
      searches: 0,
      saves: 0,
      commercial_actions: 0,
    };
    if (row.user_id) current.users.add(`u:${row.user_id}`);
    else if (row.anonymous_id) current.users.add(`a:${row.anonymous_id}`);
    if (row.session_id) current.sessions.add(row.session_id);
    if (isPlaceView(row)) current.place_views += 1;
    if (isRouteView(row)) current.route_views += 1;
    if (isSearchEvent(row)) current.searches += 1;
    if (SAVE_EVENTS.has(row.event_name)) current.saves += 1;
    if (PLACE_COMMERCE_EVENTS.has(row.event_name)) current.commercial_actions += 1;
    buckets.set(key, current);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, bucket]) => ({
      period: bucket.period,
      users: bucket.users.size,
      sessions: bucket.sessions.size,
      place_views: bucket.place_views,
      route_views: bucket.route_views,
      searches: bucket.searches,
      saves: bucket.saves,
      commercial_actions: bucket.commercial_actions,
    }));
}

function buildPeakDemand(rows) {
  const matrix = {
    morning: [0, 0, 0, 0, 0, 0, 0],
    afternoon: [0, 0, 0, 0, 0, 0, 0],
    evening: [0, 0, 0, 0, 0, 0, 0],
    night: [0, 0, 0, 0, 0, 0, 0],
  };
  const byHour = Array.from({ length: 24 }, () => 0);
  let tracked = 0;
  for (const row of rows) {
    const iso = row.occurred_at || row.received_at;
    const local = localTimeBuckets(iso, row.timezone);
    const hour = local?.hour;
    const weekday = local?.weekday;
    if (hour == null || weekday == null) continue;
    const part = daypart(hour);
    matrix[part][weekday] += 1;
    byHour[hour] += 1;
    tracked += 1;
  }
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const averageWindow = tracked / 28;
  let peakWindow = null;
  for (const [part, values] of Object.entries(matrix)) {
    values.forEach((value, weekday) => {
      if (!peakWindow || value > peakWindow.sample_size) {
        peakWindow = {
          day: weekdays[weekday],
          daypart: part,
          label: `${weekdays[weekday]} ${part}`,
          sample_size: value,
          above_average_pct: averageWindow > 0 ? Math.round(((value - averageWindow) / averageWindow) * 100) : 0,
        };
      }
    });
  }
  return {
    available: tracked > 0,
    weekdays,
    dayparts: ["morning", "afternoon", "evening", "night"],
    matrix,
    by_hour: byHour,
    tracked_events: tracked,
    peak_window: peakWindow && peakWindow.sample_size > 0 ? peakWindow : null,
    timezone_basis: "event_timezone_with_UTC_fallback",
  };
}

function rowsForGeoChild(rows, child) {
  return rows.filter((row) => {
    if (child.level === "country") return marketCountry(row) === child.key;
    if (child.level === "region") return marketRegion(row) === child.key;
    if (child.level === "city") return marketCity(row) === child.key;
    return marketNeighborhood(row) === child.key;
  });
}

function buildMarketComparisons(currentRows, previousRows, geography, selectedMarkets = []) {
  const selected = selectedMarkets.length
    ? geography.children.filter((child) => selectedMarkets.includes(child.key) || selectedMarkets.includes(child.label))
    : geography.children.slice(0, 5);
  return selected.map((child) => {
    const current = rowsForGeoChild(currentRows, child);
    const previous = rowsForGeoChild(previousRows, child);
    const kpis = computeKpis(current);
    const prior = computeKpis(previous);
    const demand = calculateDemandIndex(kpis, prior);
    const weekend = current.filter((row) => {
      const local = localTimeBuckets(row.occurred_at || row.received_at, row.timezone);
      return local?.weekday === 0 || local?.weekday === 6;
    }).length;
    const restaurant = current.filter((row) => /restaurant|food|cafe|coffee|dining/i.test(extractCategoryHint(row, { category: row._category }) || ""));
    return {
      key: child.key,
      label: child.label,
      level: child.level,
      demand_index: demand.score,
      demand_status: demand.status,
      demand_growth_pct: periodDelta(kpis.active_users, prior.active_users).reliable
        ? periodDelta(kpis.active_users, prior.active_users).percent
        : null,
      restaurant_intent_share_pct: rate(
        restaurant.filter((row) => PLACE_COMMERCE_EVENTS.has(row.event_name)).length,
        kpis.commercial_intent,
      ),
      route_activity_share_pct: rate(kpis.route_views + kpis.route_starts, current.length),
      weekend_demand_pct: rate(weekend, current.length),
      sample_size: current.length,
    };
  });
}

function aggregateEntities(rows, entityType) {
  const groups = new Map();
  for (const row of rows) {
    if (row.entity_type !== entityType || !row.entity_id) continue;
    const current = groups.get(row.entity_id) || {
      entity_id: row.entity_id,
      views: 0,
      impressions: 0,
      saves: 0,
      shares: 0,
      likes: 0,
      route_starts: 0,
      route_completes: 0,
      intent: 0,
      directions: 0,
      calls: 0,
      website_clicks: 0,
      users: new Set(),
    };
    if (isPlaceView(row) || isRouteView(row) || VIEW_EVENTS.has(row.event_name)) current.views += 1;
    if (IMPRESSION_EVENTS.has(row.event_name)) current.impressions += 1;
    if (SAVE_EVENTS.has(row.event_name)) current.saves += 1;
    if (SHARE_EVENTS.has(row.event_name)) current.shares += 1;
    if (/_like$/.test(row.event_name || "")) current.likes += 1;
    if (row.event_name === "route_start") current.route_starts += 1;
    if (row.event_name === "route_complete") current.route_completes += 1;
    if (PLACE_COMMERCE_EVENTS.has(row.event_name)) current.intent += 1;
    if (row.event_name === "place_get_directions") current.directions += 1;
    if (row.event_name === "place_call") current.calls += 1;
    if (row.event_name === "place_website_click") current.website_clicks += 1;
    if (row.user_id) current.users.add(`u:${row.user_id}`);
    else if (row.anonymous_id) current.users.add(`a:${row.anonymous_id}`);
    groups.set(row.entity_id, current);
  }
  return [...groups.values()];
}

function discoverySource(row) {
  const props = row?.properties || {};
  const context = row?.context || {};
  const raw =
    row?.source_type ||
    props.discovery_source ||
    props.source_type ||
    props.entry_point ||
    props.referrer ||
    context.discovery_source ||
    context.source_type ||
    context.entry_point ||
    null;
  const value = String(raw || "").trim().toLowerCase();
  const known = new Set(["search", "map", "feed", "video", "route", "recommendation", "profile", "direct_link"]);
  return known.has(value) ? value : "other";
}

function entitySourceMix(rows, entityType, entityId) {
  const counts = new Map();
  for (const row of rows) {
    if (row.entity_type !== entityType || row.entity_id !== entityId) continue;
    if (!(isPlaceView(row) || isRouteView(row) || VIEW_EVENTS.has(row.event_name))) continue;
    const source = discoverySource(row);
    counts.set(source, (counts.get(source) || 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0) || 1;
  return [...counts.entries()]
    .map(([source, count]) => ({ source, count, share_pct: Math.round((count / total) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count);
}

function routeAttributionId(row) {
  const props = row?.properties || {};
  const context = row?.context || {};
  const sourceType = row?.source_type || props.source_type || context.source_type;
  return (
    props.route_id ||
    props.from_route_id ||
    props.source_route_id ||
    context.route_id ||
    context.from_route_id ||
    (sourceType === "route" ? row?.source_id || props.source_id || context.source_id : null) ||
    null
  );
}

function buildRouteJourney(rows, routeId) {
  const routeRows = rows.filter((row) => row.entity_type === "route" && row.entity_id === routeId);
  const starts = routeRows.filter((row) => row.event_name === "route_start");
  const stopGroups = new Map();
  for (const row of routeRows) {
    if (!["route_stop_view", "route_step_view"].includes(row.event_name)) continue;
    const props = row.properties || {};
    const stopIndex = Number(props.stop_index ?? props.step_index ?? props.position);
    const stopId = props.stop_id || props.place_id || `stop-${Number.isFinite(stopIndex) ? stopIndex : stopGroups.size + 1}`;
    const key = String(stopId);
    const current = stopGroups.get(key) || {
      stop_id: key,
      stop_index: Number.isFinite(stopIndex) ? stopIndex : stopGroups.size + 1,
      stop_name: props.stop_name || props.place_name || `Stop ${Number.isFinite(stopIndex) ? stopIndex + 1 : stopGroups.size + 1}`,
      actors: new Set(),
      events: 0,
    };
    current.events += 1;
    const actor = row.user_id || row.anonymous_id || row.session_id;
    if (actor) current.actors.add(actor);
    stopGroups.set(key, current);
  }
  const startActors = new Set(starts.map((row) => row.user_id || row.anonymous_id || row.session_id).filter(Boolean));
  const denominator = Math.max(startActors.size, starts.length, 1);
  let previousReach = 100;
  const dropoff = [...stopGroups.values()]
    .sort((a, b) => a.stop_index - b.stop_index)
    .map((stop) => {
      const visitors = Math.max(stop.actors.size, stop.events);
      const reach = Math.min(100, rate(visitors, denominator) || 0);
      const drop = Math.max(0, Math.round((previousReach - reach) * 10) / 10);
      previousReach = reach;
      return {
        stop_id: stop.stop_id,
        stop_index: stop.stop_index,
        stop_name: stop.stop_name,
        visitors,
        reach_pct: reach,
        dropoff_from_previous_pct: drop,
      };
    });
  const majorDrop = [...dropoff].sort((a, b) => b.dropoff_from_previous_pct - a.dropoff_from_previous_pct)[0] || null;

  const attributed = rows.filter((row) => routeAttributionId(row) === routeId);
  return {
    funnel: {
      discovery: routeRows.filter((row) => row.event_name === "route_impression").length,
      views: routeRows.filter(isRouteView).length,
      saves: routeRows.filter((row) => row.event_name === "route_save").length,
      starts: starts.length,
      stops_visited: dropoff.reduce((sum, stop) => sum + stop.visitors, 0),
      completes: routeRows.filter((row) => row.event_name === "route_complete").length,
      commercial_actions: attributed.filter((row) => PLACE_COMMERCE_EVENTS.has(row.event_name)).length,
    },
    dropoff,
    major_drop: majorDrop && majorDrop.dropoff_from_previous_pct >= 15 ? majorDrop : null,
    dropoff_status: dropoff.length ? "ready" : starts.length ? "missing_tracking" : "zero",
    generated: {
      place_saves: attributed.filter((row) => row.event_name === "place_save").length,
      directions: attributed.filter((row) => row.event_name === "place_get_directions").length,
      website_clicks: attributed.filter((row) => row.event_name === "place_website_click").length,
      calls: attributed.filter((row) => row.event_name === "place_call").length,
    },
  };
}

function applyCategoryFilter(items, category, metaById, kind) {
  if (!category) return items;
  return items.filter((item) => {
    const meta = kind === "place" ? placeMeta(metaById.get(item.entity_id)) : routeMeta(metaById.get(item.entity_id));
    return String(meta.category || "").toLowerCase() === category.toLowerCase();
  });
}

async function enrichPlaces(supabase, rows, previousRows, params) {
  const current = aggregateEntities(rows, "place");
  const previous = new Map(aggregateEntities(previousRows || [], "place").map((item) => [item.entity_id, item]));
  const meta = await fetchEntityMeta(
    supabase,
    "places",
    current.map((item) => item.entity_id),
  );
  let items = current.map((item) => {
    const info = placeMeta(meta.get(item.entity_id));
    const prev = previous.get(item.entity_id);
    const delta = buildDelta(item.views, prev?.views || 0);
    const unknown = !info.name;
    return {
      place_id: item.entity_id,
      place_name: info.name || "Unknown place",
      name_resolved: Boolean(info.name),
      category: info.category || "Uncategorized",
      location: [info.city, info.region, info.country].filter(Boolean).join(", ") || null,
      city: info.city,
      region: info.region,
      country: info.country,
      views: item.views,
      unique_visitors: item.users.size,
      saves: item.saves,
      shares: item.shares,
      likes: item.likes,
      actions: item.intent,
      directions: item.directions,
      calls: item.calls,
      website_clicks: item.website_clicks,
      intent_rate: rate(item.intent, item.views),
      rating: info.rating == null ? null : Number(info.rating),
      trend_pct: prev && prev.views >= MOVER_MIN_PREVIOUS ? delta.percent : null,
      discovery_sources: entitySourceMix(rows, "place", item.entity_id),
      peak_demand: buildPeakDemand(rows.filter((row) => row.entity_type === "place" && row.entity_id === item.entity_id)).peak_window,
      data_quality: unknown ? "missing_name" : "ok",
    };
  });
  items = applyCategoryFilter(items, params.category, meta, "place");
  items.sort((a, b) => b.views - a.views || b.actions - a.actions);
  const missingNames = items.filter((item) => !item.name_resolved).length;
  return {
    places: items.slice(0, 50),
    warnings: missingNames
      ? [warning("place_names_missing", `${missingNames} place(s) missing catalog name metadata.`, "info")]
      : [],
  };
}

async function enrichRoutes(supabase, rows, previousRows, params) {
  const current = aggregateEntities(rows, "route");
  const previous = new Map(aggregateEntities(previousRows || [], "route").map((item) => [item.entity_id, item]));
  const meta = await fetchEntityMeta(
    supabase,
    "routes",
    current.map((item) => item.entity_id),
  );
  let items = current.map((item) => {
    const info = routeMeta(meta.get(item.entity_id));
    const prev = previous.get(item.entity_id);
    const delta = buildDelta(item.views, prev?.views || 0);
    const journey = buildRouteJourney(rows, item.entity_id);
    return {
      route_id: item.entity_id,
      route_name: info.name || "Unknown route",
      name_resolved: Boolean(info.name),
      category: info.category || "Uncategorized",
      area: params.city || params.region || (params.country ? countryLabel(params.country) : null),
      stops: info.stops,
      views: item.views,
      saves: item.saves,
      shares: item.shares,
      starts: item.route_starts,
      completes: item.route_completes,
      completion_rate: rate(item.route_completes, item.route_starts),
      commercial_actions: item.intent + journey.funnel.commercial_actions,
      intent_rate: rate(item.intent + journey.funnel.commercial_actions, item.views),
      trend_pct: prev && prev.views >= MOVER_MIN_PREVIOUS ? delta.percent : null,
      discovery_sources: entitySourceMix(rows, "route", item.entity_id),
      funnel: journey.funnel,
      dropoff: journey.dropoff,
      major_drop: journey.major_drop,
      dropoff_status: journey.dropoff_status,
      generated: journey.generated,
      data_quality: info.name ? "ok" : "missing_name",
    };
  });
  items = applyCategoryFilter(items, params.category, meta, "route");
  items.sort((a, b) => b.views - a.views || b.starts - a.starts);
  const missingNames = items.filter((item) => !item.name_resolved).length;
  return {
    routes: items.slice(0, 50),
    warnings: missingNames
      ? [warning("route_names_missing", `${missingNames} route(s) missing catalog name metadata.`, "info")]
      : [],
  };
}

function aggregateCategories(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!(isPlaceView(row) || isRouteView(row) || row.entity_type === "place" || row.entity_type === "route" || SEARCH_EVENTS.has(row.event_name))) continue;
    const hint = extractCategoryHint(row, { category: row._category });
    const key = hint ? String(hint) : "Uncategorized";
    const current = groups.get(key) || {
      category: key,
      demand: 0,
      views: 0,
      saves: 0,
      intent: 0,
      searches: 0,
      supply: new Set(),
    };
    current.demand += 1;
    if (isPlaceView(row) || isRouteView(row)) current.views += 1;
    if (SAVE_EVENTS.has(row.event_name)) current.saves += 1;
    if (PLACE_COMMERCE_EVENTS.has(row.event_name)) current.intent += 1;
    if (isSearchEvent(row)) current.searches += 1;
    if (["place", "route"].includes(row.entity_type) && row.entity_id) current.supply.add(`${row.entity_type}:${row.entity_id}`);
    groups.set(key, current);
  }
  return groups;
}

async function buildCategories(_supabase, rows, previousRows = []) {
  const current = aggregateCategories(rows);
  const previous = aggregateCategories(previousRows);
  const total = [...current.values()].reduce((sum, item) => sum + item.demand, 0) || 1;
  const categories = [...current.values()].map((item) => {
    const prior = previous.get(item.category);
    const delta = periodDelta(item.demand, prior?.demand || 0);
    return {
      category: item.category,
      count: item.demand,
      demand: item.demand,
      previous_demand: prior?.demand || 0,
      share_pct: Math.round((item.demand / total) * 1000) / 10,
      growth_pct: delta.reliable ? delta.percent : null,
      supply: item.supply.size,
      views: item.views,
      searches: item.searches,
      saves: item.saves,
      intent: item.intent,
      intent_rate: rate(item.intent, item.views),
      save_rate: rate(item.saves, item.views),
    };
  });
  return enrichCategoryIntelligence(categories)
    .sort((a, b) => b.demand - a.demand)
    .slice(0, 20);
}

function extractQueryHash(row) {
  const props = row?.properties || {};
  const context = row?.context || {};
  return props.query_hash || props.search_hash || props.search_query_hash || context.query_hash || null;
}

function extractDisplayQuery(row) {
  const props = row?.properties || {};
  // Prefer client-normalized labels; raw query only used for k-anonymous aggregation below.
  const normalized = props.query_normalized || props.normalized_query || props.search_label || props.search_term_normalized;
  if (normalized && String(normalized).trim()) return String(normalized).trim().slice(0, 80);
  const raw = props.query || props.search_query || props.raw_query || props.q;
  if (raw && String(raw).trim()) return String(raw).trim().slice(0, 80);
  return null;
}

function extractResultCount(row) {
  const props = row?.properties || {};
  const value = Number(props.result_count ?? props.results_count ?? props.total_results ?? props.matches);
  return Number.isFinite(value) ? value : null;
}

function buildSearches(rows, previousRows = []) {
  const submitted = rows.filter((row) => ["search_performed", "search_submitted"].includes(row.event_name));
  const noResults = rows.filter((row) => row.event_name === "search_no_results");
  const clicks = rows.filter((row) => row.event_name === "search_result_clicked");
  const attributed = rows.filter((row) => isPlaceView(row) || PLACE_COMMERCE_EVENTS.has(row.event_name));

  const byKey = new Map();
  let missingHash = 0;
  for (const row of [...submitted, ...noResults, ...clicks, ...attributed]) {
    const hash = extractQueryHash(row);
    const display = extractDisplayQuery(row);
    const key = hash || (display ? `text:${display.toLowerCase()}` : null);
    if (!key) {
      missingHash += 1;
      continue;
    }
    const current = byKey.get(key) || {
      query_hash: hash,
      display_query: null,
      count: 0,
      no_results: 0,
      result_clicks: 0,
      place_conversions: 0,
      intent_conversions: 0,
      result_count_sum: 0,
      result_count_n: 0,
    };
    if (["search_performed", "search_submitted"].includes(row.event_name)) current.count += 1;
    if (row.event_name === "search_no_results") current.no_results += 1;
    if (row.event_name === "search_result_clicked") current.result_clicks += 1;
    if (isPlaceView(row)) current.place_conversions += 1;
    if (PLACE_COMMERCE_EVENTS.has(row.event_name)) current.intent_conversions += 1;
    if (display) current.display_query = display;
    const resultCount = extractResultCount(row);
    if (resultCount != null) {
      current.result_count_sum += resultCount;
      current.result_count_n += 1;
    }
    byKey.set(key, current);
  }

  const top = [...byKey.values()]
    .map((item) => {
      const canShowText = Boolean(item.display_query) && item.count >= SEARCH_DISPLAY_MIN;
      return {
        query_hash: item.query_hash,
        label: canShowText
          ? item.display_query
          : item.query_hash
            ? `Search ${String(item.query_hash).slice(0, 6)}…`
            : "Search (unlabeled)",
        display_query: canShowText ? item.display_query : null,
        count: item.count,
        no_results: item.no_results,
        result_clicks: item.result_clicks,
        ctr: rate(item.result_clicks, item.count),
        conversion_to_place: rate(item.place_conversions, item.count),
        conversion_to_intent: rate(item.intent_conversions, item.count),
        avg_results:
          item.result_count_n > 0 ? Math.round((item.result_count_sum / item.result_count_n) * 10) / 10 : null,
        text_visible: canShowText,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const lowSupply = [...byKey.values()]
    .map((item) => {
      const avgResults = item.result_count_n > 0 ? item.result_count_sum / item.result_count_n : null;
      const canShowText = Boolean(item.display_query) && item.count >= SEARCH_DISPLAY_MIN;
      const isLow =
        item.no_results >= SEARCH_DISPLAY_MIN ||
        (avgResults != null && avgResults <= 2 && item.count >= SEARCH_DISPLAY_MIN);
      if (!isLow) return null;
      return {
        signal: "low_supply",
        label: canShowText ? item.display_query : item.query_hash ? `Search ${String(item.query_hash).slice(0, 6)}…` : "Unlabeled search",
        searches: item.count,
        matching_places: avgResults == null ? null : Math.round(avgResults),
        no_results: item.no_results,
        opportunity: item.count >= 30 && (item.no_results >= item.count * 0.5 || (avgResults != null && avgResults <= 2)) ? "High" : "Medium",
        detail:
          avgResults != null
            ? `${item.count} searches · ~${Math.round(avgResults)} matching results`
            : `${item.count} searches · ${item.no_results} no-result events`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.searches - a.searches)
    .slice(0, 10);

  const entityTypeCounts = new Map();
  for (const row of clicks) {
    const type = row.entity_type || row.properties?.entity_type || "unknown";
    entityTypeCounts.set(type, (entityTypeCounts.get(type) || 0) + 1);
  }

  return {
    summary: {
      total_searches: submitted.length,
      no_result_searches: noResults.length,
      result_clicks: clicks.length,
      search_ctr: rate(clicks.length, submitted.length),
      missing_query_hash: missingHash,
      text_visibility_threshold: SEARCH_DISPLAY_MIN,
      growth_pct:
        previousRows.filter((row) => ["search_performed", "search_submitted"].includes(row.event_name)).length >= MOVER_MIN_PREVIOUS
          ? periodDelta(
              submitted.length,
              previousRows.filter((row) => ["search_performed", "search_submitted"].includes(row.event_name)).length,
            ).percent
          : null,
    },
    top_searches: top,
    low_supply: lowSupply,
    click_entity_types: [...entityTypeCounts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count),
    available: submitted.length > 0 || noResults.length > 0,
    privacy_note: `Query text is shown only when the same term appears ≥${SEARCH_DISPLAY_MIN} times in-period (k-anonymity). Prefer properties.query_normalized from clients.`,
  };
}

function explicitSourceContentId(row) {
  const props = row?.properties || {};
  const context = row?.context || {};
  return (
    (["video", "post", "content", "creator"].includes(row?.source_type) ? row?.source_id : null) ||
    props.from_video_id ||
    props.video_id ||
    props.source_content_id ||
    props.content_id ||
    props.referrer_entity_id ||
    props.from_entity_id ||
    context.from_video_id ||
    context.source_content_id ||
    null
  );
}

function eventTimeMs(row) {
  const iso = row.occurred_at || row.received_at;
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : 0;
}

async function buildContentAttribution(supabase, rows) {
  const attribution = new Map();

  function touch(contentId, field, amount = 1) {
    if (!contentId) return;
    const current = attribution.get(contentId) || {
      content_id: contentId,
      views: 0,
      impressions: 0,
      saves: 0,
      place_visits: 0,
      route_visits: 0,
      intent: 0,
      directions: 0,
      attribution_paths: 0,
      explicit_links: 0,
    };
    current[field] += amount;
    attribution.set(contentId, current);
  }

  // Direct video engagement counts
  for (const row of rows) {
    if (row.entity_type === "video" && row.entity_id && VIDEO_ENGAGEMENT_EVENTS.has(row.event_name)) {
      if (row.event_name === "video_impression") touch(row.entity_id, "impressions");
      else if (SAVE_EVENTS.has(row.event_name)) touch(row.entity_id, "saves");
      else touch(row.entity_id, "views");
    }
    if (row.event_name === "video_open_places_routes" && row.entity_id) {
      touch(row.entity_id, "explicit_links");
    }
  }

  // Explicit property links on place/route/commerce events
  for (const row of rows) {
    const source = explicitSourceContentId(row);
    if (!source) continue;
    if (isPlaceView(row) || row.event_name === "place_click") {
      touch(source, "place_visits");
      touch(source, "explicit_links");
    } else if (isRouteView(row) || row.event_name === "route_click" || row.event_name === "route_start") {
      touch(source, "route_visits");
      touch(source, "explicit_links");
    } else if (PLACE_COMMERCE_EVENTS.has(row.event_name)) {
      touch(source, "intent");
      if (row.event_name === "place_get_directions") touch(source, "directions");
      touch(source, "explicit_links");
    } else if (SAVE_EVENTS.has(row.event_name) && (row.entity_type === "place" || row.entity_type === "route")) {
      touch(source, "saves");
      touch(source, "explicit_links");
    }
  }

  // Session click-path: last video in session → later place/route/commerce
  const bySession = new Map();
  for (const row of rows) {
    if (!row.session_id) continue;
    const list = bySession.get(row.session_id) || [];
    list.push(row);
    bySession.set(row.session_id, list);
  }
  for (const list of bySession.values()) {
    list.sort((a, b) => eventTimeMs(a) - eventTimeMs(b));
    let lastVideo = null;
    for (const row of list) {
      if (row.entity_type === "video" && row.entity_id && VIDEO_ENGAGEMENT_EVENTS.has(row.event_name)) {
        lastVideo = row.entity_id;
        continue;
      }
      if (!lastVideo) continue;
      if (isPlaceView(row) || row.event_name === "place_click") {
        touch(lastVideo, "place_visits");
        touch(lastVideo, "attribution_paths");
      } else if (isRouteView(row) || row.event_name === "route_click" || row.event_name === "route_start") {
        touch(lastVideo, "route_visits");
        touch(lastVideo, "attribution_paths");
      } else if (PLACE_COMMERCE_EVENTS.has(row.event_name)) {
        touch(lastVideo, "intent");
        if (row.event_name === "place_get_directions") touch(lastVideo, "directions");
        touch(lastVideo, "attribution_paths");
      } else if (SAVE_EVENTS.has(row.event_name) && (row.entity_type === "place" || row.entity_type === "route")) {
        touch(lastVideo, "saves");
        touch(lastVideo, "attribution_paths");
      }
    }
  }

  const meta = await fetchEntityMeta(
    supabase,
    "videos",
    [...attribution.keys()],
  );

  const items = [...attribution.values()]
    .map((item) => {
      const info = videoMeta(meta.get(item.content_id));
      const method =
        item.explicit_links > 0 ? "explicit_property" : item.attribution_paths > 0 ? "session_path" : "content_only";
      return {
        content_id: item.content_id,
        content_name: info.name || "Unknown content",
        name_resolved: Boolean(info.name),
        views: item.views,
        impressions: item.impressions,
        saves: item.saves,
        place_visits: item.place_visits,
        route_visits: item.route_visits,
        intent_actions: item.intent,
        directions: item.directions,
        attribution: method,
        attribution_paths: item.attribution_paths,
        explicit_links: item.explicit_links,
      };
    })
    .filter((item) => item.views > 0 || item.place_visits > 0 || item.route_visits > 0 || item.intent_actions > 0)
    .sort((a, b) => b.place_visits + b.route_visits + b.intent_actions - (a.place_visits + a.route_visits + a.intent_actions) || b.views - a.views)
    .slice(0, 20);

  const pathCount = items.filter((item) => item.attribution !== "content_only").length;
  return {
    items,
    available: items.length > 0,
    note:
      items.length === 0
        ? "No attributable content journeys in range."
        : pathCount > 0
          ? "Attribution uses session click-paths (video → place/route/intent) and explicit from_video_id/source_content_id properties when present."
          : "Video engagement found, but no same-session place/route follow-through or explicit content→place links yet.",
  };
}

function buildOpportunities({ geography, kpis, previousKpis, categories, places, routes }) {
  const cards = [];
  const topRegion = geography.children[0];
  const growing = geography.children.filter((child) => child.share_pct >= 10).slice(0, 3);

  if (topRegion && topRegion.events >= LOCATION_MIN_EVENTS) {
    cards.push({
      type: "growing_destination",
      title: topRegion.label,
      evidence: `${topRegion.events} events · ${topRegion.share_pct}% of filtered demand`,
      opportunity: `Prioritize partnerships and inventory in ${topRegion.label}.`,
      confidence: topRegion.events >= 50 ? "medium" : "low",
    });
  }

  const restaurantIntent = places.filter((place) => /restaurant|food|cafe|coffee|dining/i.test(place.category || ""));
  const intentPlaces = [...places].sort((a, b) => b.actions - a.actions).slice(0, 1)[0];
  if (intentPlaces && intentPlaces.actions >= 5) {
    cards.push({
      type: "high_restaurant_intent",
      title: intentPlaces.location || intentPlaces.place_name,
      evidence: `${intentPlaces.actions} commercial actions on ${intentPlaces.place_name}`,
      opportunity: "Restaurant acquisition / promotions for high-intent venues.",
      confidence: intentPlaces.actions >= 20 ? "medium" : "low",
    });
  } else if (restaurantIntent.length === 0 && kpis.commercial_intent === 0) {
    // skip fabricated card
  }

  const experienceDemand = categories.find((item) => /tour|experience|activity|boat/i.test(item.category));
  const routeSupply = routes.length;
  if (experienceDemand && experienceDemand.share_pct >= 8 && routeSupply < 5 && experienceDemand.count >= 10) {
    cards.push({
      type: "high_demand_low_supply",
      title: `${experienceDemand.category} demand`,
      evidence: `${experienceDemand.share_pct}% category share · only ${routeSupply} active routes ranked`,
      opportunity: "Recruit local tour / experience operators.",
      confidence: "low",
    });
  }

  const placeDelta = previousKpis ? buildDelta(kpis.place_views, previousKpis.place_views) : null;
  if (placeDelta?.percent != null && placeDelta.percent >= 20 && previousKpis.place_views >= MOVER_MIN_PREVIOUS) {
    cards.push({
      type: "demand_surge",
      title: "Place demand rising",
      evidence: `Place views ${placeDelta.percent}% vs comparison period`,
      opportunity: growing[0] ? `Lean into ${growing[0].label} for campaigns.` : "Increase place inventory and creator coverage.",
      confidence: "medium",
    });
  }

  if (!cards.length) {
    return {
      cards: [],
      insufficient_data: true,
      message: "Insufficient data to generate market opportunities for this filter.",
    };
  }
  return { cards, insufficient_data: false, message: null };
}

function buildAudienceSignals({ kpis, geography, categories, places, routes, peak }) {
  return {
    tourism_boards: {
      fastest_growing: geography.children.slice(0, 3).map((item) => ({ label: item.label, share_pct: item.share_pct, events: item.events })),
      top_categories: categories.slice(0, 5),
      demand_trend: {
        place_views: kpis.place_views,
        route_views: kpis.route_views,
        commercial_intent: kpis.commercial_intent,
      },
      peak_available: peak.available,
    },
    restaurants_places: {
      views: kpis.place_views,
      saves: kpis.saves,
      commercial_intent: kpis.commercial_intent,
      top_places: places.slice(0, 5).map((place) => ({
        name: place.place_name,
        views: place.views,
        actions: place.actions,
      })),
    },
    tours_experiences: {
      route_views: kpis.route_views,
      starts: kpis.route_starts,
      completions: kpis.route_completions,
      completion_rate: kpis.route_completion_rate,
      top_routes: routes.slice(0, 5).map((route) => ({
        name: route.route_name,
        views: route.views,
        starts: route.starts,
        completion_rate: route.completion_rate,
      })),
    },
  };
}

function buildMovers(places, routes, geography) {
  const rising = [];
  const declining = [];
  for (const place of places) {
    if (place.trend_pct == null) continue;
    const entry = { type: "place", label: place.place_name, trend_pct: place.trend_pct };
    if (place.trend_pct >= 20) rising.push(entry);
    if (place.trend_pct <= -15) declining.push(entry);
  }
  for (const route of routes) {
    if (route.trend_pct == null) continue;
    const entry = { type: "route", label: route.route_name, trend_pct: route.trend_pct };
    if (route.trend_pct >= 20) rising.push(entry);
    if (route.trend_pct <= -15) declining.push(entry);
  }
  rising.sort((a, b) => b.trend_pct - a.trend_pct);
  declining.sort((a, b) => a.trend_pct - b.trend_pct);
  return {
    rising: rising.slice(0, 8),
    declining: declining.slice(0, 8),
    min_previous_volume: MOVER_MIN_PREVIOUS,
  };
}

function travelerOrigins(rows, params) {
  if (!params.country && !params.region && !params.city) {
    return { available: false, markets: [], note: "Select a destination to compare traveler markets." };
  }
  const counts = new Map();
  for (const row of rows) {
    const origin = travelerOriginForRow(row).country;
    if (!origin) continue;
    counts.set(origin, (counts.get(origin) || 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  const markets = [...counts.entries()]
    .map(([country, count]) => ({
      country,
      label: countryLabel(country),
      events: count,
      share_pct: Math.round((count / total) * 1000) / 10,
    }))
    .filter((item) => item.events >= LOCATION_MIN_EVENTS)
    .sort((a, b) => b.events - a.events)
    .slice(0, 12);
  return {
    available: markets.length > 0,
    markets,
    note: "Aggregated origin mix from privacy-safe origin-country or locale fields. Individual locations are never returned.",
  };
}

function audienceSegmentation(rows, params, categories) {
  const segments = { local: 0, domestic_traveler: 0, international_traveler: 0, unknown: 0 };
  for (const row of rows) {
    const explicit = String(row.properties?.traveler_segment || row.context?.traveler_segment || "").toLowerCase();
    if (["local", "domestic_traveler", "international_traveler"].includes(explicit)) {
      segments[explicit] += 1;
      continue;
    }
    const origin = travelerOriginForRow(row);
    const originCountry = origin.country;
    const originCity = String(origin.city || "").trim().toLowerCase();
    if (params.city && originCity && originCity === String(params.city).toLowerCase()) segments.local += 1;
    else if (params.country && originCountry === params.country) segments.domestic_traveler += 1;
    else if (params.country && originCountry) segments.international_traveler += 1;
    else segments.unknown += 1;
  }
  const total = Object.values(segments).reduce((sum, value) => sum + value, 0) || 1;
  const mix = Object.entries(segments)
    .map(([segment, count]) => ({
      segment,
      count,
      share_pct: Math.round((count / total) * 1000) / 10,
    }))
    .filter((item) => item.segment === "unknown" || item.count >= MIN_USERS_FOR_SEGMENT);
  const behaviorTotal = categories.reduce((sum, item) => sum + item.demand, 0) || 1;
  const behavior = categories
    .filter((item) => item.demand >= MIN_USERS_FOR_SEGMENT)
    .slice(0, 8)
    .map((item) => ({
      segment: item.category,
      count: item.demand,
      share_pct: Math.round((item.demand / behaviorTotal) * 1000) / 10,
    }));
  return {
    traveler_mix: mix,
    behavior,
    status: rows.length >= MIN_RELIABLE_SAMPLE ? "ready" : "low_sample",
    privacy_note: "Behavioral segments are aggregated from Explore activity and never use sensitive personal attributes.",
  };
}

function discoveryAttribution(rows) {
  const counts = new Map();
  for (const row of rows) {
    if (!(isPlaceView(row) || isRouteView(row) || PLACE_COMMERCE_EVENTS.has(row.event_name))) continue;
    const source = discoverySource(row);
    counts.set(source, (counts.get(source) || 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0) || 1;
  const sources = [...counts.entries()]
    .map(([source, count]) => ({ source, count, share_pct: Math.round((count / total) * 1000) / 10 }))
    .filter((item) => item.count >= MIN_USERS_FOR_SEGMENT)
    .sort((a, b) => b.count - a.count);
  return {
    available: sources.length > 0,
    sources,
  };
}

async function loadScoped(supabase, params) {
  let geoIds = null;
  if (params.geo_id) {
    try {
      const descendants = await supabase.rpc("business_geo_descendant_ids", { root_geo_id: params.geo_id });
      if (!descendants.error) geoIds = (descendants.data || []).map((row) => row.geo_id).filter(Boolean);
    } catch {
      geoIds = null;
    }
  }
  const scopedParams = geoIds?.length ? { ...params, geo_ids: geoIds } : params;
  const fetched = await fetchEventsInRange(supabase, scopedParams);
  const enriched = await enrichRowsWithCatalogGeo(supabase, fetched.rows);
  const rows = filterRows(enriched, scopedParams);
  const warnings = [];
  if (fetched.validity_view_missing) {
    warnings.push(
      warning(
        "analytics_validity_view_missing",
        "analytics_normalized_events is not installed yet; this response fell back to raw idempotent events.",
        "warning",
      ),
    );
  }
  if (fetched.truncated) {
    warnings.push(
      warning(
        "events_truncated",
        `Analytics fetch stopped at ${MAX_EVENTS.toLocaleString()} events for this range. Narrow the period or geography for a complete read.`,
        "warning",
      ),
    );
  }
  if (params.country && enriched.length && !rows.length) {
    warnings.push(warning("geo_filter_empty", "No events matched the selected geography after place-catalog enrichment."));
  }
  return { rows, warnings, fetched: fetched.fetched, validity_view_missing: Boolean(fetched.validity_view_missing) };
}

export async function getBusinessIntelligenceDashboard(supabase, params) {
  const current = await loadScoped(supabase, params);
  const prevParams = previousParams(params);
  const previous = prevParams ? await loadScoped(supabase, prevParams) : { rows: [], warnings: [] };
  const productionQualityPromise =
    params.access_scope === "admin_global"
      ? supabase.rpc("business_intelligence_quality_report")
      : Promise.resolve({ data: null, error: null });
  const destinationQualityPromise =
    params.access_scope === "admin_global"
      ? supabase.rpc("business_destination_geography_quality_report")
      : Promise.resolve({ data: null, error: null });

  const kpis = computeKpis(current.rows);
  const previousKpis = computeKpis(previous.rows);
  const deltas = Object.fromEntries(Object.keys(kpis).map((key) => [key, buildDelta(kpis[key] ?? 0, previousKpis[key] ?? 0)]));

  const geography = buildGeography(current.rows, params, params.map_metric, previous.rows);
  const placesPack = await enrichPlaces(supabase, current.rows, previous.rows, params);
  const routesPack = await enrichRoutes(supabase, current.rows, previous.rows, params);
  const categories = await buildCategories(supabase, current.rows, previous.rows);
  const filteredPlaces =
    params.category != null && params.category !== ""
      ? placesPack.places.filter((place) => String(place.category).toLowerCase() === params.category.toLowerCase())
      : placesPack.places;
  const filteredRoutes =
    params.category != null && params.category !== ""
      ? routesPack.routes.filter((route) => String(route.category).toLowerCase() === params.category.toLowerCase())
      : routesPack.routes;

  const funnel = buildCommerceFunnel(current.rows);
  const timeseries = buildTimeseries(current.rows, params.granularity);
  const previousTimeseries = buildTimeseries(previous.rows, params.granularity);
  const comparisonTimeseries = timeseries.map((point, index) => {
    const previousPoint = previousTimeseries[index] || {};
    return {
      ...point,
      previous_users: previousPoint.users || 0,
      previous_sessions: previousPoint.sessions || 0,
      previous_place_views: previousPoint.place_views || 0,
      previous_route_views: previousPoint.route_views || 0,
      previous_searches: previousPoint.searches || 0,
      previous_saves: previousPoint.saves || 0,
      previous_commercial_actions: previousPoint.commercial_actions || 0,
    };
  });
  const peak = buildPeakDemand(current.rows);
  const searches = buildSearches(current.rows, previous.rows);
  const content = await buildContentAttribution(supabase, current.rows);
  const opportunities = buildOpportunities({
    geography,
    kpis,
    previousKpis,
    categories,
    places: filteredPlaces,
    routes: filteredRoutes,
  });
  const signals = buildAudienceSignals({
    kpis,
    geography,
    categories,
    places: filteredPlaces,
    routes: filteredRoutes,
    peak,
  });
  const movers = buildMovers(filteredPlaces, filteredRoutes, geography);
  const origins = travelerOrigins(current.rows, params);
  const demandIndex = calculateDemandIndex(kpis, previousKpis);
  const marketLabel = geography.breadcrumb[geography.breadcrumb.length - 1]?.label || "Global";
  const range = { start: params.start, end: params.end, preset: params.preset };
  const comparisonRange = prevParams ? { start: prevParams.start, end: prevParams.end } : null;
  const executiveSummary = buildExecutiveSummary({
    marketLabel,
    range,
    kpis,
    previousKpis,
    categories,
    peak,
  });
  const insights = buildDecisionInsights({
    range,
    comparisonRange,
    kpis,
    previousKpis,
    categories,
    peak,
    movers,
  });
  const placesWithBenchmarks = filteredPlaces.map((place) => ({
    ...place,
    benchmark: buildBusinessBenchmark(place, filteredPlaces),
  }));
  const dataAsOf = latestDataAsOf(current.rows);
  const categorySupplyDemand = categoryMatrix(categories);
  const audience = audienceSegmentation(current.rows, params, categories);
  const marketComparison = buildMarketComparisons(current.rows, previous.rows, geography, params.compare_markets);
  const attribution = discoveryAttribution(current.rows);
  const unresolvedPlaces = filteredPlaces.filter((item) => !item.name_resolved).length;
  const unresolvedRoutes = filteredRoutes.filter((item) => !item.name_resolved).length;
  const missingGeography = current.rows.filter((row) => !marketCountry(row)).length;
  let productionQuality = null;
  try {
    const [coreResult, destinationResult] = await Promise.all([productionQualityPromise, destinationQualityPromise]);
    productionQuality = {
      ...(coreResult?.error ? {} : coreResult?.data || {}),
      ...(destinationResult?.error ? {} : destinationResult?.data || {}),
    };
  } catch {
    productionQuality = null;
  }

  return {
    core_version: BUSINESS_ANALYTICS_CORE_VERSION,
    data_as_of: dataAsOf,
    range,
    filters: {
      country: params.country,
      region: params.region,
      city: params.city,
      neighborhood: params.neighborhood,
      category: params.category,
      geo_id: params.geo_id,
      category_id: params.category_id,
      business_id: params.business_id,
      location_id: params.location_id,
      platform: params.platform,
      source: params.source,
      compare: params.compare,
      granularity: params.granularity,
      map_metric: params.map_metric,
    },
    comparison:
      params.compare === "none"
        ? null
        : {
            mode: params.compare,
            previous_period: comparisonRange,
            deltas,
          },
    kpis,
    kpi_definitions: kpiDefinitions(),
    metric_dictionary: metricDefinitionsForClient(),
    event_taxonomy: eventTaxonomyForClient(),
    executive_summary: executiveSummary,
    demand_index: demandIndex,
    geography,
    market_comparison: marketComparison,
    funnel,
    timeseries: comparisonTimeseries,
    peak_demand: peak,
    categories,
    supply_demand_matrix: categorySupplyDemand,
    places: placesWithBenchmarks,
    routes: filteredRoutes,
    searches,
    content_attribution: content,
    opportunities: {
      ...opportunities,
      category_scores: categories
        .filter((item) => item.opportunity_score != null)
        .sort((a, b) => b.opportunity_score - a.opportunity_score),
      matrix: categorySupplyDemand,
    },
    business_signals: signals,
    movers,
    insights,
    what_changed: insights.filter((item) => ["growth", "decline", "trend"].includes(item.type)),
    traveler_origins: origins,
    audience,
    discovery_attribution: attribution,
    business_performance:
      params.place_id && placesWithBenchmarks.length
        ? placesWithBenchmarks.find((item) => item.place_id === params.place_id)?.benchmark || null
        : null,
    data_quality: {
      status: current.validity_view_missing ? "degraded" : "ready",
      valid_events: current.rows.length,
      unknown_places: unresolvedPlaces,
      unknown_routes: unresolvedRoutes,
      missing_geography: missingGeography,
      validity_view_active: !current.validity_view_missing,
      geo_coverage_pct: productionQuality?.destination_events_with_geo_pct ?? null,
      destination_geo_coverage_pct: productionQuality?.destination_events_with_geo_pct ?? null,
      traveler_origin_coverage_pct: productionQuality?.traveler_origin_country_pct ?? null,
      places_with_country_pct: productionQuality?.places_with_country_pct ?? null,
      places_with_region_pct: productionQuality?.places_with_region_pct ?? null,
      places_with_city_pct: productionQuality?.places_with_city_pct ?? null,
      routes_with_market_pct: productionQuality?.routes_with_market_pct ?? null,
      place_resolution_pct: productionQuality?.place_resolution_pct ?? null,
      route_resolution_pct: productionQuality?.route_resolution_pct ?? null,
      rejected_events: productionQuality?.rejected_events ?? null,
      aggregation_failures: productionQuality?.aggregation_failures ?? null,
      possible_duplicate_places: productionQuality?.possible_duplicate_places ?? null,
      last_aggregation: productionQuality?.last_aggregation ?? null,
    },
    state: current.rows.length ? "ready" : "zero",
    warnings: [...current.warnings, ...placesPack.warnings, ...routesPack.warnings, ...previous.warnings],
  };
}

export async function getBusinessIntelligenceOverview(supabase, params) {
  const dash = await getBusinessIntelligenceDashboard(supabase, params);
  return {
    core_version: dash.core_version,
    data_as_of: dash.data_as_of,
    range: dash.range,
    filters: dash.filters,
    comparison: dash.comparison,
    kpis: dash.kpis,
    kpi_definitions: dash.kpi_definitions,
    executive_summary: dash.executive_summary,
    demand_index: dash.demand_index,
    insights: dash.insights.slice(0, 5),
    business_performance: dash.business_performance,
    state: dash.state,
    geography: { breadcrumb: dash.geography.breadcrumb, level: dash.geography.level, region_terminology: dash.geography.region_terminology },
    warnings: dash.warnings,
  };
}

export async function getBusinessIntelligenceGeography(supabase, params) {
  const current = await loadScoped(supabase, params);
  const prevParams = previousParams(params);
  const previous = prevParams ? await loadScoped(supabase, prevParams) : { rows: [] };
  const geography = buildGeography(current.rows, params, params.map_metric, previous.rows);
  return { range: { start: params.start, end: params.end, preset: params.preset }, data_as_of: latestDataAsOf(current.rows), filters: params, geography, warnings: current.warnings };
}

export async function getBusinessIntelligencePlaces(supabase, params) {
  const current = await loadScoped(supabase, params);
  const prevParams = previousParams(params);
  const previous = prevParams ? await loadScoped(supabase, prevParams) : { rows: [] };
  const pack = await enrichPlaces(supabase, current.rows, previous.rows, params);
  return { range: { start: params.start, end: params.end, preset: params.preset }, data_as_of: latestDataAsOf(current.rows), places: pack.places, warnings: [...current.warnings, ...pack.warnings] };
}

export async function getBusinessIntelligenceRoutes(supabase, params) {
  const current = await loadScoped(supabase, params);
  const prevParams = previousParams(params);
  const previous = prevParams ? await loadScoped(supabase, prevParams) : { rows: [] };
  const pack = await enrichRoutes(supabase, current.rows, previous.rows, params);
  return { range: { start: params.start, end: params.end, preset: params.preset }, data_as_of: latestDataAsOf(current.rows), routes: pack.routes, warnings: [...current.warnings, ...pack.warnings] };
}

export async function getBusinessIntelligenceCategories(supabase, params) {
  const current = await loadScoped(supabase, params);
  const prevParams = previousParams(params);
  const previous = prevParams ? await loadScoped(supabase, prevParams) : { rows: [] };
  const categories = await buildCategories(supabase, current.rows, previous.rows);
  return { range: { start: params.start, end: params.end, preset: params.preset }, data_as_of: latestDataAsOf(current.rows), categories, warnings: current.warnings };
}

export async function getBusinessIntelligenceTimeseries(supabase, params) {
  const current = await loadScoped(supabase, params);
  return {
    range: { start: params.start, end: params.end, preset: params.preset },
    data_as_of: latestDataAsOf(current.rows),
    granularity: params.granularity,
    series: buildTimeseries(current.rows, params.granularity),
    warnings: current.warnings,
  };
}

export async function getBusinessIntelligenceFunnel(supabase, params) {
  const current = await loadScoped(supabase, params);
  return { range: { start: params.start, end: params.end, preset: params.preset }, data_as_of: latestDataAsOf(current.rows), funnel: buildCommerceFunnel(current.rows), warnings: current.warnings };
}

export async function getBusinessIntelligenceSearches(supabase, params) {
  const current = await loadScoped(supabase, params);
  const prevParams = previousParams(params);
  const previous = prevParams ? await loadScoped(supabase, prevParams) : { rows: [] };
  return { range: { start: params.start, end: params.end, preset: params.preset }, data_as_of: latestDataAsOf(current.rows), ...buildSearches(current.rows, previous.rows), warnings: current.warnings };
}

export async function getBusinessIntelligenceOpportunities(supabase, params) {
  const dash = await getBusinessIntelligenceDashboard(supabase, params);
  return { range: dash.range, data_as_of: dash.data_as_of, opportunities: dash.opportunities, business_signals: dash.business_signals, movers: dash.movers, warnings: dash.warnings };
}

export async function getBusinessIntelligenceContentAttribution(supabase, params) {
  const current = await loadScoped(supabase, params);
  const content = await buildContentAttribution(supabase, current.rows);
  return { range: { start: params.start, end: params.end, preset: params.preset }, data_as_of: latestDataAsOf(current.rows), ...content, warnings: current.warnings };
}

export async function getBusinessIntelligenceMarkets(supabase, params) {
  return getBusinessIntelligenceGeography(supabase, params);
}

export async function getBusinessIntelligenceExecutiveSummary(supabase, params) {
  const dash = await getBusinessIntelligenceDashboard(supabase, params);
  return {
    range: dash.range,
    data_as_of: dash.data_as_of,
    executive_summary: dash.executive_summary,
    kpis: dash.kpis,
    demand_index: dash.demand_index,
    warnings: dash.warnings,
  };
}

export async function getBusinessIntelligenceCompare(supabase, params) {
  const dash = await getBusinessIntelligenceDashboard(supabase, params);
  return { range: dash.range, data_as_of: dash.data_as_of, markets: dash.market_comparison, warnings: dash.warnings };
}

export async function getBusinessIntelligenceDemand(supabase, params) {
  const dash = await getBusinessIntelligenceDashboard(supabase, params);
  return {
    range: dash.range,
    data_as_of: dash.data_as_of,
    demand_index: dash.demand_index,
    timeseries: dash.timeseries,
    comparison: dash.comparison,
    movers: dash.movers,
    warnings: dash.warnings,
  };
}

export async function getBusinessIntelligenceUnmetDemand(supabase, params) {
  const searches = await getBusinessIntelligenceSearches(supabase, params);
  return { range: searches.range, data_as_of: searches.data_as_of, unmet_demand: searches.low_supply, warnings: searches.warnings };
}

export async function getBusinessIntelligencePlaceDetail(supabase, params) {
  if (!params.place_id) {
    throw new BusinessIntelligenceError(400, "place_id is required.", { code: "bi_place_required" });
  }
  const dash = await getBusinessIntelligenceDashboard(supabase, { ...params, place_id: null });
  const place = dash.places.find((item) => item.place_id === params.place_id) || null;
  return {
    range: dash.range,
    data_as_of: dash.data_as_of,
    place,
    benchmark: place?.benchmark || null,
    audience: dash.audience,
    warnings: dash.warnings,
    state: place ? "ready" : "zero",
  };
}

export async function getBusinessIntelligenceRouteDetail(supabase, params) {
  if (!params.route_id) {
    throw new BusinessIntelligenceError(400, "route_id is required.", { code: "bi_route_required" });
  }
  const dash = await getBusinessIntelligenceDashboard(supabase, { ...params, route_id: null });
  const route = dash.routes.find((item) => item.route_id === params.route_id) || null;
  return {
    range: dash.range,
    data_as_of: dash.data_as_of,
    route,
    warnings: dash.warnings,
    state: route ? "ready" : "zero",
  };
}

export async function getBusinessIntelligenceAudience(supabase, params) {
  const dash = await getBusinessIntelligenceDashboard(supabase, params);
  return {
    range: dash.range,
    data_as_of: dash.data_as_of,
    audience: dash.audience,
    traveler_origins: dash.traveler_origins,
    warnings: dash.warnings,
  };
}

export async function getBusinessIntelligenceTime(supabase, params) {
  const current = await loadScoped(supabase, params);
  return {
    range: { start: params.start, end: params.end, preset: params.preset },
    data_as_of: current.rows.map((row) => row.received_at || row.occurred_at).filter(Boolean).sort().at(-1) || null,
    peak_demand: buildPeakDemand(current.rows),
    warnings: current.warnings,
  };
}

export async function getBusinessIntelligenceInsights(supabase, params) {
  const dash = await getBusinessIntelligenceDashboard(supabase, params);
  return {
    range: dash.range,
    data_as_of: dash.data_as_of,
    insights: dash.insights,
    what_changed: dash.what_changed,
    warnings: dash.warnings,
  };
}

export async function getBusinessIntelligenceBenchmarks(supabase, params) {
  const dash = await getBusinessIntelligenceDashboard(supabase, params);
  return {
    range: dash.range,
    data_as_of: dash.data_as_of,
    business_performance: dash.business_performance,
    places: dash.places.map((place) => ({
      place_id: place.place_id,
      place_name: place.place_name,
      category: place.category,
      benchmark: place.benchmark,
    })),
    warnings: dash.warnings,
  };
}

export function buildBusinessMobileOverviewPayload(dash, params) {
  const benchmark = dash.business_performance;
  const directions = dash.places.reduce((sum, place) => sum + Number(place.directions || 0), 0);
  const kpiValues = {
    place_views: dash.kpis.place_views,
    saves: dash.kpis.saves,
    directions,
  };
  const mobileKpis = [
    { metric: "place_views", value: kpiValues.place_views, delta: dash.comparison?.deltas?.place_views || null },
    { metric: "saves", value: kpiValues.saves, delta: dash.comparison?.deltas?.saves || null },
    { metric: "directions", value: kpiValues.directions, delta: null },
  ];
  return {
    business: { business_id: params.business_id || null, location_id: params.location_id || null },
    period: dash.range,
    range: dash.range,
    data_as_of: dash.data_as_of,
    summary: dash.executive_summary,
    kpis: mobileKpis,
    kpi_values: kpiValues,
    comparison: dash.comparison,
    business_score: benchmark
      ? { score: benchmark.score ?? null, status: benchmark.status, components: benchmark.components, version: benchmark.version }
      : { score: null, status: "insufficient_data", components: null, version: "v1" },
    business_score_value: benchmark?.score ?? null,
    what_changed: dash.what_changed.slice(0, 3),
    top_insights: dash.insights.slice(0, 3),
    peak_demand: dash.peak_demand,
    strongest_period: dash.peak_demand.peak_window,
    insights: dash.insights.slice(0, 3),
    state: dash.state,
  };
}

export async function getBusinessIntelligenceMobileOverview(supabase, params) {
  const dash = await getBusinessIntelligenceDashboard(supabase, params);
  return buildBusinessMobileOverviewPayload(dash, params);
}

export function getBusinessIntelligenceDefinitions() {
  return {
    core_version: BUSINESS_ANALYTICS_CORE_VERSION,
    metric_dictionary: metricDefinitionsForClient(),
    event_taxonomy: eventTaxonomyForClient(),
  };
}

export async function getBusinessIntelligenceHealth(supabase, params) {
  const current = await loadScoped(supabase, params);
  const received = current.rows.length;
  const delayed = current.rows.filter((row) => {
    const occurred = Date.parse(row.occurred_at || "");
    const receivedAt = Date.parse(row.received_at || "");
    return Number.isFinite(occurred) && Number.isFinite(receivedAt) && receivedAt - occurred > 15 * 60 * 1000;
  }).length;
  const missingGeo = current.rows.filter((row) => !marketCountry(row)).length;
  let invalidEvents = null;
  let lastAggregation = null;
  let productionQuality = null;
  try {
    const deadLetters = await supabase
      .from("analytics_event_dead_letters")
      .select("id", { count: "exact", head: true })
      .gte("received_at", params.since)
      .lt("received_at", params.until);
    if (!deadLetters.error) invalidEvents = deadLetters.count || 0;
  } catch {
    invalidEvents = null;
  }
  try {
    const aggregation = await supabase
      .from("business_aggregation_runs")
      .select("job_finished_at, status, events_processed, records_generated")
      .eq("status", "succeeded")
      .order("job_finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!aggregation.error) lastAggregation = aggregation.data?.job_finished_at || null;
  } catch {
    lastAggregation = null;
  }
  try {
    const [qualityReport, destinationReport] = await Promise.all([
      supabase.rpc("business_intelligence_quality_report"),
      supabase.rpc("business_destination_geography_quality_report"),
    ]);
    productionQuality = {
      ...(qualityReport.error ? {} : qualityReport.data || {}),
      ...(destinationReport.error ? {} : destinationReport.data || {}),
    };
  } catch {
    productionQuality = null;
  }
  const quality = invalidEvents == null ? null : received + invalidEvents > 0 ? Math.round((received / (received + invalidEvents)) * 1000) / 10 : 100;
  const dataAsOf = latestDataAsOf(current.rows);
  const processingLagSeconds = dataAsOf ? Math.max(0, Math.round((Date.now() - Date.parse(dataAsOf)) / 1000)) : null;
  const healthy = !current.validity_view_missing && Number(productionQuality?.aggregation_failures || 0) === 0;
  return {
    range: { start: params.start, end: params.end, preset: params.preset },
    analytics_health: {
      score_pct: quality,
      events_received: received,
      invalid_events: invalidEvents,
      missing_geography: missingGeo,
      duplicate_events: 0,
      delayed_events: delayed,
      schema_errors: current.validity_view_missing ? 1 : 0,
      last_successful_aggregation: lastAggregation,
      last_event: dataAsOf,
      processing_lag_seconds: processingLagSeconds,
      system_status: healthy ? "healthy" : current.validity_view_missing ? "schema_missing" : "degraded",
      raw_events: productionQuality?.events_total ?? null,
      valid_events_total: productionQuality?.valid_events ?? received,
      rejected_events_total: productionQuality?.rejected_events ?? invalidEvents,
      geo_coverage_pct: productionQuality?.destination_events_with_geo_pct ?? null,
      destination_geo_coverage_pct: productionQuality?.destination_events_with_geo_pct ?? null,
      traveler_origin_coverage_pct: productionQuality?.traveler_origin_country_pct ?? null,
      places_with_country_pct: productionQuality?.places_with_country_pct ?? null,
      places_with_region_pct: productionQuality?.places_with_region_pct ?? null,
      places_with_city_pct: productionQuality?.places_with_city_pct ?? null,
      routes_with_market_pct: productionQuality?.routes_with_market_pct ?? null,
      last_attempted_aggregation: productionQuality?.last_attempted_aggregation ?? null,
      place_resolution_pct: productionQuality?.place_resolution_pct ?? null,
      route_resolution_pct: productionQuality?.route_resolution_pct ?? null,
      unknown_entities: Number(productionQuality?.unknown_geo || 0),
      aggregation_failures: Number(productionQuality?.aggregation_failures || 0),
      possible_duplicate_places: Number(productionQuality?.possible_duplicate_places || 0),
      data_as_of: dataAsOf,
    },
    warnings: current.warnings,
  };
}
