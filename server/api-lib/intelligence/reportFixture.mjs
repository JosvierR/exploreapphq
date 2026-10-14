/** Deterministic, nonproduction aggregate fixture used only for report validation. */
export function intelligenceReportFixture() {
  return {
    core_version: "business-analytics-core-v2",
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
        commercial_intent: { current: 7860, previous: 6910, absolute: 950, percent: 13.7 },
      },
    },
    kpis: { active_users: 18420, sessions: 42680, route_starts: 21340, commercial_intent: 7860 },
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
      route_starts: 820 + index * 64,
      commercial_actions: 260 + index * 21,
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
      { category: "Restaurants", count: 42800, share_pct: 29.3, growth_pct: 20.9, demand_index: 84, opportunity_score: 88 },
      { category: "Beaches", count: 36200, share_pct: 24.8, growth_pct: 9.4, demand_index: 79, opportunity_score: 81 },
      { category: "Culture", count: 21800, share_pct: 14.9, growth_pct: 7.2, demand_index: 67, opportunity_score: 66 },
      { category: "Adventure", count: 17200, share_pct: 11.8, growth_pct: 15.6, demand_index: 74, opportunity_score: 79 },
    ],
    opportunities: {
      cards: [
        { title: "Restaurant discovery gap", evidence: "Dining demand grew 20.9% while the supply index remained below demand.", opportunity: "Prioritize verified dining inventory in the leading destination.", confidence: "high" },
        { title: "Route planning momentum", evidence: "Route starts grew 12.4% period over period.", opportunity: "Test partner calls to action on high-intent route moments.", confidence: "medium" },
      ],
    },
    insights: [
      { title: "Dining demand leads", evidence: "Restaurant demand grew 20.9% in a cohort of 42,800 observations.", consideration: "Validate inventory coverage before commercial outreach.", confidence: "high", sample_size: 42800 },
      { title: "SECRET USER EMAIL", evidence: "This record must be suppressed.", consideration: "Never export it.", confidence: "low", sample_size: 2 },
    ],
    searches: { top_searches: [{ display_query: "private query that must never export", count: 99 }] },
    data_quality: { status: "ready", valid_events: 286400, destination_geo_coverage_pct: 94.8, validity_view_active: true },
    warnings: [],
  };
}
