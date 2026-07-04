import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { AdminApiError } from "@/lib/moderationAdminApi";

export type AnalyticsRange = "24h" | "7d" | "30d";

export type AnalyticsWarning = {
  code: string;
  message: string;
  classified_code?: string;
};

export type AnalyticsDiagnostics = {
  analytics_events_exists: boolean | null;
  analytics_dead_letters_exists: boolean | null;
  analytics_events_selectable: boolean;
  analytics_dead_letters_selectable: boolean;
  analytics_dead_letters_time_column?: string | null;
  overview_daily_view_available?: boolean | null;
  top_content_daily_view_available?: boolean | null;
  search_insights_daily_view_available?: boolean | null;
  admin_metrics_daily_available?: boolean | null;
  using_raw_events_fallback?: boolean;
  supabase_project_ref: string | null;
  service_role_configured: boolean;
  service_key_looks_like_jwt: boolean;
  warnings: AnalyticsWarning[];
};

export type BreakdownEntry = { value: string; count: number };

export type AnalyticsOverview = {
  events_today: number;
  events_last_24h: number;
  events_last_7d: number;
  events_last_30d: number;
  events_in_range: number | string;
  total_events_in_range?: number;
  active_anonymous_ids: number;
  active_authenticated_users: number;
  anonymous_ids_in_range?: number;
  authenticated_users_in_range?: number;
  sessions: number;
  sessions_in_range?: number;
  avg_events_per_session: number | null;
  dead_letters_last_24h: number;
  dead_letters_in_range?: number;
  ingestion_health: "healthy" | "warning" | "critical" | string;
  latest_received_at: string | null;
  latest_occurred_at: string | null;
  breakdowns: {
    event_name: BreakdownEntry[];
    event_names?: BreakdownEntry[];
    source: BreakdownEntry[];
    sources?: BreakdownEntry[];
    platform: BreakdownEntry[];
    platforms?: BreakdownEntry[];
    entity_type: BreakdownEntry[];
    entity_types?: BreakdownEntry[];
    auth_share: {
      authenticated: number;
      anonymous: number;
      authenticated_pct: number;
      anonymous_pct: number;
    };
  };
  daily_view: Array<Record<string, unknown>> | null;
};

export type AnalyticsTimeseries = {
  events_by_day: Array<{ day: string; count: number }>;
  events_by_bucket?: Array<{ bucket: string; events: number }>;
  sessions_by_day: Array<{ day: string; count: number }>;
  users_by_day: Array<{ day: string; count?: number; authenticated?: number; anonymous?: number }>;
  top_event_names: BreakdownEntry[];
  dead_letters_in_range: number;
};

export type TopContentItem = {
  entity_id: string;
  entity_type: string;
  event_count?: number;
  impressions?: number | null;
  clicks?: number | null;
  likes?: number | null;
  saves?: number | null;
  shares?: number | null;
  engagement_rate?: number | null;
  last_event_at?: string | null;
  primary_events?: Array<{ event_name: string; count: number }> | null;
};

export type AnalyticsSearchInsights = {
  total_searches: number;
  no_result_searches: number;
  click_through_rate: number | null;
  top_query_hashes: Array<{ query_hash: string; count: number }>;
  query_length_distribution: Array<{ bucket: string; count: number }>;
  entity_type_breakdown: BreakdownEntry[];
  top_clicked_entities: Array<{ entity_type: string; entity_id: string; count: number }>;
};

export type AnalyticsEventRow = {
  event_id: string;
  received_at: string;
  occurred_at: string;
  event_name: string;
  source: string;
  platform: string;
  entity_type: string | null;
  entity_id: string | null;
  anonymous_id_short: string | null;
  user_id_present: boolean;
  session_id_short: string | null;
  app_version: string | null;
  build_number: string | null;
  properties?: Record<string, unknown>;
  context?: Record<string, unknown>;
};

export type AnalyticsDeadLetterRow = {
  received_at: string;
  event_id: string | null;
  anonymous_id_short: string | null;
  user_id_present: boolean;
  reason: string | null;
  source: string;
  payload_summary: {
    key_count: number;
    keys: string[];
    preview: Record<string, unknown>;
  } | null;
};

export type AnalyticsQualityWarning = {
  code: string;
  severity: "info" | "warning" | "critical" | string;
  count?: number | null;
  message: string;
};

export type AnalyticsHealth = {
  status: "healthy" | "warning" | "critical" | string;
  events_last_5m: number;
  events_last_1h: number;
  events_last_24h: number;
  dead_letters_last_1h?: number;
  dead_letters_last_24h: number;
  dead_letter_rate_24h?: number;
  rejection_reasons: BreakdownEntry[];
  rejection_sources: BreakdownEntry[];
  last_successful_received_at: string | null;
  latest_aggregation_day?: string | null;
  aggregation_freshness?: {
    latest_admin_metrics_day: string | null;
    latest_overview_day: string | null;
    is_today_aggregated: boolean;
    is_yesterday_aggregated: boolean;
  };
  quality_warnings?: AnalyticsQualityWarning[];
};

export type AnalyticsAggregationDayResult = {
  day: string;
  ok: boolean;
  message?: string;
  code?: string;
};

export type AnalyticsDeadLetterSummary = {
  last_24h: number;
  last_7d: number;
  by_reason: BreakdownEntry[];
  by_source: BreakdownEntry[];
};

type RangeParams = {
  range?: AnalyticsRange;
  signal?: AbortSignal;
};

async function accessToken() {
  const client = getSupabaseBrowserClient();
  if (!client) throw new AdminApiError("Supabase is not configured.");
  const { data, error } = await client.auth.getSession();
  if (error) throw new AdminApiError(error.message);
  const token = data.session?.access_token;
  if (!token) throw new AdminApiError("Authentication required.", { status: 401 });
  return token;
}

function rangeQuery(range: AnalyticsRange = "7d") {
  return `range=${encodeURIComponent(range)}`;
}

async function analyticsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    throw new AdminApiError(body.error || "Analytics request failed.", {
      status: response.status,
      requestId: body.request_id,
    });
  }
  return body as T;
}

export function fetchAnalyticsOverview(params: RangeParams = {}) {
  const query = rangeQuery(params.range);
  return analyticsFetch<{ request_id: string; overview: AnalyticsOverview | null; diagnostics: AnalyticsDiagnostics; warnings: AnalyticsWarning[] }>(
    `/api/admin/analytics/overview?${query}`,
    { signal: params.signal },
  );
}

export function fetchAnalyticsTimeseries(params: RangeParams = {}) {
  const query = rangeQuery(params.range);
  return analyticsFetch<{ request_id: string; timeseries: AnalyticsTimeseries; diagnostics: AnalyticsDiagnostics; warnings: AnalyticsWarning[] }>(
    `/api/admin/analytics/timeseries?${query}`,
    { signal: params.signal },
  );
}

export function fetchAnalyticsTopContent(params: RangeParams & { entity_type?: string } = {}) {
  const search = new URLSearchParams({ range: params.range || "7d" });
  if (params.entity_type) search.set("entity_type", params.entity_type);
  return analyticsFetch<{
    request_id: string;
    top_content: {
      videos: TopContentItem[];
      places: TopContentItem[];
      routes: TopContentItem[];
      profiles: TopContentItem[];
    };
    warnings?: AnalyticsWarning[];
  }>(`/api/admin/analytics/top-content?${search}`, { signal: params.signal });
}

export function fetchAnalyticsSearch(params: RangeParams = {}) {
  return analyticsFetch<{ request_id: string; search: AnalyticsSearchInsights; warnings?: AnalyticsWarning[] }>(`/api/admin/analytics/search?${rangeQuery(params.range)}`, {
    signal: params.signal,
  });
}

export function fetchAnalyticsEvents(
  params: RangeParams & {
    offset?: number;
    limit?: number;
    event_name?: string;
    source?: string;
    platform?: string;
    entity_type?: string;
    auth?: "authenticated" | "anonymous";
    has_user_id?: boolean;
    event_id?: string;
    entity_id?: string;
    q?: string;
  } = {},
) {
  const search = new URLSearchParams({ range: params.range || "7d" });
  if (params.offset != null) search.set("offset", String(params.offset));
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.event_name) search.set("event_name", params.event_name);
  if (params.source) search.set("source", params.source);
  if (params.platform) search.set("platform", params.platform);
  if (params.entity_type) search.set("entity_type", params.entity_type);
  if (params.auth) search.set("auth", params.auth);
  if (params.has_user_id != null) search.set("has_user_id", String(params.has_user_id));
  if (params.event_id) search.set("event_id", params.event_id);
  if (params.entity_id) search.set("entity_id", params.entity_id);
  if (params.q) search.set("q", params.q);
  return analyticsFetch<{ request_id: string; events: AnalyticsEventRow[]; pagination: { limit: number; offset: number; total: number }; warnings?: AnalyticsWarning[] }>(
    `/api/admin/analytics/events?${search}`,
    { signal: params.signal },
  );
}

export function getAnalyticsEvents(params: Parameters<typeof fetchAnalyticsEvents>[0] = {}) {
  return fetchAnalyticsEvents(params);
}

export function fetchAnalyticsEventDetail(eventId: string, signal?: AbortSignal) {
  return analyticsFetch<{ request_id: string; event: AnalyticsEventRow }>(`/api/admin/analytics/events/${encodeURIComponent(eventId)}`, {
    signal,
  });
}

export function fetchAnalyticsHealth(signal?: AbortSignal) {
  return analyticsFetch<{
    request_id: string;
    status: AnalyticsHealth["status"];
    health: AnalyticsHealth;
    diagnostics: AnalyticsDiagnostics;
    quality_warnings?: AnalyticsQualityWarning[];
    aggregation_freshness?: AnalyticsHealth["aggregation_freshness"];
    warnings: AnalyticsWarning[];
  }>("/api/admin/analytics/health", {
    signal,
  });
}

export function getAnalyticsHealth(signal?: AbortSignal) {
  return fetchAnalyticsHealth(signal);
}

export function fetchAnalyticsDeadLetters(
  params: RangeParams & { offset?: number; reason?: string; source?: string } = {},
) {
  const search = new URLSearchParams({ range: params.range || "7d" });
  if (params.offset != null) search.set("offset", String(params.offset));
  if (params.reason) search.set("reason", params.reason);
  if (params.source) search.set("source", params.source);
  return analyticsFetch<{
    request_id: string;
    items?: AnalyticsDeadLetterRow[];
    dead_letters: AnalyticsDeadLetterRow[];
    summary?: AnalyticsDeadLetterSummary;
    pagination: { limit: number; offset: number; total: number };
    warnings?: AnalyticsWarning[];
  }>(`/api/admin/analytics/dead-letters?${search}`, { signal: params.signal });
}

export function getAnalyticsDeadLetters(params: Parameters<typeof fetchAnalyticsDeadLetters>[0] = {}) {
  return fetchAnalyticsDeadLetters(params);
}

export function runAnalyticsAggregation(input: { day: string } | { preset: "today" | "yesterday" | "last_7_days" } | string) {
  const body = typeof input === "string" ? { day: input } : input;
  return analyticsFetch<{
    request_id: string;
    days: AnalyticsAggregationDayResult[];
    warnings: AnalyticsWarning[];
    message?: string;
    day?: string;
  }>("/api/admin/analytics/aggregate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type BusinessRangePreset = "24h" | "7d" | "30d" | "90d";

export type BusinessRange = {
  start: string;
  end: string;
  preset: BusinessRangePreset | "custom" | string;
};

export type BusinessWarning = {
  code: string;
  severity?: string;
  message: string;
};

type BusinessParams = {
  range?: BusinessRangePreset;
  platform?: string;
  source?: string;
  entity_type?: string;
  compare?: "previous";
  signal?: AbortSignal;
};

function businessQuery(params: BusinessParams = {}) {
  const search = new URLSearchParams({ range: params.range || "7d" });
  if (params.platform) search.set("platform", params.platform);
  if (params.source) search.set("source", params.source);
  if (params.entity_type) search.set("entity_type", params.entity_type);
  if (params.compare) search.set("compare", params.compare);
  return search.toString();
}

function businessFetch<T>(path: string, params: BusinessParams = {}) {
  return analyticsFetch<
    T & {
      request_id: string;
      range: BusinessRange;
      warnings?: BusinessWarning[];
      comparison?: {
        previous_period: { start: string; end: string };
        deltas: Record<string, { current: number; previous: number; absolute: number; percent: number | null; label?: string | null }>;
      };
    }
  >(`${path}?${businessQuery(params)}`, {
    signal: params.signal,
  });
}

export function getBusinessOverview(params: BusinessParams = {}) {
  return businessFetch<{
    summary: Record<string, unknown>;
    breakdowns: Record<string, BreakdownEntry[]>;
    series: Array<Record<string, number | string>>;
  }>("/api/admin/analytics/business/overview", params);
}

export function getBusinessGrowth(params: BusinessParams = {}) {
  return businessFetch<{
    summary: Record<string, number>;
    breakdowns: Record<string, BreakdownEntry[]>;
    series: Array<Record<string, number | string>>;
  }>("/api/admin/analytics/business/growth", params);
}

export function getBusinessFunnel(params: BusinessParams = {}) {
  return businessFetch<{
    summary: Record<string, number>;
    funnel: Array<{ key: string; label: string; count: number; unique_sessions: number; dropoff_pct: number }>;
  }>("/api/admin/analytics/business/funnel", params);
}

export function getBusinessContent(params: BusinessParams = {}) {
  return businessFetch<{
    summary: Record<string, number>;
    sections: {
      videos: Array<Record<string, unknown>>;
      places: Array<Record<string, unknown>>;
      routes: Array<Record<string, unknown>>;
      profiles: Array<Record<string, unknown>>;
    };
  }>("/api/admin/analytics/business/content", params);
}

export function getBusinessSearch(params: BusinessParams = {}) {
  return businessFetch<{
    summary: Record<string, number>;
    breakdowns: {
      top_query_hashes: Array<{ query_hash: string; count: number }>;
      top_search_entity_types: BreakdownEntry[];
    };
    series: Array<Record<string, number | string>>;
  }>("/api/admin/analytics/business/search", params);
}

export function getBusinessCreators(params: BusinessParams = {}) {
  return businessFetch<{
    summary: Record<string, number>;
    creators: Array<Record<string, unknown>>;
  }>("/api/admin/analytics/business/creators", params);
}

export function getBusinessLocations(params: BusinessParams = {}) {
  return businessFetch<{
    summary: Record<string, number>;
    countries: Array<Record<string, unknown>>;
    regions: Array<Record<string, unknown>>;
    cities: Array<Record<string, unknown>>;
  }>("/api/admin/analytics/business/locations", params);
}

export function getInvestorSnapshot(params: BusinessParams = {}) {
  return businessFetch<{
    period: string;
    snapshot: Record<string, unknown>;
    copy_text: string;
  }>("/api/admin/analytics/business/investor-snapshot", params);
}
