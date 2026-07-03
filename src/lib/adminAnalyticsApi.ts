import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { AdminApiError } from "@/lib/moderationAdminApi";

export type AnalyticsRange = "24h" | "7d" | "30d";

export type AnalyticsDiagnostics = {
  analytics_events_exists: boolean | null;
  analytics_dead_letters_exists: boolean | null;
  analytics_events_selectable: boolean;
  analytics_dead_letters_selectable: boolean;
  supabase_project_ref: string | null;
  service_role_configured: boolean;
  service_key_looks_like_jwt: boolean;
  warnings: string[];
};

export type BreakdownEntry = { value: string; count: number };

export type AnalyticsOverview = {
  events_today: number;
  events_last_24h: number;
  events_last_7d: number;
  events_last_30d: number;
  events_in_range: number | string;
  active_anonymous_ids: number;
  active_authenticated_users: number;
  sessions: number;
  avg_events_per_session: number | null;
  dead_letters_last_24h: number;
  ingestion_health: "healthy" | "warning" | "critical" | string;
  latest_received_at: string | null;
  latest_occurred_at: string | null;
  breakdowns: {
    event_name: BreakdownEntry[];
    source: BreakdownEntry[];
    platform: BreakdownEntry[];
    entity_type: BreakdownEntry[];
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

export type AnalyticsHealth = {
  status: "healthy" | "warning" | "critical" | string;
  events_last_5m: number;
  events_last_1h: number;
  events_last_24h: number;
  dead_letters_last_24h: number;
  rejection_reasons: BreakdownEntry[];
  rejection_sources: BreakdownEntry[];
  last_successful_received_at: string | null;
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
  return analyticsFetch<{ overview: AnalyticsOverview | null; diagnostics: AnalyticsDiagnostics; warnings: string[] }>(
    `/api/admin/analytics/overview?${query}`,
    { signal: params.signal },
  );
}

export function fetchAnalyticsTimeseries(params: RangeParams = {}) {
  const query = rangeQuery(params.range);
  return analyticsFetch<{ timeseries: AnalyticsTimeseries; diagnostics: AnalyticsDiagnostics }>(
    `/api/admin/analytics/timeseries?${query}`,
    { signal: params.signal },
  );
}

export function fetchAnalyticsTopContent(params: RangeParams & { entity_type?: string } = {}) {
  const search = new URLSearchParams({ range: params.range || "7d" });
  if (params.entity_type) search.set("entity_type", params.entity_type);
  return analyticsFetch<{
    top_content: {
      videos: TopContentItem[];
      places: TopContentItem[];
      routes: TopContentItem[];
      profiles: TopContentItem[];
    };
  }>(`/api/admin/analytics/top-content?${search}`, { signal: params.signal });
}

export function fetchAnalyticsSearch(params: RangeParams = {}) {
  return analyticsFetch<{ search: AnalyticsSearchInsights }>(`/api/admin/analytics/search?${rangeQuery(params.range)}`, {
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
  if (params.q) search.set("q", params.q);
  return analyticsFetch<{ events: AnalyticsEventRow[]; pagination: { limit: number; offset: number; total: number } }>(
    `/api/admin/analytics/events?${search}`,
    { signal: params.signal },
  );
}

export function fetchAnalyticsEventDetail(eventId: string, signal?: AbortSignal) {
  return analyticsFetch<{ event: AnalyticsEventRow }>(`/api/admin/analytics/events/${encodeURIComponent(eventId)}`, {
    signal,
  });
}

export function fetchAnalyticsHealth(signal?: AbortSignal) {
  return analyticsFetch<{ health: AnalyticsHealth; diagnostics: AnalyticsDiagnostics }>("/api/admin/analytics/health", {
    signal,
  });
}

export function fetchAnalyticsDeadLetters(
  params: RangeParams & { offset?: number; reason?: string; source?: string } = {},
) {
  const search = new URLSearchParams({ range: params.range || "7d" });
  if (params.offset != null) search.set("offset", String(params.offset));
  if (params.reason) search.set("reason", params.reason);
  if (params.source) search.set("source", params.source);
  return analyticsFetch<{
    dead_letters: AnalyticsDeadLetterRow[];
    pagination: { limit: number; offset: number; total: number };
  }>(`/api/admin/analytics/dead-letters?${search}`, { signal: params.signal });
}

export function runAnalyticsAggregation(day: string) {
  return analyticsFetch<{ day: string; result: Record<string, unknown> }>("/api/admin/analytics/aggregate", {
    method: "POST",
    body: JSON.stringify({ day }),
  });
}
