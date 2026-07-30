import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartAxisStyle, chartColors, chartTooltipStyle, formatChartTick, formatChartValue } from "./chartTheme";

export type HorizontalBarDatum = {
  label: string;
  value: number;
};

export function HorizontalBarChart({
  data,
  valueLabel,
  color = chartColors.primary,
  height = 250,
  ariaLabel,
}: {
  data: HorizontalBarDatum[];
  valueLabel: string;
  color?: string;
  height?: number;
  ariaLabel: string;
}) {
  return (
    <div className="admin-chart" style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 5" horizontal={false} />
          <XAxis type="number" tick={chartAxisStyle} tickLine={false} axisLine={false} tickFormatter={formatChartTick} />
          <YAxis type="category" dataKey="label" tick={chartAxisStyle} tickLine={false} axisLine={false} width={92} />
          <Tooltip
            cursor={{ fill: "rgba(11, 127, 232, 0.05)" }}
            contentStyle={chartTooltipStyle}
            formatter={(value) => [formatChartValue(value), valueLabel]}
          />
          <Bar dataKey="value" name={valueLabel} fill={color} radius={[0, 5, 5, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
