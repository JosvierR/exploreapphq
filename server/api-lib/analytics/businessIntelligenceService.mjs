/**
 * Business Intelligence aggregates for Admin > Business.
 * Privacy-safe, geo-filterable, name-enriched place/route rankings.
 */

const EVENTS_TABLE = "analytics_events";
const PAGE_SIZE = 1000;
const MAX_EVENTS = 100_000;
const MAX_RANGE_DAYS = 366;
const LOCATION_MIN_EVENTS = 3;
const SEARCH_DISPLAY_MIN = 5;
const MOVER_MIN_PREVIOUS = 8;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_PRESETS = new Set(["7d", "30d", "90d", "365d", "12m"]);
const VALID_COMPARE = new Set(["previous", "previous_year", "none"]);
const VALID_GRANULARITY = new Set(["daily", "weekly", "monthly"]);
const VALID_MAP_METRICS = new Set(["activity", "users", "place_views", "route_views", "intent", "saves", "searches"]);

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
const PLACE_COMMERCE_EVENTS = new Set(["place_get_directions", "place_call", "place_website_click", "place_open_map"]);

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
  const raw = row?.country || row?._place_country || null;
  if (raw) return normalizeCountryCode(raw);
  return countryFromLocale(row?.locale);
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
  const value = row?.region || row?._place_region;
  return value ? String(value).trim() : null;
}

function marketCity(row) {
  const value = row?.city || row?._place_city;
  return value ? String(value).trim() : null;
}

function marketNeighborhood(row) {
  const value = row?.neighborhood || row?._place_neighborhood || row?.properties?.neighborhood || row?.properties?.area;
  return value ? String(value).trim() : null;
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

function uniqueUsers(rows) {
  const ids = new Set();
  for (const row of rows) {
    if (row.user_id) ids.add(`u:${row.user_id}`);
    else if (row.anonymous_id) ids.add(`a:${row.anonymous_id}`);
  }
  return ids.size;
}

function uniqueSessions(rows) {
  return new Set(rows.map((row) => row.session_id).filter(Boolean)).size;
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
  const startParam = url.searchParams.get("date_from") || url.searchParams.get("start");
  const endParam = url.searchParams.get("date_to") || url.searchParams.get("end");
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
  const category = (url.searchParams.get("category") || "").trim() || null;
  const placeId = (url.searchParams.get("place_id") || "").trim() || null;
  const routeId = (url.searchParams.get("route_id") || "").trim() || null;

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

  return {
    ...range,
    compare,
    granularity,
    map_metric: mapMetric,
    country,
    region,
    city,
    neighborhood,
    category,
    place_id: placeId,
    route_id: routeId,
  };
}

function previousParams(params) {
  if (params.compare === "none") return null;
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

async function fetchEventsInRange(supabase, params) {
  const rows = [];
  let offset = 0;
  let truncated = false;

  while (offset < MAX_EVENTS) {
    let query = supabase
      .from(EVENTS_TABLE)
      .select(
        "event_id, event_name, entity_type, entity_id, user_id, anonymous_id, session_id, source, platform, locale, country, region, city, received_at, occurred_at, properties, context",
      )
      .gte("received_at", params.since)
      .lt("received_at", params.until)
      .order("received_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    // Country filter at DB when possible; region/city/neighborhood often enriched later.
    if (params.country) query = query.eq("country", params.country);

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

async function enrichRowsWithCatalogGeo(supabase, rows) {
  const placeIds = rows.filter((row) => row.entity_type === "place" && row.entity_id).map((row) => row.entity_id);
  const places = await fetchEntityMeta(supabase, "places", placeIds);

  return rows.map((row) => {
    const next = { ...row, properties: row.properties || {}, context: row.context || {} };
    const props = next.properties;

    if (!next.city && props.city) next.city = String(props.city).trim();
    if (!next.region && (props.region || props.state || props.province)) {
      next.region = String(props.region || props.state || props.province).trim();
    }
    if (!next.country && (props.country || props.country_code)) {
      next.country = normalizeCountryCode(props.country || props.country_code);
    }
    if (props.neighborhood || props.area || props.district) {
      next.neighborhood = String(props.neighborhood || props.area || props.district).trim();
    }

    if (row.entity_type === "place" && row.entity_id && places.has(row.entity_id)) {
      const info = placeMeta(places.get(row.entity_id));
      if (!marketCountry(next) && info.country) next.country = normalizeCountryCode(info.country);
      if (!marketRegion(next) && info.region) next.region = info.region;
      if (!marketCity(next) && info.city) next.city = info.city;
      if (!marketNeighborhood(next) && info.neighborhood) next.neighborhood = info.neighborhood;
      next._place_country = info.country ? normalizeCountryCode(info.country) : null;
      next._place_region = info.region;
      next._place_city = info.city;
      next._place_neighborhood = info.neighborhood;
      if (info.lat != null) next._lat = info.lat;
      if (info.lng != null) next._lng = info.lng;
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

function computeKpis(rows) {
  const placeViews = rows.filter(isPlaceView).length;
  const routeViews = rows.filter(isRouteView).length;
  const routeStarts = rows.filter((row) => row.event_name === "route_start").length;
  const routeCompletes = rows.filter((row) => row.event_name === "route_complete").length;
  const saves = rows.filter((row) => SAVE_EVENTS.has(row.event_name)).length;
  const intent = rows.filter((row) => PLACE_COMMERCE_EVENTS.has(row.event_name)).length;
  const searches = rows.filter(isSearchEvent).length;
  const placeImpressions = rows.filter((row) => row.event_name === "place_impression").length;
  const placeSaves = rows.filter((row) => row.event_name === "place_save").length;

  return {
    active_users: uniqueUsers(rows),
    sessions: uniqueSessions(rows),
    place_views: placeViews,
    route_views: routeViews,
    route_starts: routeStarts,
    route_completions: routeCompletes,
    saves,
    commercial_intent: intent,
    searches,
    place_impressions: placeImpressions,
    place_saves: placeSaves,
    total_events: rows.length,
    route_completion_rate: rate(routeCompletes, routeStarts),
  };
}

function kpiDefinitions() {
  return {
    active_users: "Unique user_id + anonymous_id observed in filtered analytics events.",
    sessions: "Unique session_id values in the filtered period.",
    place_views: "place_view events and place entity view events.",
    route_views: "route_view events and route entity view events.",
    route_starts: "route_start events.",
    route_completions: "route_complete events.",
    saves: "Save events across content, places, routes, and photos.",
    commercial_intent: "place_get_directions + place_call + place_website_click + place_open_map.",
  };
}

function buildGeography(rows, params, mapMetric) {
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
    const point = eventLatLng(row);
    if (point) {
      current.latSum += point.lat;
      current.lngSum += point.lng;
      current.geoCount += 1;
    }
    buckets.set(key, current);
  }

  const metricValue = (item) => {
    if (mapMetric === "users") return item.users.size;
    if (mapMetric === "place_views") return item.place_views;
    if (mapMetric === "route_views") return item.route_views;
    if (mapMetric === "intent") return item.intent;
    if (mapMetric === "saves") return item.saves;
    if (mapMetric === "searches") return item.searches;
    return item.events;
  };

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
        metric: metricValue(item),
        share_pct: null,
        lat: item.geoCount ? item.latSum / item.geoCount : null,
        lng: item.geoCount ? item.lngSum / item.geoCount : null,
      };
    })
    .sort((a, b) => b.metric - a.metric)
    .slice(0, 25);

  const totalMetric = children.reduce((sum, item) => sum + item.metric, 0) || 1;
  for (const child of children) {
    child.share_pct = Math.round((child.metric / totalMetric) * 1000) / 10;
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
      place_views: 0,
      route_views: 0,
      commercial_actions: 0,
    };
    if (row.user_id) current.users.add(`u:${row.user_id}`);
    else if (row.anonymous_id) current.users.add(`a:${row.anonymous_id}`);
    if (isPlaceView(row)) current.place_views += 1;
    if (isRouteView(row)) current.route_views += 1;
    if (PLACE_COMMERCE_EVENTS.has(row.event_name)) current.commercial_actions += 1;
    buckets.set(key, current);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, bucket]) => ({
      period: bucket.period,
      users: bucket.users.size,
      place_views: bucket.place_views,
      route_views: bucket.route_views,
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
    const hour = hourBucket(iso);
    const weekday = weekdayBucket(iso);
    if (hour == null || weekday == null) continue;
    const part = daypart(hour);
    matrix[part][weekday] += 1;
    byHour[hour] += 1;
    tracked += 1;
  }
  return {
    available: tracked > 0,
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    dayparts: ["morning", "afternoon", "evening", "night"],
    matrix,
    by_hour: byHour,
    tracked_events: tracked,
  };
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
      rating: info.rating == null ? null : Number(info.rating),
      trend_pct: prev && prev.views >= MOVER_MIN_PREVIOUS ? delta.percent : null,
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
      commercial_actions: item.intent,
      trend_pct: prev && prev.views >= MOVER_MIN_PREVIOUS ? delta.percent : null,
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

async function buildCategories(supabase, rows) {
  const placeIds = rows.filter((row) => row.entity_type === "place" && row.entity_id).map((row) => row.entity_id);
  const meta = await fetchEntityMeta(supabase, "places", placeIds);
  const counts = new Map();
  for (const row of rows) {
    if (!(isPlaceView(row) || row.entity_type === "place" || SEARCH_EVENTS.has(row.event_name))) continue;
    const hint = extractCategoryHint(row, placeMeta(meta.get(row.entity_id)));
    const key = hint ? String(hint) : "Uncategorized";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  return [...counts.entries()]
    .map(([category, count]) => ({
      category,
      count,
      share_pct: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count)
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

function buildSearches(rows) {
  const submitted = rows.filter((row) => ["search_performed", "search_submitted"].includes(row.event_name));
  const noResults = rows.filter((row) => row.event_name === "search_no_results");
  const clicks = rows.filter((row) => row.event_name === "search_result_clicked");

  const byKey = new Map();
  let missingHash = 0;
  for (const row of [...submitted, ...noResults]) {
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
      result_count_sum: 0,
      result_count_n: 0,
    };
    current.count += 1;
    if (row.event_name === "search_no_results") current.no_results += 1;
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
  // When filtered to a destination, approximate origin via locale country when event country differs
  // or use all event countries as traveler markets for destination content engagement.
  if (!params.country && !params.region && !params.city) {
    return { available: false, markets: [], note: "Select a destination to compare traveler markets." };
  }
  const counts = new Map();
  for (const row of rows) {
    const origin = marketCountry(row);
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
    note: "Aggregated market mix from privacy-safe country/locale fields in the destination filter.",
  };
}

async function loadScoped(supabase, params) {
  const fetched = await fetchEventsInRange(supabase, params);
  const enriched = await enrichRowsWithCatalogGeo(supabase, fetched.rows);
  const rows = filterRows(enriched, params);
  const warnings = [];
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
  return { rows, warnings, fetched: fetched.fetched };
}

export async function getBusinessIntelligenceDashboard(supabase, params) {
  const current = await loadScoped(supabase, params);
  const prevParams = previousParams(params);
  const previous = prevParams ? await loadScoped(supabase, prevParams) : { rows: [], warnings: [] };

  const kpis = computeKpis(current.rows);
  const previousKpis = computeKpis(previous.rows);
  const deltas = Object.fromEntries(Object.keys(kpis).map((key) => [key, buildDelta(kpis[key] ?? 0, previousKpis[key] ?? 0)]));

  const geography = buildGeography(current.rows, params, params.map_metric);
  const placesPack = await enrichPlaces(supabase, current.rows, previous.rows, params);
  const routesPack = await enrichRoutes(supabase, current.rows, previous.rows, params);
  const categories = await buildCategories(supabase, current.rows);
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
  const peak = buildPeakDemand(current.rows);
  const searches = buildSearches(current.rows);
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

  return {
    range: { start: params.start, end: params.end, preset: params.preset },
    filters: {
      country: params.country,
      region: params.region,
      city: params.city,
      neighborhood: params.neighborhood,
      category: params.category,
      compare: params.compare,
      granularity: params.granularity,
      map_metric: params.map_metric,
    },
    comparison:
      params.compare === "none"
        ? null
        : {
            mode: params.compare,
            previous_period: prevParams ? { start: prevParams.start, end: prevParams.end } : null,
            deltas,
          },
    kpis,
    kpi_definitions: kpiDefinitions(),
    geography,
    funnel,
    timeseries,
    peak_demand: peak,
    categories,
    places: filteredPlaces,
    routes: filteredRoutes,
    searches,
    content_attribution: content,
    opportunities,
    business_signals: signals,
    movers,
    traveler_origins: origins,
    warnings: [...current.warnings, ...placesPack.warnings, ...routesPack.warnings, ...previous.warnings],
  };
}

export async function getBusinessIntelligenceOverview(supabase, params) {
  const dash = await getBusinessIntelligenceDashboard(supabase, params);
  return {
    range: dash.range,
    filters: dash.filters,
    comparison: dash.comparison,
    kpis: dash.kpis,
    kpi_definitions: dash.kpi_definitions,
    geography: { breadcrumb: dash.geography.breadcrumb, level: dash.geography.level, region_terminology: dash.geography.region_terminology },
    warnings: dash.warnings,
  };
}

export async function getBusinessIntelligenceGeography(supabase, params) {
  const current = await loadScoped(supabase, params);
  const geography = buildGeography(current.rows, params, params.map_metric);
  return { range: { start: params.start, end: params.end, preset: params.preset }, filters: params, geography, warnings: current.warnings };
}

export async function getBusinessIntelligencePlaces(supabase, params) {
  const current = await loadScoped(supabase, params);
  const prevParams = previousParams(params);
  const previous = prevParams ? await loadScoped(supabase, prevParams) : { rows: [] };
  const pack = await enrichPlaces(supabase, current.rows, previous.rows, params);
  return { range: { start: params.start, end: params.end, preset: params.preset }, places: pack.places, warnings: [...current.warnings, ...pack.warnings] };
}

export async function getBusinessIntelligenceRoutes(supabase, params) {
  const current = await loadScoped(supabase, params);
  const prevParams = previousParams(params);
  const previous = prevParams ? await loadScoped(supabase, prevParams) : { rows: [] };
  const pack = await enrichRoutes(supabase, current.rows, previous.rows, params);
  return { range: { start: params.start, end: params.end, preset: params.preset }, routes: pack.routes, warnings: [...current.warnings, ...pack.warnings] };
}

export async function getBusinessIntelligenceCategories(supabase, params) {
  const current = await loadScoped(supabase, params);
  const categories = await buildCategories(supabase, current.rows);
  return { range: { start: params.start, end: params.end, preset: params.preset }, categories, warnings: current.warnings };
}

export async function getBusinessIntelligenceTimeseries(supabase, params) {
  const current = await loadScoped(supabase, params);
  return {
    range: { start: params.start, end: params.end, preset: params.preset },
    granularity: params.granularity,
    series: buildTimeseries(current.rows, params.granularity),
    warnings: current.warnings,
  };
}

export async function getBusinessIntelligenceFunnel(supabase, params) {
  const current = await loadScoped(supabase, params);
  return { range: { start: params.start, end: params.end, preset: params.preset }, funnel: buildCommerceFunnel(current.rows), warnings: current.warnings };
}

export async function getBusinessIntelligenceSearches(supabase, params) {
  const current = await loadScoped(supabase, params);
  return { range: { start: params.start, end: params.end, preset: params.preset }, ...buildSearches(current.rows), warnings: current.warnings };
}

export async function getBusinessIntelligenceOpportunities(supabase, params) {
  const dash = await getBusinessIntelligenceDashboard(supabase, params);
  return { range: dash.range, opportunities: dash.opportunities, business_signals: dash.business_signals, movers: dash.movers, warnings: dash.warnings };
}

export async function getBusinessIntelligenceContentAttribution(supabase, params) {
  const current = await loadScoped(supabase, params);
  const content = await buildContentAttribution(supabase, current.rows);
  return { range: { start: params.start, end: params.end, preset: params.preset }, ...content, warnings: current.warnings };
}

export async function getBusinessIntelligenceMarkets(supabase, params) {
  return getBusinessIntelligenceGeography(supabase, params);
}
