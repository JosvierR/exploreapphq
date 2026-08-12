import { formatNumber, metricLabel } from "@/lib/analyticsDisplay";
import { Sparkline } from "./Sparkline";

export type KpiDelta = {
  current?: number;
  previous?: number;
  absolute: number;
  percent: number | null;
  label?: string | null;
};

function trendDetails(delta?: KpiDelta, inverse = false) {
  if (!delta) return { label: "Comparison unavailable", tone: "neutral" as const, symbol: "—" };
  if (delta.label) return { label: delta.label, tone: "neutral" as const, symbol: "—" };
  if (delta.percent == null) {
    if (Number(delta.current || 0) > 0 && Number(delta.previous || 0) === 0) {
      return { label: "New this period", tone: "positive" as const, symbol: "+" };
    }
    return { label: "No previous data", tone: "neutral" as const, symbol: "—" };
  }
  const direction = delta.percent === 0 ? "neutral" : delta.percent > 0 ? "positive" : "negative";
  const tone = inverse && direction !== "neutral" ? (direction === "positive" ? "negative" : "positive") : direction;
  const sign = delta.percent > 0 ? "+" : "";
  return {
    label: `${sign}${delta.percent}%`,
    tone,
    symbol: delta.percent > 0 ? "↑" : delta.percent < 0 ? "↓" : "→",
  } as const;
}

export function KpiTrendCard({
  metricKey,
  value,
  delta,
  periodLabel,
  loading = false,
  inverseTrend = false,
  sparkline,
}: {
  metricKey: string;
  value: unknown;
  delta?: KpiDelta;
  periodLabel: string;
  loading?: boolean;
  inverseTrend?: boolean;
  sparkline?: Array<Record<string, unknown>>;
}) {
  const trend = trendDetails(delta, inverseTrend);
  const iconToneClass =
    trend.tone === "positive" ? " admin-kpi-card__icon--green" : trend.tone === "negative" ? " admin-kpi-card__icon--red" : "";

  return (
    <article className={`admin-kpi-card admin-kpi-card--${trend.tone}`}>
      <div className="admin-kpi-card__top">
        <span className={`admin-kpi-card__icon${iconToneClass}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19V11M11 19V5M18 19v-6" />
          </svg>
        </span>
        {sparkline && <Sparkline data={sparkline} dataKey={metricKey} tone={trend.tone} />}
      </div>
      <div className="admin-kpi-card__topline">
        <span>{metricLabel(metricKey)}</span>
      </div>
      {loading ? (
        <span className="admin-skeleton admin-skeleton--number" aria-label="Loading" />
      ) : (
        <strong>{formatNumber(value)}</strong>
      )}
      <div className="admin-kpi-card__trend">
        <span className="admin-kpi-card__delta"><b aria-hidden="true">{trend.symbol}</b>{trend.label}</span>
        <small>vs previous {periodLabel}</small>
      </div>
    </article>
  );
}
