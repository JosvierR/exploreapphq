import { expect, type Page, type Route } from "@playwright/test";

export type FixtureMode = "ready" | "empty" | "error";

export type FixtureState = {
  mode: FixtureMode;
  authorized: boolean;
  rangeDelays?: Record<string, number>;
  adminMeFailure?: "network" | "unauthenticated" | "server";
  partialBusinessContent?: boolean;
};

export const TEST_ADMIN_EMAIL = "qa.admin@example.test";
export const TEST_ADMIN_PASSWORD = "correct-horse-battery-staple";

const now = "2026-10-12T14:45:00.000Z";
const previous = "2026-10-05T14:45:00.000Z";

const session = {
  access_token: "e2e-admin-access-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 1893456000,
  refresh_token: "e2e-admin-refresh-token",
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    aud: "authenticated",
    role: "authenticated",
    email: TEST_ADMIN_EMAIL,
    email_confirmed_at: "2026-10-01T12:00:00.000Z",
    phone: "",
    confirmed_at: "2026-10-01T12:00:00.000Z",
    last_sign_in_at: now,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { display_name: "QA Admin" },
    identities: [],
    created_at: "2026-09-01T12:00:00.000Z",
    updated_at: now,
    is_anonymous: false,
  },
};

const report = {
  id: "report-001",
  content_type: "video",
  content_id: "video-001",
  reason: "inappropriate",
  details: "Sanitized QA report used for browser validation.",
  metadata: { source: "e2e", priority: "high" },
  status: "pending",
  reporter_id: "22222222-2222-4222-8222-222222222222",
  created_at: "2026-10-11T18:30:00.000Z",
  reviewed_by: null,
  reviewed_at: null,
  reporter: {
    id: "22222222-2222-4222-8222-222222222222",
    handle: "qa_traveler",
    display_name: "QA Traveler",
    avatar_url: null,
    email: "traveler@example.test",
  },
  target: {
    type: "video",
    id: "video-001",
    title: "Coastal trail guide",
    description: "A sanitized content fixture.",
    creator: { id: "creator-001", handle: "explore_guide", display_name: "Explore Guide", avatar_url: null, email: null },
    moderation_status: "under_review",
    state: "published",
    visibility_label: "Public",
    globally_visible: true,
  },
};

const operationsSummary = {
  health: {
    api_connected: true,
    supabase_configured: true,
    secret_key_configured: true,
    admin_authorized: true,
    environment: "e2e",
  },
  users: { total: 12480, new_24h: 84, new_7d: 612, deactivated: 14, ghost: 8, active_24h: 3480, active_7d: 7210 },
  content: {
    videos: { total: 8460, published: 8214, processing: 42, reported_legacy: 6, active: 8178, under_review: 24, hidden: 9, removed: 3, created_7d: 318 },
    places: { total: 2190, published: 2108, deleted: 12, active: 2082, under_review: 18, hidden: 6, removed: 2, created_7d: 47 },
    routes: { total: 740, published: 691, public: 655, draft: 49 },
  },
  engagement: { likes: 88210, comments: 12640, followers: 25400, user_hidden_content: 92, analytics_events: 942810 },
  moderation: { reports_total: 328, pending: 7, reviewed: 261, dismissed: 48, removed: 12, removed_or_actions: 18, oldest_pending_at: previous, actions_total: 414, actions_24h: 9, remove_content_actions: 18 },
  breakdowns: {
    reports_by_content_type: [{ content_type: "video", count: 219 }, { content_type: "place", count: 71 }, { content_type: "user", count: 38 }],
    reports_by_reason: [{ reason: "inappropriate", count: 121 }, { reason: "spam", count: 96 }, { reason: "harassment", count: 42 }],
    videos_by_state: [{ value: "published", count: 8214 }, { value: "processing", count: 42 }],
    places_by_state: [{ value: "published", count: 2108 }, { value: "draft", count: 70 }],
    videos_by_moderation_status: [{ value: "active", count: 8178 }, { value: "under_review", count: 24 }],
    places_by_moderation_status: [{ value: "active", count: 2082 }, { value: "under_review", count: 18 }],
  },
  recent: {
    users: [
      { id: "user-001", display_name: "Maya Rivera", handle: "maya_explores", email: "maya@example.test", avatar_url: null, created_at: "2026-10-12T12:20:00.000Z", status: "active", is_active: true, is_deactivated: false, is_ghost: false },
      { id: "user-002", display_name: "Noah Chen", handle: "noahroutes", email: "noah@example.test", avatar_url: null, created_at: "2026-10-11T09:00:00.000Z", status: "active", is_active: true, is_deactivated: false, is_ghost: false },
    ],
    videos: [{ id: "video-001", title: "Coastal trail guide", category: "Nature", creator_id: "creator-001", state: "published", moderation_status: "active", is_public: true, created_at: "2026-10-12T09:00:00.000Z" }],
    places: [{ id: "place-001", name: "Harbor Market", category: "Food", state: "published", moderation_status: "active", is_public: true, rating: 4.7, created_at: "2026-10-10T09:00:00.000Z" }],
    routes: [{ id: "route-001", title: "Historic waterfront walk", difficulty: "Easy", state: "published", is_public: true, created_at: "2026-10-09T09:00:00.000Z" }],
    reports: [report],
    admin_actions: [],
  },
  warnings: [],
};

const range = { start: "2026-10-06", end: "2026-10-12", preset: "7d" };
const deltas = {
  active_users_estimate: { current: 7210, previous: 6540, absolute: 670, percent: 10.2 },
  active_sessions: { current: 15880, previous: 14220, absolute: 1660, percent: 11.7 },
  app_opens: { current: 20480, previous: 18420, absolute: 2060, percent: 11.2 },
  searches_total: { current: 4860, previous: 4310, absolute: 550, percent: 12.8 },
  content_views_total: { current: 98200, previous: 89100, absolute: 9100, percent: 10.2 },
};

const businessBase = { request_id: "req-e2e-business", range, warnings: [], comparison: { previous_period: { start: "2026-09-29", end: "2026-10-05" }, deltas } };

const businessOverview = {
  ...businessBase,
  summary: {
    total_events: 142860,
    active_users_estimate: 7210,
    active_authenticated_users: 2860,
    active_anonymous_ids: 4350,
    active_sessions: 15880,
    sessions: 15880,
    app_opens: 20480,
    content_views_total: 98200,
    impressions: 125400,
    clicks: 18420,
    content_ctr: 14.7,
    route_starts: 3820,
    route_completions: 2510,
    place_views: 52680,
    place_commerce_actions: 1680,
    saves: 9340,
    shares: 2160,
    searches_total: 4860,
    search_result_clicks: 3280,
    search_ctr: 67.5,
    dead_letters_total: 0,
  },
  breakdowns: {
    platform: [{ value: "ios", count: 78200 }, { value: "android", count: 52600 }, { value: "web", count: 12060 }],
    source: [{ value: "mobile", count: 130800 }, { value: "web", count: 12060 }],
  },
  series: [],
};

const growthSeries = [
  { day: "2026-10-06", active_anonymous_ids: 2700, active_authenticated_users: 1780, sessions: 9200, app_opens: 11800, content_views: 58100, searches: 2740 },
  { day: "2026-10-07", active_anonymous_ids: 2920, active_authenticated_users: 1890, sessions: 10100, app_opens: 13040, content_views: 63400, searches: 3010 },
  { day: "2026-10-08", active_anonymous_ids: 3050, active_authenticated_users: 2010, sessions: 10920, app_opens: 14120, content_views: 68100, searches: 3280 },
  { day: "2026-10-09", active_anonymous_ids: 3340, active_authenticated_users: 2180, sessions: 12110, app_opens: 15660, content_views: 74200, searches: 3590 },
  { day: "2026-10-10", active_anonymous_ids: 3610, active_authenticated_users: 2370, sessions: 13280, app_opens: 17100, content_views: 80900, searches: 3970 },
  { day: "2026-10-11", active_anonymous_ids: 4020, active_authenticated_users: 2620, sessions: 14640, app_opens: 18920, content_views: 90100, searches: 4420 },
  { day: "2026-10-12", active_anonymous_ids: 4350, active_authenticated_users: 2860, sessions: 15880, app_opens: 20480, content_views: 98200, searches: 4860 },
];

const businessGrowth = {
  ...businessBase,
  summary: { estimated_new_anonymous_ids: 1480, estimated_returning_anonymous_ids: 2870, active_authenticated_users: 2860, active_anonymous_ids: 4350 },
  breakdowns: { platform_split: [{ value: "ios", count: 55 }, { value: "android", count: 37 }, { value: "web", count: 8 }], source_split: [{ value: "mobile", count: 92 }, { value: "web", count: 8 }] },
  series: growthSeries,
};

const funnel = [
  { key: "app_open", label: "App opens", count: 20480, unique_sessions: 15880, dropoff_pct: 0 },
  { key: "place_view", label: "Place views", count: 12840, unique_sessions: 9820, dropoff_pct: 38 },
  { key: "route_start", label: "Route starts", count: 3820, unique_sessions: 3190, dropoff_pct: 70 },
  { key: "route_complete", label: "Route completions", count: 2510, unique_sessions: 2200, dropoff_pct: 34 },
];

const businessFunnel = { ...businessBase, summary: { video_completion_rate: 61.4, commerce_conversions: 1680 }, funnel };
const businessLocations = {
  ...businessBase,
  summary: { countries: 6, regions: 18, cities: 42 },
  countries: [{ country: "Dominican Republic", events: 68200 }, { country: "United States", events: 41600 }, { country: "Spain", events: 18840 }, { country: "Mexico", events: 9260 }, { country: "Canada", events: 4960 }],
  regions: [{ region: "La Altagracia", events: 31200 }, { region: "Distrito Nacional", events: 24100 }],
  cities: [{ city: "Punta Cana", events: 28600 }, { city: "Santo Domingo", events: 22100 }],
};

const businessContent = {
  ...businessBase,
  summary: { content_views: 98200, saves: 9340, shares: 2160 },
  sections: {
    videos: [{ entity_id: "video-001", title: "Coastal trail guide", views: 12840, clicks: 2840, saves: 920, engagement_rate: 18.2 }],
    places: [{ entity_id: "place-001", title: "Harbor Market", views: 9420, clicks: 1920, saves: 780, engagement_rate: 20.4 }],
    routes: [{ entity_id: "route-001", title: "Historic waterfront walk", views: 7140, starts: 2680, completions: 1810, engagement_rate: 37.5 }],
    profiles: [{ entity_id: "profile-001", title: "Explore Guide", views: 3840, clicks: 980, engagement_rate: 25.5 }],
  },
};

const businessSearch = { ...businessBase, summary: { total_searches: 4860, no_result_searches: 420, no_result_rate: 8.6, result_clicks: 3280, search_ctr: 67.5 }, breakdowns: { top_query_hashes: [{ query_hash: "beachâ€¦7f2a", count: 412 }, { query_hash: "foodâ€¦a391", count: 286 }], top_search_entity_types: [{ value: "place", count: 2810 }, { value: "route", count: 1280 }] }, series: [] };
const businessCreators = { ...businessBase, summary: { active_creators: 186, published_content: 624 }, creators: [{ creator_id: "creator-001", handle: "explore_guide", content_count: 42, views: 28400, saves: 3860 }] };
const investorSnapshot = { ...businessBase, period: "Last 7 days", snapshot: { active_users: 7210, sessions: 15880, engagement_rate: 18.7, top_markets: businessLocations.countries.slice(0, 3), top_content_types: [{ type: "place", count: 52680 }, { type: "video", count: 38420 }] }, copy_text: "Explore recorded 7,210 active travelers and 15,880 sessions in the selected period." };

const analyticsOverview = {
  events_today: 22480,
  events_last_24h: 24820,
  events_last_7d: 142860,
  events_last_30d: 548200,
  events_in_range: 142860,
  total_events_in_range: 142860,
  active_anonymous_ids: 4350,
  active_authenticated_users: 2860,
  sessions: 15880,
  avg_events_per_session: 9,
  dead_letters_last_24h: 0,
  ingestion_health: "healthy",
  latest_received_at: now,
  latest_occurred_at: now,
  dau: 3480,
  wau: 7210,
  product_metrics: { foundation_status: "ready", unlocked: true, dau: 3480, wau: 7210, impressions_7d: 125400, clicks_7d: 18420, content_ctr_7d: 14.7, route_starts_7d: 3820, events_7d: 142860, events_today: 22480, latest_received_at: now, source: "analytics_events" },
  breakdowns: {
    event_name: [{ value: "place_view", count: 52680 }, { value: "app_open", count: 20480 }, { value: "route_start", count: 3820 }],
    source: [{ value: "mobile", count: 130800 }, { value: "web", count: 12060 }],
    platform: [{ value: "ios", count: 78200 }, { value: "android", count: 52600 }, { value: "web", count: 12060 }],
    entity_type: [{ value: "place", count: 64200 }, { value: "route", count: 28400 }],
    auth_share: { authenticated: 48600, anonymous: 94260, authenticated_pct: 34, anonymous_pct: 66 },
  },
  daily_view: growthSeries,
};

const analyticsEvent = { event_id: "event-001", received_at: now, occurred_at: now, event_name: "place_view", source: "mobile", platform: "ios", entity_type: "place", entity_id: "place-001", anonymous_id_short: "anonâ€¦81f", user_id_present: true, session_id_short: "sessionâ€¦fe2", app_version: "2.6.0", build_number: "406", properties: { surface: "discover" }, context: { locale: "en-US" } };

const tourismDashboard = {
  request_id: "req-e2e-tourism",
  core_version: "business-intelligence-v1",
  data_as_of: now,
  state: "ready",
  range: { start: "2026-09-13", end: "2026-10-12", preset: "30d" },
  filters: {},
  comparison: { mode: "previous", previous_period: { start: "2026-08-14", end: "2026-09-12" }, deltas: { active_users: { current: 18420, previous: 16380, absolute: 2040, percent: 12.5 }, sessions: { current: 42680, previous: 38120, absolute: 4560, percent: 12 }, place_discoveries: { current: 98400, previous: 86200, absolute: 12200, percent: 14.2 }, place_views: { current: 146200, previous: 130400, absolute: 15800, percent: 12.1 }, route_views: { current: 68400, previous: 62100, absolute: 6300, percent: 10.1 }, route_starts: { current: 21340, previous: 18800, absolute: 2540, percent: 13.5 }, saves: { current: 24860, previous: 22140, absolute: 2720, percent: 12.3 }, commercial_intent: { current: 7860, previous: 6910, absolute: 950, percent: 13.7 } } },
  kpis: { active_users: 18420, sessions: 42680, place_discoveries: 98400, place_views: 146200, route_views: 68400, route_starts: 21340, route_completions: 14280, saves: 24860, commercial_intent: 7860 },
  kpi_definitions: {},
  metric_dictionary: { version: "v1", metrics: {} },
  executive_summary: { market: "Global", text: "Demand strengthened across destination discovery and commercial intent.", statements: ["Place discovery grew 14.2% versus the previous period.", "Punta Cana leads current demand."], generated_by: "deterministic-rules-v1", evidence: { place_views: 146200, commercial_intent: 7860 } },
  demand_index: { score: 76, version: "v1", status: "ready", label: "Strong demand", demand: "high", growth: "positive", intent: "strong", supply: "balanced", momentum: "rising", reliable_components: 5 },
  geography: { level: "global", child_level: "country", child_label: "Countries", region_terminology: "Region", breadcrumb: [{ level: "global", key: null, label: "Global" }], children: [{ key: "do", label: "Dominican Republic", level: "country", events: 68200, users: 8640, sessions: 19840, place_views: 61800, route_views: 28400, intent: 3420, saves: 10800, searches: 9240, demand: 76, supply: 62, previous_events: 59100, growth_pct: 15.4, demand_index: 78, supply_index: 61, opportunity_score: 82, metric: 78, share_pct: 47.7, lat: 18.7357, lng: -70.1627 }, { key: "us", label: "United States", level: "country", events: 41600, users: 5280, sessions: 12400, place_views: 38200, route_views: 17100, intent: 2180, saves: 7420, searches: 6180, demand: 68, supply: 70, previous_events: 38200, growth_pct: 8.9, demand_index: 69, supply_index: 71, opportunity_score: 64, metric: 69, share_pct: 29.1, lat: 37.0902, lng: -95.7129 }], map_metric: "demand", missing_child_geo: false },
  market_comparison: [{ key: "do", label: "Dominican Republic", level: "country", demand_index: 78, demand_growth_pct: 15.4, restaurant_intent_share_pct: 32, route_activity_share_pct: 28, weekend_demand_pct: 44, sample_size: 68200 }, { key: "us", label: "United States", level: "country", demand_index: 69, demand_growth_pct: 8.9, restaurant_intent_share_pct: 24, route_activity_share_pct: 21, weekend_demand_pct: 38, sample_size: 41600 }],
  funnel: [{ key: "discover", label: "Discovery", count: 98400, dropoff_pct: 0, conversion_from_previous: null }, { key: "view", label: "Place view", count: 61800, dropoff_pct: 37.2, conversion_from_previous: 62.8 }, { key: "save", label: "Save", count: 10800, dropoff_pct: 82.5, conversion_from_previous: 17.5 }, { key: "intent", label: "Commercial intent", count: 3420, dropoff_pct: 68.3, conversion_from_previous: 31.7 }],
  timeseries: growthSeries.map((item, index) => ({
    period: item.day,
    users: item.active_authenticated_users + item.active_anonymous_ids,
    sessions: item.sessions,
    place_views: item.content_views,
    route_views: Math.round(item.content_views * 0.46),
    route_starts: 420 + index * 48,
    searches: item.searches,
    saves: Math.round(item.searches * 1.6),
    commercial_actions: Math.round(item.searches * 0.52),
    previous_users: Math.round((item.active_authenticated_users + item.active_anonymous_ids) * 0.9),
    previous_sessions: Math.round(item.sessions * 0.89),
    previous_route_starts: 380 + index * 42,
  })),
  peak_demand: { available: true, weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], dayparts: ["Morning", "Afternoon", "Evening"], matrix: { Mon: [42, 68, 74], Tue: [45, 70, 76], Wed: [48, 72, 79], Thu: [52, 76, 82], Fri: [58, 84, 94], Sat: [66, 92, 100], Sun: [62, 88, 96] }, by_hour: Array.from({ length: 24 }, (_, hour) => 20 + hour * 3), tracked_events: 68400, peak_window: { day: "Saturday", daypart: "Evening", label: "Saturday evening", sample_size: 12840, above_average_pct: 38 }, timezone_basis: "Destination-local where available" },
  categories: [{ category: "Restaurants", count: 42800, share_pct: 29.3, demand: 42800, previous_demand: 35400, growth_pct: 20.9, supply: 320, views: 38400, searches: 8200, saves: 7480, intent: 2940, intent_rate: 7.7, save_rate: 19.5, demand_index: 84, supply_index: 58, opportunity_score: 88, opportunity_level: "high", reliable: true }, { category: "Beaches", count: 36200, share_pct: 24.8, demand: 36200, previous_demand: 33100, growth_pct: 9.4, supply: 188, views: 41200, searches: 6940, saves: 8860, intent: 1260, intent_rate: 3.1, save_rate: 21.5, demand_index: 79, supply_index: 52, opportunity_score: 81, opportunity_level: "high", reliable: true }],
  supply_demand_matrix: [{ category: "Restaurants", demand: 84, supply: 58, growth_pct: 20.9, opportunity_score: 88, quadrant: "high-demand-low-supply" }, { category: "Beaches", demand: 79, supply: 52, growth_pct: 9.4, opportunity_score: 81, quadrant: "high-demand-low-supply" }],
  places: [{ place_id: "place-001", name: "Harbor Market", category: "Restaurants", city: "Punta Cana", views: 9420, saves: 780, intent: 286, rating: 4.7, reviews_count: 428, trend_pct: 18.2, benchmark: { score: 86 } }, { place_id: "place-002", name: "Azure Beach", category: "Beaches", city: "Punta Cana", views: 8610, saves: 924, intent: 164, rating: 4.8, reviews_count: 612, trend_pct: 12.8, benchmark: { score: 82 } }],
  routes: [{ route_id: "route-001", title: "Historic waterfront walk", city: "Santo Domingo", views: 7140, starts: 2680, completions: 1810, completion_rate: 67.5, trend_pct: 14.2 }],
  searches: { available: true, summary: { total_searches: 18240, no_result_rate: 7.8, click_through_rate: 68.4 }, top_searches: [{ query_hash: "beachâ€¦7f2a", label: "Beach intent cluster", count: 1240, display_query: null, text_visible: false, ctr: 72.4, avg_results: 18, conversion_to_place: 42.8, conversion_to_intent: 8.6 }], low_supply: [{ label: "Local food tours", searches: 640, supply: 12, opportunity_score: 91 }], click_entity_types: [{ value: "place", count: 8420 }, { value: "route", count: 3180 }], privacy_note: "Search terms remain privacy-safe fingerprints." },
  content_attribution: { available: true, items: [{ title: "Coastal trail guide", type: "video", views: 12840, saves: 920, attributed_intent: 284 }], note: "Attribution uses observed downstream events." },
  opportunities: { cards: [{ type: "category", title: "Restaurant discovery gap", evidence: "Demand rose 20.9% with a supply index of 58.", opportunity: "Prioritize verified dining inventory in Punta Cana.", confidence: "high" }], category_scores: [], matrix: [], insufficient_data: false, message: null },
  business_signals: { partner_actions: 1680, high_intent_sessions: 6240 },
  movers: { rising: [{ type: "market", label: "Punta Cana", trend_pct: 18.4 }, { type: "category", label: "Restaurants", trend_pct: 20.9 }], declining: [{ type: "category", label: "Museums", trend_pct: -3.2 }] },
  traveler_origins: { available: true, markets: [{ country: "US", label: "United States", events: 18400, share_pct: 43 }, { country: "DO", label: "Dominican Republic", events: 12600, share_pct: 29.5 }], note: "Origin differs from destination geography." },
  audience: { traveler_mix: [{ segment: "returning", count: 9820, share_pct: 53.3 }, { segment: "new", count: 8600, share_pct: 46.7 }], behavior: [{ segment: "planners", count: 7200, share_pct: 39.1 }, { segment: "explorers", count: 11220, share_pct: 60.9 }], status: "ready", privacy_note: "Aggregated segments only." },
  discovery_attribution: { available: true, sources: [{ source: "discover", count: 48200, share_pct: 49.1 }, { source: "search", count: 28400, share_pct: 28.9 }, { source: "shared_route", count: 11800, share_pct: 12 }] },
  insights: [{ id: "insight-001", type: "opportunity", title: "Dining demand is outpacing supply", evidence: "Restaurant demand grew 20.9% while supply remains balanced.", consideration: "Prioritize verified dining partners in the leading destination.", metric: "opportunity_score", anchor: "opportunities", confidence: "high", sample_size: 42800, period: { start: "2026-09-13", end: "2026-10-12", preset: "30d" }, comparison_period: { start: "2026-08-14", end: "2026-09-12" } }],
  what_changed: [],
  business_performance: { score: 86, benchmark_cohort: 24 },
  data_quality: { status: "healthy", valid_events: 286400, unknown_places: 84, unknown_routes: 21, missing_geography: 1180, validity_view_active: true, geo_coverage_pct: 96.4, destination_geo_coverage_pct: 94.8, traveler_origin_coverage_pct: 82.1, places_with_country_pct: 99.2, places_with_region_pct: 97.8, places_with_city_pct: 95.4, routes_with_market_pct: 93.2, place_resolution_pct: 98.1, route_resolution_pct: 96.8, rejected_events: 0, aggregation_failures: 0, possible_duplicate_places: 3, last_aggregation: now },
  warnings: [],
};

function emptyFor(pathname: string) {
  if (pathname.endsWith("/ops/summary")) return { ok: true, summary: { ...operationsSummary, users: { ...operationsSummary.users, total: 0 }, recent: { users: [], videos: [], places: [], routes: [], reports: [], admin_actions: [] }, warnings: ["No operational rows in the selected fixture."] } };
  if (pathname.endsWith("/analytics/overview")) return { request_id: "req-empty", overview: { ...analyticsOverview, events_today: 0, events_last_24h: 0, events_last_7d: 0, events_in_range: 0, active_anonymous_ids: 0, active_authenticated_users: 0, sessions: 0, breakdowns: { ...analyticsOverview.breakdowns, event_name: [], source: [], platform: [], entity_type: [] }, daily_view: [] }, product_metrics: { foundation_status: "empty", unlocked: false, dau: null, wau: null, impressions_7d: null, clicks_7d: null, content_ctr_7d: null, route_starts_7d: null }, diagnostics: diagnostics(), warnings: [{ code: "no_events_in_range", message: "No events were recorded for this range." }] };
  if (pathname.endsWith("/business/dashboard")) return { ...tourismDashboard, state: "zero", kpis: Object.fromEntries(Object.keys(tourismDashboard.kpis).map((key) => [key, 0])), geography: { ...tourismDashboard.geography, children: [] }, categories: [], places: [], routes: [], timeseries: [], insights: [], opportunities: { cards: [], category_scores: [], matrix: [], insufficient_data: true, message: "Not enough activity for a reliable opportunity score." } };
  return null;
}

function diagnostics() {
  return { analytics_events_exists: true, analytics_dead_letters_exists: true, analytics_events_selectable: true, analytics_dead_letters_selectable: true, supabase_project_ref: "e2e", service_role_configured: true, service_key_looks_like_jwt: false, warnings: [] };
}

function responseFor(url: URL, method: string) {
  const path = url.pathname;
  if (path === "/api/health") return { ok: true, service: "explore-web-admin", environment: "e2e", version: "release-candidate", timestamp: now, request_id: "req-health", checks: { api: "ok", supabase_url_configured: true, supabase_publishable_configured: true, supabase_service_configured: true, admin_routes: "ok" }, supabaseUrlConfigured: true, publishableKeyConfigured: true, secretKeyConfigured: true };
  if (path === "/api/admin/me") return { ok: true, user: { id: session.user.id, email: TEST_ADMIN_EMAIL }, role: "admin", fallback: false };
  if (path === "/api/admin/ops/summary") return { ok: true, summary: operationsSummary };
  if (path === "/api/admin/moderation/summary") return { ok: true, summary: { reports: { total: 328, pending: 7, reviewed: 261, reviewed_last_24h: 18, dismissed: 48, removed: 12, removed_or_actions: 18, oldest_pending_at: previous }, content_visibility: { videos: { active: 8178, under_review: 24, hidden: 9, removed: 3 }, places: { active: 2082, under_review: 18, hidden: 6, removed: 2 } }, by_content_type: operationsSummary.breakdowns.reports_by_content_type, by_reason: operationsSummary.breakdowns.reports_by_reason, actions: { total: 414, last_24h: 9, recent: [] } } };
  if (path === "/api/admin/users") return { ok: true, users: operationsSummary.recent.users, total: 12480, source: "profiles", warnings: [] };
  if (path === "/api/admin/admins") return { ok: true, admins: [{ user_id: session.user.id, role: "admin", created_at: "2026-09-01T12:00:00.000Z", email: TEST_ADMIN_EMAIL, label: "QA Admin", slot: "qa", last_sign_in_at: now, email_confirmed: true }, { user_id: "33333333-3333-4333-8333-333333333333", role: "moderator", created_at: "2026-09-18T12:00:00.000Z", email: "qa.moderator@example.test", label: "QA Moderator", slot: "qa-2", last_sign_in_at: previous, email_confirmed: true }], total: 2, current_user_id: session.user.id, current_role: "admin", can_manage: true, fallback: false, allowlist_emails: [] };
  if (path === "/api/admin/reports") return { reports: [report], total: 1 };
  if (path.startsWith("/api/admin/reports/")) return { ok: true, report, target: report.target, reporter: report.reporter, creator: report.target.creator, related_reports: [], moderation_actions: [] };
  if (path === "/api/admin/waitlist") return { stats: { total: 1842, pendingLaunch: 1680, notified: 162 }, rows: [{ id: "wait-001", email: "traveler@example.test", createdAt: "2026-10-12T12:00:00.000Z", launchNotifiedAt: null }], source: "sanitized-e2e", emailStatus: { ready: true, from: "Explore <qa@example.test>", mailDomain: "example.test" }, smsStatus: { ready: true, from: "+10000000000" } };
  if (path === "/api/admin/system/health") return { ok: true, service: "explore-web-admin", environment: "e2e", version: "release-candidate", timestamp: now, request_id: "req-system", duration_ms: 42, admin: { user_id: session.user.id, email: TEST_ADMIN_EMAIL, role: "admin", fallback: false }, checks: { api: "ok", admin_auth: "ok", supabase_connection: "ok", reports_table: "ok", videos_table: "ok", places_table: "ok", moderation_actions_table: "ok", metrics: "in_memory", loki_configured: true, loki_connectivity: "ok", grafana_logs_enabled: true }, config: { supabase_url_configured: true, supabase_publishable_configured: true, supabase_service_configured: true, metrics_token_configured: true, loki_enabled: true, loki_url_configured: true, loki_username_configured: true, loki_token_configured: true, loki_ready: true, grafana_logs_enabled: true, grafana_logs_level: "warn", deployment: "e2e", loki_probe: { status: "ok" } }, warnings: [] };
  if (path === "/api/admin/system/metrics") return { ok: true, request_id: "req-metrics", generated_at: now, note: "Sanitized E2E metrics", counters: [{ name: "explore_api_requests_total", labels: { route: "/api/admin/me", method: "GET", status: "200" }, value: 1280 }], timers: [{ name: "explore_api_request_duration_ms", labels: { route: "/api/admin/me" }, count: 1280, sum: 41200, avg: 32.2, p95: 68 }] };
  if (path === "/api/admin/analytics/overview") return { request_id: "req-overview", overview: analyticsOverview, product_metrics: analyticsOverview.product_metrics, diagnostics: diagnostics(), warnings: [] };
  if (path === "/api/admin/analytics/timeseries") return { request_id: "req-timeseries", timeseries: { events_by_day: growthSeries.map((item) => ({ day: item.day, count: item.content_views })), sessions_by_day: growthSeries.map((item) => ({ day: item.day, count: item.sessions })), users_by_day: growthSeries.map((item) => ({ day: item.day, authenticated: item.active_authenticated_users, anonymous: item.active_anonymous_ids })), top_event_names: analyticsOverview.breakdowns.event_name, dead_letters_in_range: 0 }, diagnostics: diagnostics(), warnings: [] };
  if (path === "/api/admin/analytics/top-content") return { request_id: "req-top-content", top_content: { videos: [{ entity_id: "video-001", entity_type: "video", event_count: 12840, impressions: 18200, clicks: 2840, likes: 1860, saves: 920, shares: 410, engagement_rate: 18.2, last_event_at: now }], places: [{ entity_id: "place-001", entity_type: "place", event_count: 9420, impressions: 14600, clicks: 1920, saves: 780, engagement_rate: 20.4, last_event_at: now }], routes: [{ entity_id: "route-001", entity_type: "route", event_count: 7140, impressions: 10200, clicks: 2680, saves: 640, engagement_rate: 26.3, last_event_at: now }], profiles: [{ entity_id: "profile-001", entity_type: "profile", event_count: 3840, impressions: 6800, clicks: 980, engagement_rate: 14.4, last_event_at: now }] }, warnings: [] };
  if (path === "/api/admin/analytics/search") return { request_id: "req-search", search: { total_searches: 4860, no_result_searches: 420, click_through_rate: 67.5, top_query_hashes: [{ query_hash: "beachâ€¦7f2a", count: 412 }], query_length_distribution: [{ bucket: "2-3 words", count: 2860 }], entity_type_breakdown: [{ value: "place", count: 2810 }], top_clicked_entities: [{ entity_type: "place", entity_id: "place-001", count: 480 }] }, warnings: [] };
  if (path === "/api/admin/analytics/events") return { request_id: "req-events", events: [analyticsEvent], pagination: { limit: 50, offset: 0, total: 1 }, warnings: [] };
  if (path.startsWith("/api/admin/analytics/events/")) return { request_id: "req-event", event: analyticsEvent };
  if (path === "/api/admin/analytics/health") return {
    request_id: "req-analytics-health",
    status: "healthy",
    health: {
      status: "healthy",
      contract_version: "analytics-ingestion-v2",
      observed_at: now,
      data_updated_at: now,
      events_last_5m: 320,
      events_last_1h: 2840,
      events_last_6h: 9100,
      events_last_24h: 24820,
      dead_letters_last_1h: 0,
      dead_letters_last_6h: 0,
      dead_letters_last_24h: 0,
      dead_letter_rate_24h: 0,
      rejection_reasons: [],
      rejection_sources: [],
      rejection_events: [],
      last_successful_received_at: now,
      latest_rejection_at: null,
      source_freshness: { status: "fresh", lag_seconds: 12, threshold_seconds: 900, is_complete: true },
      ingestion_windows: {
        last_1h: { accepted: 2840, rejected: 0, total: 2840, rejection_rate: 0, complete: true },
        last_6h: { accepted: 9100, rejected: 0, total: 9100, rejection_rate: 0, complete: true },
        last_24h: { accepted: 24820, rejected: 0, total: 24820, rejection_rate: 0, complete: true },
      },
      alerts: [],
      latest_aggregation_day: "2026-10-12",
      aggregation_freshness: { latest_admin_metrics_day: "2026-10-12", latest_overview_day: "2026-10-12", is_today_aggregated: true, is_yesterday_aggregated: true },
      quality_warnings: [],
    },
    diagnostics: diagnostics(),
    quality_warnings: [],
    warnings: [],
  };
  if (path === "/api/admin/analytics/dead-letters") return { request_id: "req-dead-letters", items: [], dead_letters: [], summary: { last_24h: 0, last_7d: 0, by_reason: [], by_source: [] }, pagination: { limit: 50, offset: 0, total: 0 }, warnings: [] };
  if (path === "/api/admin/analytics/aggregate" && method === "POST") return { request_id: "req-aggregate", days: [{ day: "2026-10-12", ok: true }], warnings: [], message: "Aggregation complete" };
  if (path === "/api/admin/analytics/business/overview") {
    const requestedRange = url.searchParams.get("range") || "7d";
    const activeUsersByRange: Record<string, number> = { "24h": 2400, "7d": 7210, "30d": 8300, "90d": 9000 };
    const startByRange: Record<string, string> = { "24h": "2026-10-11", "7d": "2026-10-06", "30d": "2026-09-13", "90d": "2026-07-15" };
    return {
      ...businessOverview,
      request_id: `req-overview-${requestedRange}`,
      range: { start: startByRange[requestedRange] || range.start, end: range.end, preset: requestedRange },
      summary: { ...businessOverview.summary, active_users_estimate: activeUsersByRange[requestedRange] || businessOverview.summary.active_users_estimate },
    };
  }
  if (path === "/api/admin/analytics/business/growth") return businessGrowth;
  if (path === "/api/admin/analytics/business/funnel") return businessFunnel;
  if (path === "/api/admin/analytics/business/content") return businessContent;
  if (path === "/api/admin/analytics/business/search") return businessSearch;
  if (path === "/api/admin/analytics/business/creators") return businessCreators;
  if (path === "/api/admin/analytics/business/locations") return businessLocations;
  if (path === "/api/admin/analytics/business/investor-snapshot") return investorSnapshot;
  if (path === "/api/admin/business/dashboard") return tourismDashboard;
  if (path === "/api/admin/business/revenue") return {
    request_id: "req-revenue",
    core_version: "revenue-intelligence-v2",
    data_as_of: tourismDashboard.data_as_of,
    range: tourismDashboard.range,
    state: "unavailable",
    total_verified_revenue: null,
    currency: null,
    unavailable_reason: "No authorized revenue integration currently provides reconciled monetary values.",
    commercial_signals: { actions: tourismDashboard.kpis.commercial_intent, label: "Commercial actions", disclaimer: "Observed intent only — not transactions, sales, or revenue." },
    streams: [
      { id: "advertising", label: "Advertising", maturity: "integration_pending", verified_value: null, currency: null, availability: "unavailable", status_message: "No verified financial source is connected.", integration_requirement: "Connect an authorized AdMob or Google Ad Manager reporting credential with account and currency scope." },
      { id: "subscriptions", label: "Subscriptions", maturity: "integration_pending", verified_value: null, currency: null, availability: "unavailable", status_message: "No verified financial source is connected.", integration_requirement: "Connect an authorized RevenueCat or Stripe source and define recognized-revenue and refund handling." },
      { id: "promoted_content", label: "Promoted content", maturity: "planned", verified_value: null, currency: null, availability: "unavailable", status_message: "No verified financial source is connected.", integration_requirement: "Implement a promotion contract ledger with booked, delivered, invoiced, and paid states." },
      { id: "tickets_partners", label: "Tickets & partners", maturity: "planned", verified_value: null, currency: null, availability: "unavailable", status_message: "No verified financial source is connected.", integration_requirement: "Connect partner settlement data with order, refund, fee, currency, and payout identifiers." },
      { id: "business_intelligence", label: "Business intelligence", maturity: "planned", verified_value: null, currency: null, availability: "unavailable", status_message: "No verified financial source is connected.", integration_requirement: "Define billable products and connect an invoice or subscription source before reporting value." },
    ],
    maturity_scale: { active_measured: "Live, reconciled, and measured", active_incomplete: "Connected but not fully reconciled", integration_pending: "Product activity may exist; financial integration is pending", planned: "Planned monetization stream; no actual value is reported" },
    metric_catalog: { version: "investor-metrics-v2", metrics: {
      commercial_actions: { label: "Commercial actions", definition: "Observed high-intent actions; not sales or revenue.", formula: "directions + calls + website clicks + map opens", source: "Business Analytics Core", unit: "events", availability: "available", comparison: true, privacy: "aggregate", export_eligibility: ["executive_business", "investor_safe"] },
      revenue: { label: "Verified revenue", definition: "Reconciled monetary value from an authorized financial source.", formula: "recognized revenue", source: "No source configured", unit: "currency", availability: "unavailable_until_verified", comparison: false, privacy: "financial aggregate", export_eligibility: ["executive_business", "investor_safe"] },
    } },
  };
  if (path.startsWith("/api/admin/openapi/")) return { openapi: "3.1.0", info: { title: `Explore ${path.split("/").at(-1)} API`, version: "1.0.0" }, paths: { "/api/health": { get: { operationId: "getHealth", responses: { "200": { description: "Healthy" } } } } } };
  return { ok: true };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers: { "cache-control": "no-store", "x-request-id": "req-e2e" } });
}

export async function installAdminFixtures(page: Page, state: FixtureState, options: { freezeTime?: boolean } = {}) {
  if (options.freezeTime !== false) {
    await page.clock.install({ time: new Date("2026-10-12T15:00:00.000Z") });
  }

  await page.route("**/auth/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/auth/v1/token")) {
      const payload = request.postDataJSON() as { email?: string } | null;
      if (payload?.email === TEST_ADMIN_EMAIL) return fulfillJson(route, session);
      return fulfillJson(route, { error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials" }, 400);
    }
    if (url.pathname.endsWith("/auth/v1/user")) return fulfillJson(route, session.user);
    if (url.pathname.endsWith("/auth/v1/logout")) return route.fulfill({ status: 204, body: "" });
    return fulfillJson(route, { ok: true });
  });

  await page.route(/^http:\/\/127\.0\.0\.1:417[34]\/api\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/admin/me" && state.adminMeFailure === "network") {
      return route.abort("failed");
    }
    if (url.pathname === "/api/admin/me" && state.adminMeFailure === "unauthenticated") {
      return fulfillJson(route, { ok: false, error: "Invalid or expired session." }, 401);
    }
    if (url.pathname === "/api/admin/me" && state.adminMeFailure === "server") {
      return fulfillJson(route, { ok: false, error: "Supabase verification unavailable." }, 500);
    }
    if (url.pathname === "/api/admin/me" && !state.authorized) {
      return fulfillJson(route, { ok: false, error: "This account does not have admin access." }, 403);
    }
    if (state.mode === "error" && !["/api/admin/me", "/api/health"].includes(url.pathname)) {
      return fulfillJson(route, { ok: false, error: "Sanitized E2E upstream failure.", request_id: "req-e2e-error" }, 503);
    }
    const delay = state.rangeDelays?.[url.searchParams.get("range") || ""] || 0;
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (state.partialBusinessContent && url.pathname === "/api/admin/analytics/business/content") {
      return fulfillJson(route, { ...businessBase, summary: businessContent.summary });
    }
    if (url.pathname === "/api/admin/business/reports" && request.method() === "POST") {
      const body = Buffer.from("%PDF-1.4\n1 0 obj<< /Type /Catalog >>endobj\n%%EOF\n", "latin1");
      return route.fulfill({ status: 200, contentType: "application/pdf", body, headers: { "content-disposition": "attachment; filename=\"explore-intelligence_full_executive_2026-09-13_2026-10-12_en.pdf\"", "x-explore-report-fingerprint": "fixture-fingerprint", "x-explore-report-pages": "7" } });
    }
    const empty = state.mode === "empty" ? emptyFor(url.pathname) : null;
    return fulfillJson(route, empty ?? responseFor(url, request.method()));
  });

  await page.route("**/*tile.openstreetmap.org/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api.maptiler.com/**", (route) => route.fulfill({ status: 204, body: "" }));
}

export async function loginAsAdmin(page: Page) {
  await page.goto("/admin");
  const email = page.getByLabel("Work email");
  const executive = page.locator(".admin-executive");
  await expect
    .poll(async () => (await email.isVisible()) || (await executive.isVisible()), {
      message: "The admin login form or authenticated dashboard should become visible",
    })
    .toBe(true);
  if (await email.isVisible()) {
    await email.fill(TEST_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in to console" }).click();
  }
  await expect(executive).toBeVisible();
  await expect(executive).not.toHaveAttribute("aria-busy", "true");
}

export async function settleVisuals(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(150);
}
