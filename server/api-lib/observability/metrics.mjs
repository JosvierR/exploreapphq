const counters = new Map();
const timers = new Map();

function labelKey(labels = {}) {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(",");
}

function metricKey(name, labels = {}) {
  return `${name}|${labelKey(labels)}`;
}

function labelsObject(labels = {}) {
  return Object.fromEntries(Object.entries(labels).map(([key, value]) => [key, String(value)]));
}

export function incrementCounter(name, labels = {}, amount = 1) {
  const key = metricKey(name, labels);
  const current = counters.get(key);
  counters.set(key, {
    name,
    labels: labelsObject(labels),
    value: (current?.value || 0) + amount,
  });
}

export function observeTimer(name, value, labels = {}) {
  const key = metricKey(name, labels);
  const current = timers.get(key) || {
    name,
    labels: labelsObject(labels),
    count: 0,
    sum: 0,
    values: [],
  };

  current.count += 1;
  current.sum += value;
  current.values.push(value);
  if (current.values.length > 500) current.values.shift();
  timers.set(key, current);
}

export function recordApiRequest({ route, method, status, durationMs }) {
  const labels = {
    route: route || "/api",
    method: method || "GET",
    status: String(status || 0),
  };

  incrementCounter("explore_api_requests_total", labels);
  observeTimer("explore_api_request_duration_ms", durationMs || 0, {
    route: labels.route,
    method: labels.method,
  });

  if (Number(status) >= 400) {
    incrementCounter("explore_api_errors_total", {
      route: labels.route,
      method: labels.method,
      status: labels.status,
    });
  }

  if (Number(status) === 401 || Number(status) === 403) {
    incrementCounter("explore_auth_failures_total", {
      route: labels.route,
      status: labels.status,
    });
  }

  if (labels.route === "/api/health") incrementCounter("explore_health_check_total");
  if (labels.route === "/api/admin/reports" && labels.method === "GET") {
    incrementCounter("explore_reports_list_requests_total");
  }
  if (labels.route === "/api/admin/reports/:id" && labels.method === "GET") {
    incrementCounter("explore_report_detail_requests_total");
  }
}

export function recordAdminAction({ action, targetType, status = "success" }) {
  incrementCounter("explore_admin_actions_total", {
    action: action || "unknown",
    target_type: targetType || "unknown",
    status,
  });
}

export function recordModerationAction({ action, targetType, status = "success" }) {
  incrementCounter("explore_moderation_actions_total", {
    action: action || "unknown",
    target_type: targetType || "unknown",
    status,
  });

  if (targetType === "video") {
    incrementCounter("explore_video_moderation_actions_total", {
      action: action || "unknown",
      status,
    });
  }
}

export function recordSupabaseError(route = "unknown") {
  incrementCounter("explore_supabase_errors_total", { route });
}

function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1);
  return sorted[index];
}

export function metricsSnapshot() {
  return {
    generated_at: new Date().toISOString(),
    note: "In-memory metrics are per serverless instance and reset when the instance is recycled.",
    counters: [...counters.values()],
    timers: [...timers.values()].map((timer) => ({
      name: timer.name,
      labels: timer.labels,
      count: timer.count,
      sum: Number(timer.sum.toFixed(3)),
      avg: timer.count ? Number((timer.sum / timer.count).toFixed(3)) : 0,
      p95: Number(quantile(timer.values, 0.95).toFixed(3)),
    })),
  };
}

function escapeLabel(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function formatLabels(labels = {}) {
  const entries = Object.entries(labels);
  if (!entries.length) return "";
  return `{${entries.map(([key, value]) => `${key}="${escapeLabel(value)}"`).join(",")}}`;
}

const processStartedAt = Date.now();

export function metricsPrometheus() {
  const lines = [
    "# HELP explore_api_requests_total Total API requests handled by this serverless instance.",
    "# TYPE explore_api_requests_total counter",
  ];

  for (const counter of counters.values()) {
    lines.push(`${counter.name}${formatLabels(counter.labels)} ${counter.value}`);
  }

  for (const timer of timers.values()) {
    const labels = formatLabels(timer.labels);
    lines.push(`${timer.name}_count${labels} ${timer.count}`);
    lines.push(`${timer.name}_sum${labels} ${Number(timer.sum.toFixed(3))}`);
    lines.push(`${timer.name}_p95${labels} ${Number(quantile(timer.values, 0.95).toFixed(3))}`);
  }

  lines.push("# HELP explore_process_uptime_seconds Process uptime in seconds.");
  lines.push("# TYPE explore_process_uptime_seconds gauge");
  lines.push(`explore_process_uptime_seconds ${((Date.now() - processStartedAt) / 1000).toFixed(3)}`);

  return `${lines.join("\n")}\n`;
}
