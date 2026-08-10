import type { CSSProperties } from "react";
import { formatCompact, formatNumber } from "@/lib/analyticsDisplay";

export const chartColors = {
  primary: "#0071e3",
  secondary: "#32ade6",
  positive: "#34c759",
  warning: "#ff9f0a",
  negative: "#ff3b30",
  slate: "#8e8e93",
  ink: "#1d1d1f",
  muted: "#6e6e73",
  grid: "rgba(0, 0, 0, 0.06)",
  surface: "#ffffff",
} as const;

export const chartPalette = [
  chartColors.primary,
  chartColors.secondary,
  chartColors.positive,
  chartColors.warning,
  chartColors.slate,
  "#af52de",
] as const;

export const chartAxisStyle = {
  fill: chartColors.muted,
  fontSize: 11,
  fontWeight: 500,
} as const;

export const chartTooltipStyle: CSSProperties = {
  border: `1px solid ${chartColors.grid}`,
  borderRadius: 10,
  background: chartColors.surface,
  boxShadow: "none",
  color: chartColors.ink,
  fontSize: 12,
};

export function formatChartValue(value: unknown) {
  return formatNumber(typeof value === "number" ? value : Number(value || 0));
}

export function formatChartTick(value: unknown) {
  return formatCompact(typeof value === "number" ? value : Number(value || 0));
}

export function formatChartDate(value: unknown) {
  const raw = String(value ?? "");
  const date = new Date(`${raw}T00:00:00`);
  if (!raw || Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}
