const USERS = Array.from({ length: 10 }, (_, index) => `user-${index + 1}`);
const PLACES = Array.from({ length: 8 }, (_, index) => `place-${index + 1}`);
const ROUTES = Array.from({ length: 3 }, (_, index) => `route-${index + 1}`);
const MARKETS = [
  { city: "Santiago de los Caballeros", region: "Santiago", country: "DO", geo_id: "00000000-0000-4000-8000-000000000001" },
  { city: "Miami", region: "Florida", country: "US", geo_id: "00000000-0000-4000-8000-000000000002" },
];

const events = [];

function add(count, eventName, entityType, entityIds, userCount = 10) {
  for (let index = 0; index < count; index += 1) {
    const user = USERS[index % userCount];
    const market = MARKETS[index % MARKETS.length];
    const sequence = events.length + 1;
    events.push({
      event_id: `golden-${String(sequence).padStart(3, "0")}`,
      event_name: eventName,
      event_version: 1,
      entity_type: entityType,
      entity_id: entityIds?.[index % entityIds.length] || null,
      user_id: user,
      anonymous_id: null,
      session_id: `session-${user}`,
      occurred_at: `2026-08-${String(1 + (index % 5)).padStart(2, "0")}T${String(9 + (index % 10)).padStart(2, "0")}:00:00.000Z`,
      received_at: `2026-08-${String(1 + (index % 5)).padStart(2, "0")}T${String(9 + (index % 10)).padStart(2, "0")}:00:05.000Z`,
      timezone: market.country === "DO" ? "America/Santo_Domingo" : "America/New_York",
      ...market,
      properties: eventName === "search_performed" ? { query_hash: `query-${index % 5}`, results_count: index % 4 } : {},
      context: { environment: "production" },
    });
  }
}

add(32, "place_view", "place", PLACES, 8);
add(12, "place_save", "place", PLACES, 8);
add(4, "place_get_directions", "place", PLACES, 4);
add(10, "search_performed", "search", null, 10);
add(8, "route_view", "route", ROUTES, 8);
add(6, "route_start", "route", ROUTES, 6);
add(3, "route_complete", "route", ROUTES, 3);
add(5, "place_impression", "place", PLACES, 5);
add(4, "route_impression", "route", ROUTES, 4);
add(4, "place_share", "place", PLACES, 4);
add(12, "content_view", "content", ["content-1", "content-2"], 10);

export const BUSINESS_GOLDEN_DATASET = Object.freeze({
  users: USERS,
  markets: MARKETS,
  places: PLACES,
  routes: ROUTES,
  events: Object.freeze(events),
  expected: Object.freeze({
    events: 100,
    active_travelers: 10,
    sessions: 10,
    place_views: 32,
    unique_place_visitors: 8,
    saves: 12,
    directions: 4,
    commercial_actions: 4,
    intent_rate: 12.5,
    searches: 10,
    route_views: 8,
    route_starts: 6,
    route_completions: 3,
    route_completion_rate: 50,
  }),
});

