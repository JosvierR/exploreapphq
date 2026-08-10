import type { CSSProperties } from "react";
import { formatCompact, formatNumber } from "@/lib/analyticsDisplay";

export const chartColors = {
  primary: "#0071e3",
  secondary: "#5ac8fa",
  positive: "#248a3d",
  warning: "#b25000",
  negative: "#d70015",
  slate: "#8e8e93",
  ink: "#1d1d1f",
  muted: "#6e6e73",
  grid: "rgba(0, 0, 0, 0.055)",
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
  letterSpacing: -0.2,
} as const;

export const chartTooltipStyle: CSSProperties = {
  border: `1px solid ${chartColors.grid}`,
  borderRadius: 12,
  background: "rgba(255,255,255,0.96)",
  boxShadow: "0 8px 28px rgba(0,0,0,0.08)",
  color: chartColors.ink,
  fontSize: 12,
  letterSpacing: "-0.01em",
  padding: "8px 10px",
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
