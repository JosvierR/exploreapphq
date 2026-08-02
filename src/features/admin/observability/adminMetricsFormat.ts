import type { AdminMetricsSnapshot } from "./adminObservabilityApi";

export function metricValue(metrics: AdminMetricsSnapshot | null, name: string) {
  const total = metrics?.counters
    .filter((counter) => counter.name === name)
    .reduce((sum, counter) => sum + counter.value, 0);
  return total === undefined ? null : total;
}

export function p95Duration(metrics: AdminMetricsSnapshot | null) {
  const timers = metrics?.timers.filter((timer) => timer.name === "explore_api_request_duration_ms") ?? [];
  if (timers.length === 0) return null;
  return Math.max(...timers.map((timer) => timer.p95));
}

export function formatMetricValue(value: number | null | undefined) {
  if (value === null || value === undefined) return "Not available";
  return new Intl.NumberFormat().format(value);
}

export function formatDuration(value: number | null | undefined) {
  if (value === null || value === undefined) return "Not available";
  return `${Math.round(value)} ms`;
}

export type MetricBreakdownRow = {
  label: string;
  value: number;
};

/** Aggregate a counter family by one label key (route, status, method, …). */
export function counterBreakdownByLabel(
  metrics: AdminMetricsSnapshot | null,
  name: string,
  labelKey: string,
  limit = 8,
): MetricBreakdownRow[] {
  if (!metrics) return [];
  const totals = new Map<string, number>();
  for (const counter of metrics.counters) {
    if (counter.name !== name) continue;
    const raw = counter.labels?.[labelKey];
    const label = (raw && String(raw).trim()) || "unknown";
    totals.set(label, (totals.get(label) || 0) + counter.value);
  }
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export function topNamedCounters(
  metrics: AdminMetricsSnapshot | null,
  names: string[],
): MetricBreakdownRow[] {
  return names.map((name) => ({
    label: humanizeMetricName(name),
    value: metricValue(metrics, name) ?? 0,
  }));
}

export function humanizeMetricName(name: string) {
  return name
    .replace(/^explore_/, "")
    .replace(/_total$/g, "")
    .replace(/_/g, " ");
}

export function errorRatePercent(metrics: AdminMetricsSnapshot | null) {
  const requests = metricValue(metrics, "explore_api_requests_total");
  const errors = metricValue(metrics, "explore_api_errors_total");
  if (requests === null || errors === null || requests <= 0) return null;
  return Math.min(100, (errors / requests) * 100);
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "Not available";
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}
