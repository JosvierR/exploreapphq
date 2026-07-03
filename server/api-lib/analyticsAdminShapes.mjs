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

function avgEventsPerSession(rows) {
  const sessions = new Map();
  for (const row of rows) {
    if (!row?.session_id) continue;
    sessions.set(row.session_id, (sessions.get(row.session_id) || 0) + 1);
  }
  if (sessions.size === 0) return null;
  const total = [...sessions.values()].reduce((sum, count) => sum + count, 0);
  return Math.round((total / sessions.size) * 10) / 10;
}

function authShare(rows) {
  const authenticated = rows.filter((row) => row?.user_id).length;
  const anonymous = rows.length - authenticated;
  return {
    authenticated,
    anonymous,
    authenticated_pct: rows.length ? Math.round((authenticated / rows.length) * 100) : 0,
    anonymous_pct: rows.length ? Math.round((anonymous / rows.length) * 100) : 0,
  };
}

function bucketLabel(dateText, range) {
  if (!dateText) return null;
  if (range === "24h") return String(dateText).slice(0, 13) + ":00";
  return String(dateText).slice(0, 10);
}

export function makeAnalyticsWarning(code, message, extra = {}) {
  return { code, message, ...extra };
}

export function buildOverviewFromEvents({
  rangeRows,
  rows24h,
  eventsToday,
  events24h,
  events7d,
  events30d,
  deadLetters24h,
  deadLettersInRange,
  latestReceivedAt,
  latestOccurredAt,
  dailyView = null,
  warnings = [],
}) {
  const eventsInRange = rangeRows.length;
  const anonymousIdsInRange = uniqueCount(rangeRows, "anonymous_id");
  const authenticatedUsersInRange = uniqueCount(rangeRows, "user_id");
  const sessionsInRange = uniqueCount(rangeRows, "session_id");
  const eventNames = countBy(rangeRows, "event_name");
  const sources = countBy(rangeRows, "source");
  const platforms = countBy(rangeRows, "platform");
  const entityTypes = countBy(rangeRows, "entity_type");

  return {
    overview: {
      events_today: eventsToday,
      events_last_24h: events24h,
      events_last_7d: events7d,
      events_last_30d: events30d,
      events_in_range: eventsInRange,
      total_events_in_range: eventsInRange,
      active_anonymous_ids: uniqueCount(rows24h, "anonymous_id"),
      active_authenticated_users: uniqueCount(rows24h, "user_id"),
      anonymous_ids_in_range: anonymousIdsInRange,
      authenticated_users_in_range: authenticatedUsersInRange,
      sessions: uniqueCount(rows24h, "session_id"),
      sessions_in_range: sessionsInRange,
      avg_events_per_session: avgEventsPerSession(rangeRows),
      dead_letters_last_24h: deadLetters24h,
      dead_letters_in_range: deadLettersInRange,
      ingestion_health: events24h > 0 && deadLetters24h === 0 ? "healthy" : events24h > 0 ? "warning" : "warning",
      latest_received_at: latestReceivedAt,
      latest_occurred_at: latestOccurredAt,
      breakdowns: {
        event_name: eventNames,
        event_names: eventNames,
        source: sources,
        sources,
        platform: platforms,
        platforms,
        entity_type: entityTypes,
        entity_types: entityTypes,
        auth_share: authShare(rangeRows),
      },
      daily_view: dailyView,
    },
    warnings,
  };
}

export function buildTimeseriesFromEvents(rows, range, warnings = []) {
  const buckets = new Map();

  for (const row of rows) {
    const bucket = bucketLabel(row?.received_at, range);
    if (!bucket) continue;
    const current = buckets.get(bucket) || {
      day: bucket,
      count: 0,
      sessions: new Set(),
      anonymous: new Set(),
      authenticated: new Set(),
    };
    current.count += 1;
    if (row?.session_id) current.sessions.add(row.session_id);
    if (row?.anonymous_id) current.anonymous.add(row.anonymous_id);
    if (row?.user_id) current.authenticated.add(row.user_id);
    buckets.set(bucket, current);
  }

  const entries = [...buckets.values()]
    .map((bucket) => ({
      day: bucket.day,
      count: bucket.count,
      sessions: bucket.sessions.size,
      anonymous: bucket.anonymous.size,
      authenticated: bucket.authenticated.size,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return {
    timeseries: {
      events_by_day: entries.map(({ day, count }) => ({ day, count })),
      events_by_bucket: entries.map(({ day, count }) => ({ bucket: day, events: count })),
      sessions_by_day: entries.map(({ day, sessions }) => ({ day, count: sessions })),
      users_by_day: entries.map(({ day, authenticated, anonymous }) => ({ day, authenticated, anonymous })),
      top_event_names: countBy(rows, "event_name", 8),
      dead_letters_in_range: 0,
    },
    warnings,
  };
}

export function computeAnalyticsHealthStatus({ events24h, deadLetters24h, diagnostics }) {
  if (!diagnostics?.analytics_events_selectable || !diagnostics?.analytics_dead_letters_selectable) return "critical";
  if (events24h > 0 && deadLetters24h === 0) return "healthy";
  if (events24h > 0) return "warning";
  return "warning";
}

export function buildHealthPayload({
  events5m,
  events1h,
  events24h,
  deadLetters1h,
  deadLetters24h,
  latestEventReceivedAt,
  latestAggregationDay,
  rejectionReasons,
  rejectionSources,
  diagnostics,
  warnings = [],
}) {
  return {
    health: {
      status: computeAnalyticsHealthStatus({ events24h, deadLetters24h, diagnostics }),
      events_last_5m: events5m,
      events_last_1h: events1h,
      events_last_24h: events24h,
      dead_letters_last_1h: deadLetters1h,
      dead_letters_last_24h: deadLetters24h,
      rejection_reasons: rejectionReasons,
      rejection_sources: rejectionSources,
      last_successful_received_at: latestEventReceivedAt,
      latest_aggregation_day: latestAggregationDay,
    },
    warnings,
  };
}

export function buildAggregateSuccessBody(day) {
  return {
    ok: true,
    day,
    message: "Aggregation completed",
  };
}
