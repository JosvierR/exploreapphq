import type { CSSProperties } from "react";
import { formatCompact, formatNumber } from "@/lib/analyticsDisplay";

export const chartColors = {
  primary: "#006edc",
  secondary: "#00aeff",
  positive: "#138a57",
  warning: "#a96209",
  negative: "#c72c41",
  slate: "#98a2b3",
  ink: "#111318",
  muted: "#667085",
  grid: "#eef0f4",
  surface: "#ffffff",
} as const;

export const chartPalette = [
  chartColors.primary,
  chartColors.secondary,
  chartColors.positive,
  chartColors.warning,
  chartColors.slate,
  "#6d48d7",
] as const;

export const chartAxisStyle = {
  fill: chartColors.muted,
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: -0.1,
} as const;

export const chartTooltipStyle: CSSProperties = {
  border: `1px solid #e7eaf0`,
  borderRadius: 12,
  background: "#ffffff",
  boxShadow: "0 12px 30px rgba(17,19,24,0.10)",
  color: chartColors.ink,
  fontSize: 12,
  letterSpacing: "-0.005em",
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
