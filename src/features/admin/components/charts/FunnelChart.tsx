import { Funnel, FunnelChart as RechartsFunnelChart, LabelList, ResponsiveContainer, Tooltip } from "recharts";
import { formatNumber } from "@/lib/analyticsDisplay";
import { chartPalette, chartTooltipStyle, formatChartValue } from "./chartTheme";

export type FunnelDatum = {
  key: string;
  label: string;
  value: number;
  sessions: number;
  dropoff: number;
};

export function FunnelChart({ data }: { data: FunnelDatum[] }) {
  const chartData = data.map((item, index) => ({ ...item, fill: chartPalette[index % chartPalette.length] }));

  return (
    <div className="admin-funnel-layout">
      <div className="admin-funnel-chart" role="img" aria-label="Engagement funnel by step">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsFunnelChart>
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(value) => [formatChartValue(value), "Events"]}
            />
            <Funnel dataKey="value" data={chartData} nameKey="label" isAnimationActive={false}>
              <LabelList position="right" fill="#101828" stroke="none" dataKey="label" />
            </Funnel>
          </RechartsFunnelChart>
        </ResponsiveContainer>
      </div>
      <ol className="admin-funnel-steps">
        {data.map((item, index) => (
          <li key={item.key}>
            <span className="admin-funnel-steps__index">{index + 1}</span>
            <span className="admin-funnel-steps__copy"><strong>{item.label}</strong><small>{formatNumber(item.sessions)} sessions</small></span>
            <span className="admin-funnel-steps__value"><strong>{formatNumber(item.value)}</strong><small>{index === 0 ? "Entry point" : `${item.dropoff}% drop-off`}</small></span>
          </li>
        ))}
      </ol>
    </div>
  );
}
