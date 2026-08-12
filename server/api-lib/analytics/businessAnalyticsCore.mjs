/**
 * Explore Business Analytics Core.
 *
 * Pure, versioned business definitions. This module intentionally has no HTTP,
 * Supabase, or UI dependencies so Admin, Business Web, Mobile, and partner APIs
 * can all return the same metrics and interpretations.
 */

export const BUSINESS_ANALYTICS_CORE_VERSION = "v2";
export const EVENT_TAXONOMY_VERSION = "v1";
export const METRICS_DICTIONARY_VERSION = "v1";
export const DEMAND_INDEX_VERSION = "v1";
export const OPPORTUNITY_SCORE_VERSION = "v1";
export const BUSINESS_SCORE_VERSION = "v1";

export const MIN_RELIABLE_SAMPLE = 10;
export const MIN_TREND_BASELINE = 8;
export const MIN_EVENTS_FOR_TREND = 8;
export const MIN_USERS_FOR_SEGMENT = 5;
export const MIN_SAMPLE_FOR_BENCHMARK = 4;
export const MIN_SEARCHES_FOR_OPPORTUNITY = 5;

const KPI_VIEW_EVENTS = new Set([
  "content_view", "video_view", "video_view_start", "place_view", "route_view",
  "user_profile_view", "profile_view", "place_photo_view",
]);
const KPI_SAVE_EVENTS = new Set(["content_save", "video_save", "place_save", "route_save", "place_photo_save"]);
const KPI_SHARE_EVENTS = new Set(["content_share", "video_share", "place_share", "route_share", "place_photo_share", "share"]);
const KPI_SEARCH_EVENTS = new Set(["search_performed", "search_submitted", "search_no_results"]);
const KPI_COMMERCIAL_EVENTS = new Set([
  "place_get_directions", "place_call", "place_website_click", "place_map_open", "place_open_map",
]);

export const EVENT_TAXONOMY = Object.freeze({
  place_impression: taxonomy("discovery", "Place appeared in a traveler discovery surface.", ["entity_id"], "place"),
  route_impression: taxonomy("discovery", "Route appeared in a traveler discovery surface.", ["entity_id"], "route"),
  content_impression: taxonomy("discovery", "Content appeared in a traveler discovery surface.", ["entity_id"]),
  search_performed: taxonomy("discovery", "Traveler submitted a search.", ["query_hash", "results_count"], "search"),
  search_submitted: taxonomy("discovery", "Legacy alias for a submitted search.", ["query_hash"], "search"),
  search_result_clicked: taxonomy("engagement", "Traveler selected a search result.", ["query_hash", "entity_id"], "search"),
  search_no_results: taxonomy("discovery", "Submitted search returned zero results.", ["query_hash"], "search"),
  place_view: taxonomy("engagement", "Traveler opened a place detail.", ["entity_id"], "place"),
  route_view: taxonomy("engagement", "Traveler opened a route detail.", ["entity_id"], "route"),
  content_view: taxonomy("engagement", "Traveler opened content detail.", ["entity_id"]),
  place_save: taxonomy("engagement", "Traveler saved a place.", ["entity_id"], "place"),
  route_save: taxonomy("engagement", "Traveler saved a route.", ["entity_id"], "route"),
  share: taxonomy("engagement", "Traveler shared an Explore entity.", ["entity_id"]),
  rating_submit: taxonomy("engagement", "Traveler submitted a rating.", ["entity_id", "rating"], "place"),
  route_start: taxonomy("navigation", "Traveler started a route.", ["entity_id"], "route"),
  route_stop_view: taxonomy("navigation", "Traveler reached or opened a route stop.", ["entity_id", "stop_id", "stop_index"], "route"),
  route_step_view: taxonomy("navigation", "Legacy alias for a viewed route stop.", ["entity_id", "stop_index"], "route"),
  route_complete: taxonomy("navigation", "Traveler completed a route.", ["entity_id"], "route"),
  place_get_directions: taxonomy("commercial", "Traveler requested directions to a place.", ["entity_id"], "place"),
  place_call: taxonomy("commercial", "Traveler initiated a call to a place.", ["entity_id"], "place"),
  place_website_click: taxonomy("commercial", "Traveler opened a place website.", ["entity_id"], "place"),
  place_map_open: taxonomy("commercial", "Traveler opened a place on the map.", ["entity_id"], "place"),
  place_open_map: taxonomy("commercial", "Legacy alias for a place map open.", ["entity_id"], "place"),
});

export const METRIC_DICTIONARY = Object.freeze({
  active_travelers: metric(
    "Active travelers",
    "Distinct privacy-safe user or anonymous actor IDs that produced an eligible event.",
    "count_distinct(coalesce(user_id, anonymous_id))",
  ),
  sessions: metric("Sessions", "Distinct eligible Explore sessions.", "count_distinct(session_id)"),
  searches: metric(
    "Searches",
    "Valid search_performed/search_submitted events after idempotency and traffic-quality filtering.",
    "count(search_performed | search_submitted)",
  ),
  place_discoveries: metric(
    "Place discoveries",
    "Eligible place impressions. When impression tracking is unavailable, the API marks this metric unavailable instead of substituting views.",
    "count(place_impression)",
  ),
  place_views: metric(
    "Place views",
    "Valid place_view events after event-id deduplication and analytics eligibility filtering.",
    "count(place_view)",
  ),
  unique_place_visitors: metric(
    "Unique place visitors",
    "Distinct privacy-safe actors generating valid place views.",
    "count_distinct(actor_id where event_name = place_view)",
  ),
  route_views: metric("Route views", "Valid route detail views.", "count(route_view)"),
  route_starts: metric("Route starts", "Valid route starts.", "count(route_start)"),
  route_completions: metric("Route completions", "Valid route completions.", "count(route_complete)"),
  route_completion_rate: metric(
    "Route completion rate",
    "Percentage of route starts that reached route_complete.",
    "route_completions / route_starts",
    "rate",
  ),
  saves: metric("Saves", "Eligible save events across places, routes, and content.", "count(*_save)"),
  shares: metric("Shares", "Eligible share events across places, routes, and content.", "count(*_share | share)"),
  commercial_actions: metric(
    "Commercial actions",
    "Directions, calls, website visits, and map opens generated for places.",
    "directions + calls + website_clicks + map_opens",
  ),
  intent_rate: metric(
    "Intent rate",
    "Percentage of place viewers who performed a high-intent action such as directions, call, website visit, or map open.",
    "commercial_actions / place_views",
    "rate",
  ),
  search_ctr: metric(
    "Search CTR",
    "Percentage of submitted searches followed by a search result click.",
    "search_result_clicks / searches",
    "rate",
  ),
  demand_index: metric(
    "Explore Demand Index",
    "Equal-weight composite of reliable period-over-period demand signals. A stable signal scores 50; doubling scores 75; halving scores 25. Low baselines are excluded.",
    "mean(clamp(50 + 25 * log2((current + 1) / (previous + 1)), 0, 100))",
    "index",
    DEMAND_INDEX_VERSION,
  ),
  opportunity_score: metric(
    "Explore Opportunity Score",
    "Equal-weight percentile score of category demand, growth, search/intent engagement, saves, market momentum, and inverse supply/competition.",
    "mean(cohort_percentile(signal))",
    "index",
    OPPORTUNITY_SCORE_VERSION,
  ),
  business_score: metric(
    "Explore Business Score",
    "Equal-weight cohort percentile score for discovery, engagement, intent, growth, and reputation.",
    "mean(cohort_percentile(component))",
    "index",
    BUSINESS_SCORE_VERSION,
  ),
});

function taxonomy(stage, description, requiredProperties = [], entityType = null) {
  return Object.freeze({
    owner: "Explore Data",
    description,
    stage,
    entity_type: entityType,
    properties: [],
    required_properties: requiredProperties,
    version: 1,
    status: "active",
  });
}

function metric(label, description, formula, format = "number", version = METRICS_DICTIONARY_VERSION) {
  return Object.freeze({ label, description, formula, format, version });
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function percent(numerator, denominator) {
  if (!denominator) return null;
  return round((numerator / denominator) * 100);
}

export function metricDefinitionsForClient() {
  return {
    version: METRICS_DICTIONARY_VERSION,
    metrics: METRIC_DICTIONARY,
  };
}

export function eventTaxonomyForClient() {
  return {
    version: EVENT_TAXONOMY_VERSION,
    events: EVENT_TAXONOMY,
  };
}

export function calculateCanonicalKpis(rows = []) {
  const actors = new Set();
  const sessions = new Set();
  const placeViewActors = new Set();
  let placeViews = 0;
  let routeViews = 0;
  let routeStarts = 0;
  let routeCompletions = 0;
  let saves = 0;
  let shares = 0;
  let commercialActions = 0;
  let searches = 0;
  let placeImpressions = 0;
  let placeSaves = 0;

  for (const row of rows) {
    if (row?.user_id) actors.add(`u:${row.user_id}`);
    else if (row?.anonymous_id) actors.add(`a:${row.anonymous_id}`);
    if (row?.session_id) sessions.add(row.session_id);
    const name = row?.event_name;
    if (name === "place_view" || (row?.entity_type === "place" && KPI_VIEW_EVENTS.has(name))) {
      placeViews += 1;
      if (row?.user_id) placeViewActors.add(`u:${row.user_id}`);
      else if (row?.anonymous_id) placeViewActors.add(`a:${row.anonymous_id}`);
    }
    if (name === "route_view" || (row?.entity_type === "route" && KPI_VIEW_EVENTS.has(name))) routeViews += 1;
    if (name === "route_start") routeStarts += 1;
    if (name === "route_complete") routeCompletions += 1;
    if (KPI_SAVE_EVENTS.has(name)) saves += 1;
    if (KPI_SHARE_EVENTS.has(name)) shares += 1;
    if (KPI_COMMERCIAL_EVENTS.has(name)) commercialActions += 1;
    if (KPI_SEARCH_EVENTS.has(name)) searches += 1;
    if (name === "place_impression") placeImpressions += 1;
    if (name === "place_save") placeSaves += 1;
  }

  return {
    active_users: actors.size,
    active_travelers: actors.size,
    sessions: sessions.size,
    place_discoveries: placeImpressions,
    place_views: placeViews,
    unique_place_visitors: placeViewActors.size,
    route_views: routeViews,
    route_starts: routeStarts,
    route_completions: routeCompletions,
    saves,
    shares,
    commercial_intent: commercialActions,
    commercial_actions: commercialActions,
    searches,
    place_impressions: placeImpressions,
    place_saves: placeSaves,
    total_events: rows.length,
    route_completion_rate: percent(routeCompletions, routeStarts),
    intent_rate: percent(commercialActions, placeViews),
  };
}

export function periodDelta(currentValue, previousValue) {
  const current = safeNumber(currentValue);
  const previous = safeNumber(previousValue);
  const absolute = current - previous;
  return {
    current,
    previous,
    absolute,
    percent: previous > 0 ? round((absolute / previous) * 100) : null,
    reliable: previous >= MIN_TREND_BASELINE,
  };
}

/**
 * Symmetric, explainable period-ratio normalization.
 * - unchanged = 50
 * - 2x = 75
 * - 4x = 100
 * - 0.5x = 25
 * Signals below the baseline are omitted instead of magnifying 1 → 2 noise.
 */
export function normalizePeriodRatio(currentValue, previousValue, minBaseline = MIN_TREND_BASELINE) {
  const current = safeNumber(currentValue);
  const previous = safeNumber(previousValue);
  if (previous < minBaseline) return null;
  return round(clamp(50 + 25 * Math.log2((current + 1) / (previous + 1))));
}

function levelForScore(score) {
  if (score == null) return "Insufficient data";
  if (score >= 67) return "High";
  if (score >= 34) return "Moderate";
  return "Low";
}

function momentumForScore(score) {
  if (score == null) return "Insufficient data";
  if (score >= 58) return "Rising";
  if (score <= 42) return "Declining";
  return "Stable";
}

export function calculateDemandIndex(current = {}, previous = {}) {
  const signalKeys = [
    "active_users",
    "sessions",
    "searches",
    "place_views",
    "route_views",
    "saves",
    "route_starts",
    "commercial_intent",
  ];
  const components = signalKeys.map((key) => ({
    key,
    current: safeNumber(current[key]),
    previous: safeNumber(previous[key]),
    score: normalizePeriodRatio(current[key], previous[key]),
  }));
  const reliable = components.filter((item) => item.score != null);
  const score = reliable.length >= 3 ? Math.round(reliable.reduce((sum, item) => sum + item.score, 0) / reliable.length) : null;
  const growth = periodDelta(current.active_users, previous.active_users);
  const intentRate = percent(current.commercial_intent, current.place_views);
  const previousIntentRate = percent(previous.commercial_intent, previous.place_views);
  const intentScore = normalizePeriodRatio(intentRate, previousIntentRate, 1);

  return {
    score,
    version: DEMAND_INDEX_VERSION,
    status: score == null ? "insufficient_data" : "ready",
    label: levelForScore(score),
    demand: levelForScore(score),
    growth_pct: growth.reliable ? growth.percent : null,
    growth: growth.reliable ? `${growth.percent > 0 ? "+" : ""}${growth.percent}%` : "Insufficient data",
    intent: levelForScore(intentScore),
    supply: "See category supply matrix",
    momentum: momentumForScore(score),
    reliable_components: reliable.length,
    required_components: 3,
    formula: METRIC_DICTIONARY.demand_index.formula,
    components,
  };
}

function percentileRank(value, values, inverse = false) {
  const finite = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length || !Number.isFinite(Number(value))) return null;
  if (finite.length === 1) return 50;
  const below = finite.filter((item) => item < Number(value)).length;
  const equal = finite.filter((item) => item === Number(value)).length;
  const rank = ((below + Math.max(0, equal - 1) / 2) / (finite.length - 1)) * 100;
  return round(inverse ? 100 - rank : rank);
}

function scoreLabel(score) {
  if (score == null) return "Insufficient data";
  if (score >= 75) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

export function enrichCategoryIntelligence(categories = []) {
  const eligible = categories.filter((item) => safeNumber(item.demand) >= MIN_RELIABLE_SAMPLE);
  const cohort = {
    demand: eligible.map((item) => safeNumber(item.demand)),
    growth: eligible.map((item) => safeNumber(item.growth_pct)),
    searches: eligible.map((item) => safeNumber(item.searches)),
    intent_rate: eligible.map((item) => safeNumber(item.intent_rate)),
    save_rate: eligible.map((item) => safeNumber(item.save_rate)),
    supply: eligible.map((item) => safeNumber(item.supply)),
  };

  return categories.map((item) => {
    const reliable = safeNumber(item.demand) >= MIN_RELIABLE_SAMPLE;
    const components = reliable
      ? {
          demand: percentileRank(safeNumber(item.demand), cohort.demand),
          growth: item.growth_pct == null ? null : percentileRank(safeNumber(item.growth_pct), cohort.growth),
          search: percentileRank(safeNumber(item.searches), cohort.searches),
          intent: percentileRank(safeNumber(item.intent_rate), cohort.intent_rate),
          conversion: percentileRank(safeNumber(item.save_rate), cohort.save_rate),
          supply_gap: percentileRank(safeNumber(item.supply), cohort.supply, true),
          competition_gap: percentileRank(safeNumber(item.supply), cohort.supply, true),
        }
      : {};
    const available = Object.values(components).filter((value) => value != null);
    const opportunityScore = available.length >= 4 ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length) : null;
    const supplyScore = percentileRank(safeNumber(item.supply), cohort.supply);
    const demandScore = percentileRank(safeNumber(item.demand), cohort.demand);

    return {
      ...item,
      demand_index: reliable ? demandScore : null,
      demand_level: levelForScore(demandScore),
      supply_index: reliable ? supplyScore : null,
      supply_level: levelForScore(supplyScore),
      competition: levelForScore(supplyScore),
      opportunity_score: opportunityScore,
      opportunity_level: scoreLabel(opportunityScore),
      opportunity_version: OPPORTUNITY_SCORE_VERSION,
      opportunity_components: components,
      sample_size: safeNumber(item.demand),
      reliable,
    };
  });
}

function quartile(values, percentile) {
  const finite = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return null;
  const index = (finite.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return round(finite[lower]);
  return round(finite[lower] + (finite[upper] - finite[lower]) * (index - lower));
}

function average(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? round(finite.reduce((sum, value) => sum + value, 0) / finite.length) : null;
}

function placeRates(place) {
  const views = safeNumber(place.views);
  return {
    discovery: safeNumber(place.unique_visitors),
    engagement: percent(safeNumber(place.saves) + safeNumber(place.shares), views),
    intent: percent(safeNumber(place.actions), views),
    growth: place.trend_pct == null ? null : safeNumber(place.trend_pct),
    reputation: place.rating == null ? null : clamp((safeNumber(place.rating) / 5) * 100),
    view_to_save: percent(safeNumber(place.saves), views),
    view_to_directions: percent(safeNumber(place.directions), views),
  };
}

export function buildBusinessBenchmark(place, cohort = []) {
  if (!place) return null;
  const peers = cohort.filter((item) => item && item.place_id !== place.place_id && safeNumber(item.views) >= MIN_RELIABLE_SAMPLE);
  const all = [place, ...peers];
  const rateRows = all.map(placeRates);
  const own = rateRows[0];
  const componentScores = {
    discovery: percentileRank(own.discovery, rateRows.map((item) => item.discovery)),
    engagement: percentileRank(own.engagement, rateRows.map((item) => item.engagement)),
    intent: percentileRank(own.intent, rateRows.map((item) => item.intent)),
    growth: own.growth == null ? null : percentileRank(own.growth, rateRows.map((item) => item.growth)),
    reputation: own.reputation == null ? null : percentileRank(own.reputation, rateRows.map((item) => item.reputation)),
  };
  const available = Object.values(componentScores).filter((value) => value != null);
  const score = safeNumber(place.views) >= MIN_RELIABLE_SAMPLE && available.length >= 3 && all.length >= MIN_SAMPLE_FOR_BENCHMARK
    ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length)
    : null;

  const comparison = {};
  for (const key of ["view_to_save", "view_to_directions", "growth"]) {
    const values = rateRows.map((row) => row[key]).filter((value) => value != null);
    comparison[key] = {
      business: own[key],
      category_average: average(values),
      top_quartile: quartile(values, 0.75),
    };
  }

  return {
    place_id: place.place_id,
    place_name: place.place_name,
    score,
    label: scoreLabel(score),
    version: BUSINESS_SCORE_VERSION,
    components: componentScores,
    comparison,
    cohort_size: all.length,
    status: score == null ? "insufficient_data" : "ready",
  };
}

export function insightConfidence(sampleSize, comparisonSampleSize = null) {
  const sample = safeNumber(sampleSize);
  const comparison = comparisonSampleSize == null ? sample : safeNumber(comparisonSampleSize);
  const minimum = Math.min(sample, comparison);
  if (minimum >= 100) return "high";
  if (minimum >= 30) return "medium";
  return "low";
}

export function buildExecutiveSummary({ marketLabel, range, kpis = {}, previousKpis = {}, categories = [], peak = null }) {
  const demand = calculateDemandIndex(kpis, previousKpis);
  const travelerDelta = periodDelta(kpis.active_users, previousKpis.active_users);
  const intentDelta = periodDelta(kpis.commercial_intent, previousKpis.commercial_intent);
  const leader = [...categories].filter((item) => item.reliable).sort((a, b) => safeNumber(b.intent) - safeNumber(a.intent))[0] || null;
  const fastest = [...categories].filter((item) => item.reliable && item.growth_pct != null).sort((a, b) => b.growth_pct - a.growth_pct)[0] || null;
  const statements = [];

  if (travelerDelta.reliable && travelerDelta.percent != null) {
    statements.push(`Traveler demand ${travelerDelta.percent >= 0 ? "increased" : "decreased"} ${Math.abs(travelerDelta.percent)}% compared with the previous period.`);
  } else {
    statements.push("There is not enough comparison volume yet to make a reliable traveler-demand claim.");
  }
  if (leader && safeNumber(leader.intent) > 0) statements.push(`${leader.category} generated the largest measured share of commercial intent.`);
  if (fastest && safeNumber(fastest.previous_demand) >= MIN_TREND_BASELINE && fastest.growth_pct >= 15) {
    statements.push(`${fastest.category} was the fastest-growing reliable category at +${fastest.growth_pct}%.`);
  }
  if (peak?.peak_window?.label && safeNumber(peak.peak_window.sample_size) >= MIN_RELIABLE_SAMPLE) {
    statements.push(`${peak.peak_window.label} was the strongest measured demand window.`);
  }

  return {
    market: marketLabel || "Global",
    period: range,
    text: statements.join(" "),
    statements,
    demand_index: demand,
    evidence: {
      active_travelers: safeNumber(kpis.active_users),
      previous_active_travelers: safeNumber(previousKpis.active_users),
      commercial_intent: safeNumber(kpis.commercial_intent),
      previous_commercial_intent: safeNumber(previousKpis.commercial_intent),
      intent_growth_pct: intentDelta.reliable ? intentDelta.percent : null,
    },
    generated_by: "deterministic_rules",
  };
}

export function buildDecisionInsights({ range, comparisonRange, kpis = {}, previousKpis = {}, categories = [], peak = null, movers = null }) {
  const insights = [];
  const candidates = [
    ["place_views", "Place views"],
    ["commercial_intent", "Commercial actions"],
    ["saves", "Saves"],
    ["route_starts", "Route starts"],
  ];
  for (const [key, label] of candidates) {
    const delta = periodDelta(kpis[key], previousKpis[key]);
    if (!delta.reliable || delta.percent == null || Math.abs(delta.percent) < 10) continue;
    insights.push({
      id: `${key}_change`,
      type: delta.percent > 0 ? "growth" : "decline",
      title: `${label} ${delta.percent > 0 ? "increased" : "decreased"} ${Math.abs(delta.percent)}%`,
      evidence: `${delta.current} current vs ${delta.previous} comparison-period events`,
      consideration: delta.percent > 0
        ? `Investigate which sources and time windows contributed to the ${label.toLowerCase()} increase.`
        : `Review source, geography, and timing changes behind the ${label.toLowerCase()} decline.`,
      metric: key,
      anchor: key === "route_starts" ? "routes" : "market-pulse",
      confidence: insightConfidence(delta.current, delta.previous),
      sample_size: delta.current,
      period: range,
      comparison_period: comparisonRange,
    });
  }

  const opportunity = [...categories]
    .filter((item) => item.reliable && item.opportunity_score != null)
    .sort((a, b) => b.opportunity_score - a.opportunity_score)[0];
  if (opportunity && opportunity.opportunity_score >= 67) {
    insights.push({
      id: `category_${opportunity.category}_opportunity`,
      type: "opportunity",
      title: `${opportunity.category} shows a measurable supply-demand gap`,
      evidence: `Opportunity ${opportunity.opportunity_score}/100 · demand ${opportunity.demand_index ?? "—"} · supply ${opportunity.supply_index ?? "—"}`,
      consideration: "Explore data indicates a potential supply-demand opportunity worth investigating.",
      metric: "opportunity_score",
      anchor: "opportunities",
      confidence: insightConfidence(opportunity.sample_size, opportunity.previous_demand),
      sample_size: opportunity.sample_size,
      period: range,
      comparison_period: comparisonRange,
    });
  }

  if (peak?.peak_window && safeNumber(peak.peak_window.sample_size) >= MIN_RELIABLE_SAMPLE) {
    insights.push({
      id: "peak_window",
      type: "timing",
      title: `${peak.peak_window.label} is the strongest measured demand window`,
      evidence: `${peak.peak_window.sample_size} eligible events · ${peak.peak_window.above_average_pct}% above the weekly window average`,
      consideration: "Consider testing staffing, content, or campaigns during this period.",
      metric: "peak_demand",
      anchor: "time-intelligence",
      confidence: insightConfidence(peak.peak_window.sample_size),
      sample_size: peak.peak_window.sample_size,
      period: range,
      comparison_period: comparisonRange,
    });
  }

  for (const mover of (movers?.rising || []).slice(0, 2)) {
    insights.push({
      id: `mover_${mover.type}_${mover.label}`,
      type: "trend",
      title: `${mover.label} is gaining momentum`,
      evidence: `+${mover.trend_pct}% with the minimum comparison baseline enforced`,
      consideration: "Review the related place or route detail to understand what is driving the change.",
      metric: "growth",
      anchor: mover.type === "route" ? "routes" : "places",
      confidence: "medium",
      sample_size: mover.sample_size ?? null,
      period: range,
      comparison_period: comparisonRange,
    });
  }

  return insights.slice(0, 8);
}

export function categoryMatrix(categories = []) {
  return categories
    .filter((item) => item.reliable)
    .map((item) => ({
      category: item.category,
      demand: item.demand_index,
      supply: item.supply_index,
      growth_pct: item.growth_pct,
      opportunity_score: item.opportunity_score,
      quadrant:
        item.demand_index >= 50 && item.supply_index < 50
          ? "high_demand_low_supply"
          : item.demand_index >= 50
            ? "high_demand_high_supply"
            : item.supply_index < 50
              ? "low_demand_low_supply"
              : "low_demand_high_supply",
    }));
}
