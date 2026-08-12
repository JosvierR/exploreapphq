import type { CSSProperties } from "react";
import { formatCompact, formatNumber } from "@/lib/analyticsDisplay";

export const chartColors = {
  primary: "#3b82f6",
  secondary: "#38bdf8",
  positive: "#16a34a",
  warning: "#d97706",
  negative: "#dc2626",
  slate: "#94a3b8",
  ink: "#0f172a",
  muted: "#64748b",
  grid: "#f1f5f9",
  surface: "#ffffff",
} as const;

export const chartPalette = [
  chartColors.primary,
  chartColors.secondary,
  chartColors.positive,
  chartColors.warning,
  chartColors.slate,
  "#7c3aed",
] as const;

export const chartAxisStyle = {
  fill: chartColors.muted,
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: -0.1,
} as const;

export const chartTooltipStyle: CSSProperties = {
  border: `1px solid #e2e8f0`,
  borderRadius: 8,
  background: "#ffffff",
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
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
