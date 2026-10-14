const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const API_ROOT = "https://admob.googleapis.com/v1";
const READONLY_SCOPE = "https://www.googleapis.com/auth/admob.readonly";
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_REPORT_ROWS = 10_000;

const ALLOWED_DIMENSIONS = new Set(["DATE", "AD_UNIT", "APP", "COUNTRY", "FORMAT", "PLATFORM"]);
const REPORT_METRICS = ["AD_REQUESTS", "MATCHED_REQUESTS", "IMPRESSIONS", "CLICKS", "ESTIMATED_EARNINGS", "IMPRESSION_RPM", "MATCH_RATE", "SHOW_RATE"];
const cache = new Map();

export class AdMobAdapterError extends Error {
  constructor(message, code, status = 502) {
    super(message);
    this.name = "AdMobAdapterError";
    this.code = code;
    this.status = status;
  }
}

function configuredValue(env, name) {
  return String(env?.[name] || "").trim();
}

export function admobConfigurationStatus(env = process.env) {
  const required = ["ADMOB_PUBLISHER_ID", "ADMOB_OAUTH_CLIENT_ID", "ADMOB_OAUTH_REFRESH_TOKEN"];
  const missing = required.filter((name) => !configuredValue(env, name));
  return {
    provider: "admob",
    status: missing.length ? "disconnected" : "configured_unverified",
    configured: missing.length === 0,
    missing,
    scope: READONLY_SCOPE,
    value_classification: "provider_reported_estimate",
  };
}

function parseDate(value, label) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new AdMobAdapterError(`${label} must be YYYY-MM-DD.`, "admob_invalid_date", 400);
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new AdMobAdapterError(`${label} must be a valid calendar date.`, "admob_invalid_date", 400);
  }
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function validateDimensions(dimensions) {
  const requested = Array.isArray(dimensions) && dimensions.length ? dimensions : ["DATE"];
  const normalized = [...new Set(requested.map((value) => String(value || "").trim().toUpperCase()))];
  const invalid = normalized.find((value) => !ALLOWED_DIMENSIONS.has(value));
  if (invalid) throw new AdMobAdapterError(`Unsupported AdMob dimension: ${invalid}.`, "admob_invalid_dimension", 400);
  return normalized;
}

function safeProviderMessage(body, fallback) {
  const status = Number(body?.error?.code || body?.status || 0);
  if (status === 401 || status === 403) return "AdMob authorization failed for the configured read-only credential.";
  if (status === 429) return "AdMob reporting quota is temporarily exhausted.";
  return fallback;
}

async function fetchJson(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AdMobAdapterError(
        safeProviderMessage(body, "AdMob reporting request failed."),
        response.status === 401 || response.status === 403 ? "admob_authorization_failed" : response.status === 429 ? "admob_rate_limited" : "admob_request_failed",
        response.status,
      );
    }
    return body;
  } catch (error) {
    if (error instanceof AdMobAdapterError) throw error;
    if (error?.name === "AbortError") throw new AdMobAdapterError("AdMob reporting request timed out.", "admob_timeout", 504);
    throw new AdMobAdapterError("AdMob reporting request could not be completed.", "admob_network_error");
  } finally {
    clearTimeout(timer);
  }
}

async function refreshAccessToken(env, fetchImpl, timeoutMs) {
  const form = new URLSearchParams({
    client_id: configuredValue(env, "ADMOB_OAUTH_CLIENT_ID"),
    refresh_token: configuredValue(env, "ADMOB_OAUTH_REFRESH_TOKEN"),
    grant_type: "refresh_token",
  });
  const secret = configuredValue(env, "ADMOB_OAUTH_CLIENT_SECRET");
  if (secret) form.set("client_secret", secret);
  const body = await fetchJson(fetchImpl, TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }, timeoutMs);
  if (!body?.access_token) throw new AdMobAdapterError("AdMob token response was incomplete.", "admob_token_incomplete");
  return String(body.access_token);
}

function metricNumber(metricValue) {
  if (!metricValue || typeof metricValue !== "object") return null;
  const value = metricValue.integerValue ?? metricValue.doubleValue ?? metricValue.microsValue;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedRow(row) {
  const dimensions = Object.fromEntries(
    Object.entries(row?.dimensionValues || {}).map(([key, value]) => [key, value?.displayLabel || value?.value || null]),
  );
  const metrics = Object.fromEntries(
    REPORT_METRICS.map((key) => [key, metricNumber(row?.metricValues?.[key])]),
  );
  return { dimensions, metrics };
}

function parseReport(payload, currencyCode) {
  const chunks = Array.isArray(payload) ? payload : [];
  const rows = chunks.filter((chunk) => chunk?.row).map((chunk) => normalizedRow(chunk.row));
  if (rows.length > MAX_REPORT_ROWS) throw new AdMobAdapterError("AdMob report exceeded the reviewed row limit.", "admob_report_too_large", 422);
  const header = chunks.find((chunk) => chunk?.header)?.header || {};
  const resolvedCurrency = header.localizationSettings?.currencyCode || currencyCode || null;
  const earningsMicros = rows.reduce((sum, row) => sum + (row.metrics.ESTIMATED_EARNINGS || 0), 0);
  return {
    rows,
    row_count: rows.length,
    currency: resolvedCurrency,
    estimated_earnings: resolvedCurrency ? earningsMicros / 1_000_000 : null,
    earnings_micros: earningsMicros,
    impressions: rows.reduce((sum, row) => sum + (row.metrics.IMPRESSIONS || 0), 0),
    clicks: rows.reduce((sum, row) => sum + (row.metrics.CLICKS || 0), 0),
    classification: "provider_reported_estimate",
    finality: "estimated_not_final",
  };
}

export function createAdMobRevenueAdapter({ env = process.env, fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS, cacheTtlMs = DEFAULT_CACHE_TTL_MS } = {}) {
  const configuration = admobConfigurationStatus(env);
  return {
    configuration,
    async getNetworkRevenue({ start, end, dimensions = ["DATE"], currencyCode = configuredValue(env, "ADMOB_CURRENCY_CODE") || null } = {}) {
      if (!configuration.configured) {
        return { status: "disconnected", configuration, data: null, error: null };
      }
      if (typeof fetchImpl !== "function") throw new AdMobAdapterError("Fetch implementation is unavailable.", "admob_fetch_unavailable", 500);
      const startDate = parseDate(start, "start");
      const endDate = parseDate(end, "end");
      if (Date.UTC(endDate.year, endDate.month - 1, endDate.day) < Date.UTC(startDate.year, startDate.month - 1, startDate.day)) {
        throw new AdMobAdapterError("end must be on or after start.", "admob_invalid_range", 400);
      }
      const safeDimensions = validateDimensions(dimensions);
      const publisherId = configuredValue(env, "ADMOB_PUBLISHER_ID");
      const cacheKey = JSON.stringify([publisherId, start, end, safeDimensions, currencyCode]);
      const cached = cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cache: "hit" };

      const token = await refreshAccessToken(env, fetchImpl, timeoutMs);
      const reportSpec = {
        dateRange: { startDate, endDate },
        dimensions: safeDimensions,
        metrics: REPORT_METRICS,
        maxReportRows: MAX_REPORT_ROWS,
      };
      if (currencyCode) reportSpec.localizationSettings = { currencyCode };
      const payload = await fetchJson(
        fetchImpl,
        `${API_ROOT}/accounts/${encodeURIComponent(publisherId)}/networkReport:generate`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ reportSpec }),
        },
        timeoutMs,
      );
      const value = {
        status: "connected_estimated",
        configuration,
        data: parseReport(payload, currencyCode),
        error: null,
        cache: "miss",
      };
      cache.set(cacheKey, { value, expiresAt: Date.now() + cacheTtlMs });
      return value;
    },
  };
}
