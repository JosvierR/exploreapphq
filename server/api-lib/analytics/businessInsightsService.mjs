const EVENTS_TABLE = "analytics_events";
const DEAD_LETTERS_TABLE = "analytics_event_dead_letters";
const SAMPLE_LIMIT = 5000;
const MAX_RANGE_DAYS = 90;
const LOCATION_MIN_EVENTS = 3;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_PRESETS = new Set(["24h", "7d", "30d", "90d"]);

const VIEW_EVENTS = new Set([
  "content_view",
  "video_view",
  "video_view_start",
  "video_view_3s",
  "video_view_25",
  "video_view_50",
  "video_view_75",
  "video_view_complete",
  "place_view",
  "route_view",
  "user_profile_view",
  "profile_view",
  "place_photo_view",
]);

const ACTION_EVENTS = new Set([
  "content_like",
  "video_like",
  "place_like",
  "route_like",
  "place_photo_like",
  "content_save",
  "video_save",
  "place_save",
  "route_save",
  "place_photo_save",
  "content_share",
  "video_share",
  "place_share",
  "route_share",
  "place_photo_share",
  "follow_user",
  "report_submitted",
  "route_start",
  "route_complete",
  "place_get_directions",
  "place_call",
  "place_website_click",
  "place_open_map",
]);

const LIKE_EVENTS = new Set(["content_like", "video_like", "place_like", "route_like", "place_photo_like"]);
const SAVE_EVENTS = new Set(["content_save", "video_save", "place_save", "route_save", "place_photo_save"]);
const SHARE_EVENTS = new Set(["content_share", "video_share", "place_share", "route_share", "place_photo_share"]);
const SEARCH_EVENTS = new Set(["search_performed", "search_submitted", "search_no_results", "search_result_clicked"]);
const APP_OPEN_EVENTS = new Set(["app_open"]);
const SCREEN_VIEW_EVENTS = new Set(["screen_view"]);

export class BusinessInsightsError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.name = "BusinessInsightsError";
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
    throw new BusinessInsightsError(400, `${label} must be YYYY-MM-DD.`, { code: "business_invalid_date" });
  }
  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || utcDay(parsed) !== day) {
    throw new BusinessInsightsError(400, `${label} must be a valid calendar date.`, { code: "business_invalid_date" });
  }
  return day;
}

export function resolveBusinessRange(request) {
  const url = new URL(request.url);
  const preset = url.searchParams.get("range") || "7d";
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");

  if (startParam || endParam) {
    if (!startParam || !endParam) {
      throw new BusinessInsightsError(400, "Custom range requires start and end.", { code: "business_invalid_range" });
    }
    const start = parseDay(startParam, "start");
    const end = parseDay(endParam, "end");
    if (start > end) {
      throw new BusinessInsightsError(400, "start must be on or before end.", { code: "business_invalid_range" });
    }
    const days = Math.floor((Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86_400_000) + 1;
    if (days > MAX_RANGE_DAYS) {
      throw new BusinessInsightsError(400, `Range cannot exceed ${MAX_RANGE_DAYS} days.`, { code: "business_range_too_large" });
    }
    return {
      preset: "custom",
      start,
      end,
      since: `${start}T00:00:00.000Z`,
      until: `${addDays(end, 1)}T00:00:00.000Z`,
    };
  }

  if (!VALID_PRESETS.has(preset)) {
    throw new BusinessInsightsError(400, "Invalid range. Use 24h, 7d, 30d, or 90d.", { code: "business_invalid_range" });
  }

  const hours = preset === "24h" ? 24 : preset === "30d" ? 24 * 30 : preset === "90d" ? 24 * 90 : 24 * 7;
  const untilDate = new Date();
  const sinceDate = new Date(untilDate.getTime() - hours * 60 * 60 * 1000);
  return {
    preset,
    start: utcDay(sinceDate),
    end: utcDay(untilDate),
    since: sinceDate.toISOString(),
    until: untilDate.toISOString(),
  };
}

function countBy(rows, key, limit = 10) {
  const counts = new Map();
  for (const row of rows) {
    const value = row?.[key] || "unknown";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function uniqueCount(rows, key) {
  return new Set(rows.map((row) => row?.[key]).filter(Boolean)).size;
}

function dayKey(iso) {
  return iso ? String(iso).slice(0, 10) : null;
}

function isViewEvent(row) {
  if (VIEW_EVENTS.has(row.event_name)) return true;
  return ["video", "place", "route", "user", "profile"].includes(row.entity_type) && /view|impression/i.test(row.event_name || "");
}

function isActionEvent(row) {
  return ACTION_EVENTS.has(row.event_name);
}

function contentScore(metrics) {
  return (
    (metrics.views || 0) * 1 +
    (metrics.likes || 0) * 3 +
    (metrics.saves || 0) * 5 +
    (metrics.shares || 0) * 6 +
    (metrics.route_starts || 0) * 4 -
    (metrics.reports || 0) * 10
  );
}

function shortenId(value) {
  if (!value || typeof value !== "string") return null;
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function warning(code, message, severity = "warning") {
  return { code, severity, message };
}

async function detectDeadLetterTimeColumn(supabase) {
  for (const column of ["received_at", "created_at"]) {
    const { error } = await supabase.from(DEAD_LETTERS_TABLE).select(column, { count: "exact", head: true }).limit(1);
    if (!error) return column;
  }
  return null;
}

async function fetchEventsSample(supabase, since, until) {
  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .select("event_id, event_name, entity_type, entity_id, user_id, anonymous_id, session_id, source, platform, country, region, city, received_at, occurred_at, properties, context")
    .gte("received_at", since)
    .lt("received_at", until)
    .order("received_at", { ascending: false })
    .limit(SAMPLE_LIMIT);

  if (error) throw error;
  return data || [];
}

async function countDeadLetters(supabase, since, until) {
  const column = await detectDeadLetterTimeColumn(supabase);
  if (!column) return { count: 0, warning: warning("dead_letters_time_column_unavailable", "Dead-letter timestamp column unavailable.") };
  const { count, error } = await supabase
    .from(DEAD_LETTERS_TABLE)
    .select("id", { count: "exact", head: true })
    .gte(column, since)
    .lt(column, until);
  if (error) return { count: 0, warning: warning("dead_letters_unavailable", "Dead-letter counts unavailable.") };
  return { count: count || 0, warning: null };
}

function buildDailySeries(rows) {
  const buckets = new Map();
  for (const row of rows) {
    const day = dayKey(row.received_at || row.occurred_at);
    if (!day) continue;
    const current = buckets.get(day) || {
      day,
      events: 0,
      sessions: new Set(),
      anonymous: new Set(),
      authenticated: new Set(),
      app_opens: 0,
      content_views: 0,
      searches: 0,
      no_results: 0,
    };
    current.events += 1;
    if (row.session_id) current.sessions.add(row.session_id);
    if (row.anonymous_id) current.anonymous.add(row.anonymous_id);
    if (row.user_id) current.authenticated.add(row.user_id);
    if (APP_OPEN_EVENTS.has(row.event_name)) current.app_opens += 1;
    if (isViewEvent(row)) current.content_views += 1;
    if (SEARCH_EVENTS.has(row.event_name) && row.event_name !== "search_result_clicked") current.searches += 1;
    if (row.event_name === "search_no_results") current.no_results += 1;
    buckets.set(day, current);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      day: bucket.day,
      events: bucket.events,
      sessions: bucket.sessions.size,
      active_anonymous_ids: bucket.anonymous.size,
      active_authenticated_users: bucket.authenticated.size,
      app_opens: bucket.app_opens,
      content_views: bucket.content_views,
      searches: bucket.searches,
      no_results: bucket.no_results,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

function estimateNewAndReturning(rows, idKey) {
  const firstSeen = new Map();
  for (const row of rows) {
    const id = row[idKey];
    const day = dayKey(row.received_at || row.occurred_at);
    if (!id || !day) continue;
    const current = firstSeen.get(id);
    if (!current || day < current) firstSeen.set(id, day);
  }

  const byDay = new Map();
  for (const [id, firstDay] of firstSeen.entries()) {
    const bucket = byDay.get(firstDay) || { day: firstDay, new_ids: new Set(), seen_ids: new Set() };
    bucket.new_ids.add(id);
    byDay.set(firstDay, bucket);
  }

  for (const row of rows) {
    const id = row[idKey];
    const day = dayKey(row.received_at || row.occurred_at);
    if (!id || !day) continue;
    const bucket = byDay.get(day) || { day, new_ids: new Set(), seen_ids: new Set() };
    bucket.seen_ids.add(id);
    byDay.set(day, bucket);
  }

  let estimatedNew = 0;
  let estimatedReturning = 0;
  for (const bucket of byDay.values()) {
    estimatedNew += bucket.new_ids.size;
    for (const id of bucket.seen_ids) {
      if (!bucket.new_ids.has(id)) estimatedReturning += 1;
    }
  }

  return {
    estimated_new: estimatedNew,
    estimated_returning: estimatedReturning,
  };
}

function extractCreatorId(row) {
  const props = row.properties && typeof row.properties === "object" ? row.properties : {};
  const context = row.context && typeof row.context === "object" ? row.context : {};
  const candidates = [
    props.creator_id,
    props.producer_id,
    props.owner_id,
    props.author_id,
    context.creator_id,
    context.producer_id,
    context.owner_id,
    context.author_id,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function extractQueryHash(row) {
  const props = row.properties && typeof row.properties === "object" ? row.properties : {};
  const hash = props.query_hash || props.search_query_hash;
  return typeof hash === "string" && hash.trim() ? hash.trim() : null;
}

function buildContentSections(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.entity_id || !row.entity_type) continue;
    if (!["video", "place", "route", "user", "profile"].includes(row.entity_type)) continue;
    const type = row.entity_type === "profile" ? "user" : row.entity_type;
    const key = `${type}:${row.entity_id}`;
    const current = groups.get(key) || {
      entity_type: type,
      entity_id: row.entity_id,
      entity_id_short: shortenId(row.entity_id),
      views: 0,
      likes: 0,
      saves: 0,
      shares: 0,
      reports: 0,
      route_starts: 0,
    };
    if (isViewEvent(row)) current.views += 1;
    if (LIKE_EVENTS.has(row.event_name)) current.likes += 1;
    if (SAVE_EVENTS.has(row.event_name)) current.saves += 1;
    if (SHARE_EVENTS.has(row.event_name)) current.shares += 1;
    if (row.event_name === "report_submitted") current.reports += 1;
    if (row.event_name === "route_start") current.route_starts += 1;
    groups.set(key, current);
  }

  const items = [...groups.values()].map((item) => ({
    ...item,
    engagement_score: contentScore(item),
  }));

  const byType = (type) =>
    items
      .filter((item) => item.entity_type === type)
      .sort((a, b) => b.engagement_score - a.engagement_score || b.views - a.views)
      .slice(0, 20);

  return {
    videos: byType("video"),
    places: byType("place"),
    routes: byType("route"),
    profiles: byType("user"),
  };
}

function buildBaseWarnings(rows) {
  const warnings = [];
  if (rows.length === 0) {
    warnings.push(warning("no_events_in_range", "No analytics events were found in the selected range."));
  }
  if (rows.length >= SAMPLE_LIMIT) {
    warnings.push(warning("sample_capped", `Insights are computed from the latest ${SAMPLE_LIMIT} events in range.`, "info"));
  }
  const mobileCount = rows.filter((row) => row.source === "mobile" || row.platform === "ios" || row.platform === "android").length;
  if (rows.length > 0 && mobileCount === 0) {
    warnings.push(
      warning(
        "no_mobile_events_in_range",
        "No mobile analytics events were found in this range. DATA-003 may still be pending QA/release.",
      ),
    );
  }
  return warnings;
}

export async function getBusinessOverview(supabase, params) {
  const rows = await fetchEventsSample(supabase, params.since, params.until);
  const dead = await countDeadLetters(supabase, params.since, params.until);
  const warnings = buildBaseWarnings(rows);
  if (dead.warning) warnings.push(dead.warning);

  const appOpens = rows.filter((row) => APP_OPEN_EVENTS.has(row.event_name)).length;
  const contentViews = rows.filter(isViewEvent).length;
  const actions = rows.filter(isActionEvent).length;
  const videoViews = rows.filter((row) => row.entity_type === "video" && isViewEvent(row)).length;
  const placeViews = rows.filter((row) => row.entity_type === "place" && isViewEvent(row)).length;
  const routeViews = rows.filter((row) => row.entity_type === "route" && isViewEvent(row)).length;
  const profileViews = rows.filter((row) => (row.entity_type === "user" || row.entity_type === "profile") && isViewEvent(row)).length;
  const searches = rows.filter((row) => SEARCH_EVENTS.has(row.event_name) && row.event_name !== "search_result_clicked").length;
  const saves = rows.filter((row) => SAVE_EVENTS.has(row.event_name)).length;
  const likes = rows.filter((row) => LIKE_EVENTS.has(row.event_name)).length;
  const shares = rows.filter((row) => SHARE_EVENTS.has(row.event_name)).length;
  const reports = rows.filter((row) => row.event_name === "report_submitted").length;
  const sessions = uniqueCount(rows, "session_id");
  const activeAnonymous = uniqueCount(rows, "anonymous_id");
  const activeAuthenticated = uniqueCount(rows, "user_id");

  return {
    range: { start: params.start, end: params.end, preset: params.preset },
    summary: {
      total_events: rows.length,
      app_opens: appOpens,
      active_anonymous_ids: activeAnonymous,
      active_authenticated_users: activeAuthenticated,
      active_sessions: sessions,
      content_views_total: contentViews,
      video_views: videoViews,
      place_views: placeViews,
      route_views: routeViews,
      profile_views: profileViews,
      searches_total: searches,
      saves_total: saves,
      likes_total: likes,
      shares_total: shares,
      reports_total: reports,
      dead_letters_total: dead.count,
      engagement_rate_estimate: contentViews > 0 ? Math.round((actions / contentViews) * 1000) / 10 : 0,
      conversion_estimate: {
        app_open_to_content_view: appOpens > 0 ? Math.round((contentViews / appOpens) * 1000) / 10 : 0,
        content_view_to_action: contentViews > 0 ? Math.round((actions / contentViews) * 1000) / 10 : 0,
      },
    },
    breakdowns: {
      top_event_names: countBy(rows, "event_name"),
      top_sources: countBy(rows, "source"),
      top_platforms: countBy(rows, "platform"),
    },
    series: buildDailySeries(rows),
    warnings,
  };
}

export async function getGrowthInsights(supabase, params) {
  const rows = await fetchEventsSample(supabase, params.since, params.until);
  const warnings = buildBaseWarnings(rows);
  const anonymousStats = estimateNewAndReturning(rows, "anonymous_id");
  const authStats = estimateNewAndReturning(rows, "user_id");
  const series = buildDailySeries(rows);

  return {
    range: { start: params.start, end: params.end, preset: params.preset },
    summary: {
      active_anonymous_ids: uniqueCount(rows, "anonymous_id"),
      active_authenticated_users: uniqueCount(rows, "user_id"),
      sessions: uniqueCount(rows, "session_id"),
      app_opens: rows.filter((row) => APP_OPEN_EVENTS.has(row.event_name)).length,
      estimated_new_anonymous_ids: anonymousStats.estimated_new,
      estimated_returning_anonymous_ids: anonymousStats.estimated_returning,
      estimated_new_authenticated_users: authStats.estimated_new,
      estimated_returning_authenticated_users: authStats.estimated_returning,
    },
    breakdowns: {
      platform_split: countBy(rows, "platform"),
      source_split: countBy(rows, "source"),
    },
    series,
    warnings,
  };
}

export async function getEngagementFunnel(supabase, params) {
  const rows = await fetchEventsSample(supabase, params.since, params.until);
  const warnings = buildBaseWarnings(rows);

  const steps = [
    {
      key: "app_open",
      label: "App open",
      rows: rows.filter((row) => APP_OPEN_EVENTS.has(row.event_name)),
    },
    {
      key: "screen_view",
      label: "Screen view",
      rows: rows.filter((row) => SCREEN_VIEW_EVENTS.has(row.event_name)),
    },
    {
      key: "content_view",
      label: "Content view",
      rows: rows.filter(isViewEvent),
    },
    {
      key: "content_action",
      label: "Content action",
      rows: rows.filter(isActionEvent),
    },
    {
      key: "conversion",
      label: "Creator / conversion action",
      rows: rows.filter((row) =>
        ["follow_user", "route_complete", "place_get_directions", "place_call", "place_website_click", "report_submitted"].includes(
          row.event_name,
        ),
      ),
    },
  ];

  const funnel = steps.map((step, index) => {
    const count = step.rows.length;
    const sessions = uniqueCount(step.rows, "session_id");
    const previous = index === 0 ? count : steps[index - 1].rows.length;
    const dropoff_pct = previous > 0 ? Math.round(((previous - count) / previous) * 1000) / 10 : 0;
    return {
      key: step.key,
      label: step.label,
      count,
      unique_sessions: sessions,
      dropoff_pct: index === 0 ? 0 : Math.max(dropoff_pct, 0),
    };
  });

  if (!rows.some((row) => APP_OPEN_EVENTS.has(row.event_name))) {
    warnings.push(warning("funnel_taxonomy_incomplete", "app_open events are missing; funnel estimates may be incomplete."));
  }

  return {
    range: { start: params.start, end: params.end, preset: params.preset },
    summary: {
      steps: funnel.length,
      top_of_funnel: funnel[0]?.count || 0,
      bottom_of_funnel: funnel[funnel.length - 1]?.count || 0,
    },
    funnel,
    warnings,
  };
}

export async function getContentPerformance(supabase, params) {
  const rows = await fetchEventsSample(supabase, params.since, params.until);
  const warnings = buildBaseWarnings(rows);
  const sections = buildContentSections(rows);
  if (
    sections.videos.length === 0 &&
    sections.places.length === 0 &&
    sections.routes.length === 0 &&
    sections.profiles.length === 0
  ) {
    warnings.push(warning("content_entities_missing", "No content entity_id/entity_type events were found in range."));
  }

  return {
    range: { start: params.start, end: params.end, preset: params.preset },
    summary: {
      videos_count: sections.videos.length,
      places_count: sections.places.length,
      routes_count: sections.routes.length,
      profiles_count: sections.profiles.length,
    },
    sections,
    warnings,
  };
}

export async function getSearchInsights(supabase, params) {
  const rows = await fetchEventsSample(supabase, params.since, params.until);
  const warnings = buildBaseWarnings(rows);
  const searchRows = rows.filter(
    (row) => SEARCH_EVENTS.has(row.event_name) || row.entity_type === "search",
  );
  const submitted = searchRows.filter((row) => ["search_performed", "search_submitted"].includes(row.event_name));
  const noResults = searchRows.filter((row) => row.event_name === "search_no_results");
  const clicks = searchRows.filter((row) => row.event_name === "search_result_clicked");
  const contentViews = rows.filter(isViewEvent).length;

  const hashCounts = new Map();
  let missingHash = 0;
  for (const row of submitted) {
    const hash = extractQueryHash(row);
    if (!hash) {
      missingHash += 1;
      continue;
    }
    hashCounts.set(hash, (hashCounts.get(hash) || 0) + 1);
  }
  if (missingHash > 0) {
    warnings.push(warning("missing_query_hash", "Some search events are missing query_hash.", "info"));
  }

  const series = buildDailySeries(rows).map((item) => ({
    day: item.day,
    searches: item.searches,
    no_results: item.no_results,
  }));

  return {
    range: { start: params.start, end: params.end, preset: params.preset },
    summary: {
      total_searches: submitted.length,
      no_result_searches: noResults.length,
      no_result_rate: submitted.length > 0 ? Math.round((noResults.length / submitted.length) * 1000) / 10 : 0,
      search_to_content_view_estimate: submitted.length > 0 ? Math.round((contentViews / submitted.length) * 1000) / 10 : 0,
      result_clicks: clicks.length,
    },
    breakdowns: {
      top_query_hashes: [...hashCounts.entries()]
        .map(([query_hash, count]) => ({ query_hash, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      top_search_entity_types: countBy(clicks, "entity_type"),
    },
    series,
    warnings,
  };
}

export async function getCreatorPerformance(supabase, params) {
  const rows = await fetchEventsSample(supabase, params.since, params.until);
  const warnings = buildBaseWarnings(rows);
  const creators = new Map();
  let creatorEvents = 0;

  for (const row of rows) {
    const creatorId = extractCreatorId(row);
    if (!creatorId) continue;
    creatorEvents += 1;
    const current = creators.get(creatorId) || {
      creator_id: creatorId,
      creator_id_short: shortenId(creatorId),
      views: 0,
      likes: 0,
      saves: 0,
      shares: 0,
      reports: 0,
      route_starts: 0,
    };
    if (isViewEvent(row)) current.views += 1;
    if (LIKE_EVENTS.has(row.event_name)) current.likes += 1;
    if (SAVE_EVENTS.has(row.event_name)) current.saves += 1;
    if (SHARE_EVENTS.has(row.event_name)) current.shares += 1;
    if (row.event_name === "report_submitted") current.reports += 1;
    if (row.event_name === "route_start") current.route_starts += 1;
    creators.set(creatorId, current);
  }

  if (creatorEvents === 0) {
    warnings.push(
      warning(
        "creator_id_not_in_analytics_events",
        "creator_id is not present in analytics events. Add creator_id to future safe event properties to unlock creator insights.",
      ),
    );
  }

  const items = [...creators.values()]
    .map((item) => ({ ...item, engagement_score: contentScore(item) }))
    .sort((a, b) => b.engagement_score - a.engagement_score)
    .slice(0, 20);

  return {
    range: { start: params.start, end: params.end, preset: params.preset },
    summary: {
      creators_count: items.length,
      creator_events: creatorEvents,
    },
    creators: items,
    warnings,
  };
}

export async function getLocationInterest(supabase, params) {
  const rows = await fetchEventsSample(supabase, params.since, params.until);
  const warnings = buildBaseWarnings(rows);
  const withLocation = rows.filter((row) => row.country || row.region || row.city);
  if (withLocation.length === 0) {
    warnings.push(warning("location_metadata_missing", "No country/region/city metadata was found in analytics events."));
  }

  function aggregate(key) {
    const map = new Map();
    for (const row of withLocation) {
      const value = row[key];
      if (!value) continue;
      const current = map.get(value) || {
        [key]: value,
        events: 0,
        sessions: new Set(),
        content_views: 0,
        searches: 0,
      };
      current.events += 1;
      if (row.session_id) current.sessions.add(row.session_id);
      if (isViewEvent(row)) current.content_views += 1;
      if (SEARCH_EVENTS.has(row.event_name) && row.event_name !== "search_result_clicked") current.searches += 1;
      map.set(value, current);
    }
    return [...map.values()]
      .filter((item) => item.events >= LOCATION_MIN_EVENTS)
      .map((item) => ({
        [key]: item[key],
        events: item.events,
        sessions: item.sessions.size,
        content_views: item.content_views,
        searches: item.searches,
      }))
      .sort((a, b) => b.events - a.events)
      .slice(0, 20);
  }

  return {
    range: { start: params.start, end: params.end, preset: params.preset },
    summary: {
      events_with_location: withLocation.length,
      min_city_threshold: LOCATION_MIN_EVENTS,
    },
    countries: aggregate("country"),
    regions: aggregate("region"),
    cities: aggregate("city"),
    warnings,
  };
}

export async function getInvestorSnapshot(supabase, params) {
  const overview = await getBusinessOverview(supabase, params);
  const growth = await getGrowthInsights(supabase, params);
  const locations = await getLocationInterest(supabase, params);
  const content = await getContentPerformance(supabase, params);

  const notes = [];
  if (overview.warnings.some((item) => item.code === "no_mobile_events_in_range")) {
    notes.push("Mobile analytics (DATA-003) are not yet visible in this period.");
  }
  if (overview.summary.total_events < 50) {
    notes.push("Event volume is still early-stage; treat metrics as directional estimates.");
  }
  if (locations.warnings.some((item) => item.code === "location_metadata_missing")) {
    notes.push("Location metadata is sparse; market breakdown is limited.");
  }

  const topContentTypes = [
    { type: "video", count: overview.summary.video_views },
    { type: "place", count: overview.summary.place_views },
    { type: "route", count: overview.summary.route_views },
    { type: "profile", count: overview.summary.profile_views },
  ]
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    range: { start: params.start, end: params.end, preset: params.preset },
    period: params.preset === "custom" ? `${params.start}_to_${params.end}` : `last_${params.preset}`,
    snapshot: {
      period: params.preset === "custom" ? `${params.start}_to_${params.end}` : `last_${params.preset}`,
      active_users_estimate: overview.summary.active_anonymous_ids + overview.summary.active_authenticated_users,
      sessions: overview.summary.active_sessions,
      events: overview.summary.total_events,
      content_views: overview.summary.content_views_total,
      searches: overview.summary.searches_total,
      engagement_actions:
        overview.summary.likes_total + overview.summary.saves_total + overview.summary.shares_total,
      top_content_types: topContentTypes,
      top_markets: locations.countries.slice(0, 5).map((item) => ({
        country: item.country,
        events: item.events,
      })),
      growth_notes: [
        `Estimated new anonymous IDs: ${growth.summary.estimated_new_anonymous_ids}`,
        `Estimated returning anonymous IDs: ${growth.summary.estimated_returning_anonymous_ids}`,
        `App opens: ${overview.summary.app_opens}`,
      ],
      data_quality_notes: notes,
    },
    copy_text: [
      `Period: ${params.start} to ${params.end}`,
      `Active users (estimate): ${overview.summary.active_anonymous_ids + overview.summary.active_authenticated_users}`,
      `Sessions: ${overview.summary.active_sessions}`,
      `Events: ${overview.summary.total_events}`,
      `Content views: ${overview.summary.content_views_total}`,
      `Searches: ${overview.summary.searches_total}`,
      `Engagement actions: ${
        overview.summary.likes_total + overview.summary.saves_total + overview.summary.shares_total
      }`,
      ...notes.map((note) => `Note: ${note}`),
    ].join("\n"),
    warnings: [...overview.warnings, ...growth.warnings, ...locations.warnings, ...content.warnings].filter(
      (item, index, arr) => arr.findIndex((entry) => entry.code === item.code) === index,
    ),
  };
}
