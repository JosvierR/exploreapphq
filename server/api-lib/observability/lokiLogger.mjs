import { AsyncLocalStorage } from "node:async_hooks";

function enabled() {
  return String(process.env.GRAFANA_LOGS_ENABLED || "").toLowerCase() === "true";
}

function isLocalLoki(url) {
  return /localhost|127\.0\.0\.1|host\.docker\.internal/i.test(url);
}

function config() {
  return {
    enabled: enabled(),
    url: (process.env.GRAFANA_LOKI_URL || "").trim(),
    username: (process.env.GRAFANA_LOKI_USERNAME || "").trim(),
    token: (process.env.GRAFANA_LOKI_TOKEN || "").trim(),
  };
}

function ready(next = config()) {
  if (!next.enabled || !next.url) return false;
  // Local Loki (OSS docker stack) can run without auth.
  if (isLocalLoki(next.url)) return true;
  // Grafana Cloud / remote Loki requires a token (+ usually username/instance id).
  return Boolean(next.token);
}

export function lokiConfigured() {
  return ready();
}

export function observabilityConfigStatus() {
  const next = config();
  return {
    loki_enabled: next.enabled,
    loki_url_configured: Boolean(next.url),
    loki_username_configured: Boolean(next.username),
    loki_token_configured: Boolean(next.token),
    loki_ready: ready(next),
    grafana_logs_enabled: next.enabled,
    grafana_logs_level: logsMinLevel(),
    deployment: deploymentTarget(),
  };
}

function deploymentTarget() {
  if (process.env.VERCEL) return process.env.VERCEL_ENV || "vercel";
  if (process.env.DEPLOYMENT_TARGET) return String(process.env.DEPLOYMENT_TARGET).trim();
  return "local";
}

const LEVEL_RANK = { debug: 10, info: 20, warn: 30, error: 40 };

function logsMinLevel() {
  const raw = String(process.env.GRAFANA_LOGS_LEVEL || "").toLowerCase().trim();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
  // On Vercel, default to warn+error to stay within Cloud free tiers and keep latency low.
  if (process.env.VERCEL || deploymentTarget() === "vercel") return "warn";
  return "info";
}

function shouldPushLevel(level) {
  const min = LEVEL_RANK[logsMinLevel()] || 20;
  const current = LEVEL_RANK[String(level || "info").toLowerCase()] || 20;
  return current >= min;
}

function labelsFor(entry) {
  return {
    service: entry.service || "explore-web-admin",
    environment: entry.environment || "production",
    level: entry.level || "info",
    deployment: deploymentTarget(),
  };
}

const logContext = new AsyncLocalStorage();

export function runWithObservabilityContext(fn) {
  return logContext.run({ pending: [] }, fn);
}

function enqueuePending(promise) {
  const store = logContext.getStore();
  if (store?.pending) {
    store.pending.push(promise);
    return;
  }
  // Outside request context (scripts, boot): fire-and-forget is acceptable.
  void promise;
}

export async function flushPendingLokiLogs({ timeoutMs = 2500 } = {}) {
  const store = logContext.getStore();
  const pending = store?.pending?.splice(0, store.pending.length) || [];
  if (!pending.length) return { flushed: 0, timed_out: false };

  let timedOut = false;
  await Promise.race([
    Promise.allSettled(pending),
    new Promise((resolve) => {
      setTimeout(() => {
        timedOut = true;
        resolve(null);
      }, timeoutMs);
    }),
  ]);

  return { flushed: pending.length, timed_out: timedOut };
}

async function pushPayload(next, entry) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (next.token && next.username) {
    headers.Authorization = `Basic ${Buffer.from(`${next.username}:${next.token}`).toString("base64")}`;
  } else if (next.token) {
    headers.Authorization = `Bearer ${next.token}`;
  }

  const payload = {
    streams: [
      {
        stream: labelsFor(entry),
        values: [[`${Date.now()}000000`, JSON.stringify(entry)]],
      },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(next.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(
        JSON.stringify({
          level: "warn",
          service: "explore-web-admin",
          message: "Loki push failed",
          status: response.status,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        service: "explore-web-admin",
        message: "Loki push error",
        error: error instanceof Error ? error.message : "unknown",
        timestamp: new Date().toISOString(),
      }),
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function pushLokiLog(entry) {
  const next = config();
  if (!ready(next)) return;
  if (!shouldPushLevel(entry?.level)) return;
  enqueuePending(pushPayload(next, entry));
}

/**
 * Soft connectivity check for admin health (does not send application logs).
 * Returns ok/warning/skipped without leaking secrets.
 */
export async function probeLokiConnectivity({ timeoutMs = 1500 } = {}) {
  const next = config();
  if (!next.enabled) return { status: "skipped", reason: "grafana_logs_disabled" };
  if (!ready(next)) return { status: "warning", reason: "loki_not_configured" };

  const headers = { "Content-Type": "application/json" };
  if (next.token && next.username) {
    headers.Authorization = `Basic ${Buffer.from(`${next.username}:${next.token}`).toString("base64")}`;
  } else if (next.token) {
    headers.Authorization = `Bearer ${next.token}`;
  }

  const payload = {
    streams: [
      {
        stream: {
          service: "explore-web-admin",
          environment: process.env.APP_ENV || process.env.VERCEL_ENV || "production",
          level: "info",
          deployment: deploymentTarget(),
        },
        values: [
          [
            `${Date.now()}000000`,
            JSON.stringify({
              level: "info",
              message: "Loki connectivity probe",
              service: "explore-web-admin",
              probe: true,
              timestamp: new Date().toISOString(),
            }),
          ],
        ],
      },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(next.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (response.ok) return { status: "ok" };
    return { status: "warning", reason: `loki_http_${response.status}` };
  } catch {
    return { status: "warning", reason: "loki_unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
