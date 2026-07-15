import type { CSSProperties } from "react";
import { formatCompact, formatNumber } from "@/lib/analyticsDisplay";

export const chartColors = {
  primary: "#0b7fe8",
  secondary: "#13a8d8",
  positive: "#15803d",
  warning: "#b76e00",
  negative: "#c43737",
  slate: "#64748b",
  ink: "#101828",
  muted: "#667085",
  grid: "#e8edf4",
  surface: "#ffffff",
} as const;

export const chartPalette = [
  chartColors.primary,
  chartColors.secondary,
  chartColors.positive,
  chartColors.warning,
  chartColors.slate,
  "#7c8da5",
] as const;

export const chartAxisStyle = {
  fill: chartColors.muted,
  fontSize: 12,
  fontWeight: 600,
} as const;

export const chartTooltipStyle: CSSProperties = {
  border: `1px solid ${chartColors.grid}`,
  borderRadius: 8,
  background: chartColors.surface,
  boxShadow: "0 10px 28px rgba(15, 23, 42, 0.12)",
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
