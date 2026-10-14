/** Deterministic, nonproduction aggregate fixture used only for report validation. */
export function intelligenceReportFixture() {
  return {
    core_version: "business-analytics-core-v3",
    data_as_of: "2026-10-12T18:30:00.000Z",
    state: "ready",
    range: { start: "2026-09-13", end: "2026-10-12", preset: "30d" },
    filters: { country: null, region: null, city: null, category: null, platform: null, source: null },
    comparison: {
      mode: "previous",
      previous_period: { start: "2026-08-14", end: "2026-09-12" },
      deltas: {
        active_users: { current: 18420, previous: 16120, absolute: 2300, percent: 14.3 },
        sessions: { current: 42680, previous: 37910, absolute: 4770, percent: 12.6 },
        route_starts: { current: 21340, previous: 18980, absolute: 2360, percent: 12.4 },
        place_views: { current: 32110, previous: 28680, absolute: 3430, percent: 12.0 },
        route_views: { current: 26780, previous: 23920, absolute: 2860, percent: 12.0 },
        route_completions: { current: 7240, previous: 6320, absolute: 920, percent: 14.6 },
        commercial_actions: { current: 7860, previous: 6910, absolute: 950, percent: 13.7 },
      },
    },
    kpis: {
      active_users: 18420,
      sessions: 42680,
      place_views: 32110,
      route_views: 26780,
      route_starts: 21340,
      route_completions: 7240,
      commercial_actions: 7860,
      searches: 8930,
    },
    executive_summary: {
      market: "Global",
      text: "Demand and route engagement advanced during the period, led by destination discovery and dining interest.",
      statements: [
        "Active users increased 14.3% versus the previous period.",
        "Route starts reached 21,340, with continued destination-planning momentum.",
        "Commercial actions increased, but remain an intent signal rather than realized revenue.",
      ],
    },
    demand_index: { score: 76, status: "ready" },
    timeseries: Array.from({ length: 12 }, (_, index) => ({
      date: `2026-10-${String(index + 1).padStart(2, "0")}`,
      users: 980 + index * 78 + (index % 3) * 90,
      sessions: 2100 + index * 145,
      place_views: 1500 + index * 98,
      route_views: 1260 + index * 82,
      route_starts: 820 + index * 64,
      commercial_actions: 260 + index * 21,
      previous_users: 870 + index * 71,
      previous_sessions: 1910 + index * 130,
      previous_route_starts: 745 + index * 57,
    })),
    geography: {
      children: [
        { label: "Dominican Republic", events: 92800, share_pct: 42.1, growth_pct: 18.4, demand_index: 84 },
        { label: "United States", events: 58400, share_pct: 26.5, growth_pct: 9.2, demand_index: 73 },
        { label: "Spain", events: 27200, share_pct: 12.3, growth_pct: 7.8, demand_index: 68 },
        { label: "Mexico", events: 18400, share_pct: 8.3, growth_pct: 11.1, demand_index: 71 },
        { label: "Suppressed micro-market", events: 3, share_pct: 0.001, growth_pct: 50, demand_index: null },
      ],
    },
    categories: [
      { category: "Food & Dining", count: 42800, share_pct: 29.3, growth_pct: 20.9, demand_index: 84, opportunity_score: 88 },
      { category: "Beaches", count: 36200, share_pct: 24.8, growth_pct: 9.4, demand_index: 79, opportunity_score: 81 },
      { category: "Culture & Museums", count: 21800, share_pct: 14.9, growth_pct: 7.2, demand_index: 67, opportunity_score: 66 },
      { category: "Adventure & Outdoors", count: 17200, share_pct: 11.8, growth_pct: 15.6, demand_index: 74, opportunity_score: 79 },
    ],
    places: [
      { place_name: "Zona Colonial", category: "Culture & Museums", location: "Santo Domingo", views: 6840, actions: 1180, saves: 920, trend_pct: 16.3, data_quality: "verified" },
      { place_name: "Playa Bavaro", category: "Beaches", location: "Punta Cana", views: 5920, actions: 1040, saves: 780, trend_pct: 11.8, data_quality: "verified" },
      { place_name: "El Malecon", category: "Attractions", location: "Santo Domingo", views: 4120, actions: 640, saves: 510, trend_pct: 8.4, data_quality: "verified" },
    ],
    routes: [
      { route_name: "Santo Domingo Essentials", category: "Culture & Museums", location: "Santo Domingo", views: 5880, starts: 4310, completes: 1670, actions: 720, trend_pct: 14.2, data_quality: "verified" },
      { route_name: "Punta Cana Coast", category: "Beaches", location: "Punta Cana", views: 5140, starts: 3920, completes: 1390, actions: 680, trend_pct: 12.7, data_quality: "verified" },
      { route_name: "Samana Adventure", category: "Adventure & Outdoors", location: "Samana", views: 3640, starts: 2810, completes: 980, actions: 470, trend_pct: 18.1, data_quality: "verified" },
    ],
    opportunities: {
      cards: [
        { title: "Dining discovery gap", question: "Where should inventory coverage be investigated?", finding: "Food & Dining activity grew faster than the current comparison baseline.", evidence: "42,800 eligible observations and 20.9% period growth.", business_implication: "Incomplete dining coverage may constrain discovery in the leading destination.", recommended_investigation: "Audit verified dining inventory and test coverage in the highest-volume market before commercial outreach.", limitation: "Demand is event-based and does not establish unmet consumer demand or revenue potential.", confidence: "high" },
        { title: "Route planning momentum", question: "Which route moments warrant a controlled partner test?", finding: "Route starts increased relative to the previous equivalent window.", evidence: "21,340 starts, up 2,360 or 12.4% period over period.", business_implication: "High-intent route moments may support an experiment.", recommended_investigation: "Run a bounded call-to-action test on eligible routes and measure downstream commercial actions.", limitation: "Route starts are not completed trips, bookings, or sales.", confidence: "medium" },
      ],
    },
    insights: [
      { title: "Dining activity leads", question: "Which category changed most?", finding: "Food & Dining recorded the strongest eligible category growth.", evidence: "Food & Dining activity grew 20.9% across 42,800 observations.", interpretation: "The category is gaining observed discovery activity within this reporting scope.", next_step: "Validate inventory coverage before commercial outreach.", limitation: "Observed category activity is not market demand, a forecast, or proof of causality.", confidence: "high", sample_size: 42800 },
      { title: "SECRET USER EMAIL", evidence: "This record must be suppressed.", consideration: "Never export it.", confidence: "low", sample_size: 2 },
    ],
    searches: { top_searches: [{ display_query: "private query that must never export", count: 99 }] },
    data_quality: {
      status: "ready",
      valid_events: 286400,
      destination_geo_coverage_pct: 94.8,
      place_resolution_pct: 97.2,
      route_resolution_pct: 96.4,
      validity_view_active: true,
      rejected_events_in_range: 0,
      rejection_coverage_pct: 0,
      rejection_coverage_note: "Validation fixture includes a complete matched-window quality result.",
    },
    warnings: [],
  };
}
