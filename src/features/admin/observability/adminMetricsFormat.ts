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
