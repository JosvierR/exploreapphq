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
  };
}

function labelsFor(entry) {
  return {
    service: entry.service || "explore-web-admin",
    environment: entry.environment || "production",
    level: entry.level || "info",
    route: entry.route || "unknown",
    deployment: "vercel",
  };
}

export async function pushLokiLog(entry) {
  const next = config();
  if (!ready(next)) return;

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

  try {
    const response = await fetch(next.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
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
  }
}
