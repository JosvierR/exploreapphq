import { CartesianGrid, Legend, Line, LineChart as RechartsLineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartAxisStyle, chartColors, chartPalette, chartTooltipStyle, formatChartDate, formatChartTick, formatChartValue } from "./chartTheme";

export type TrendSeries = {
  key: string;
  label: string;
  color?: string;
};

export function LineTrendChart({
  data,
  series,
  xKey = "day",
  height = 320,
  ariaLabel = "Usage trend",
}: {
  data: Array<Record<string, unknown>>;
  series: TrendSeries[];
  xKey?: string;
  height?: number;
  ariaLabel?: string;
}) {
  return (
    <div className="admin-chart" style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey={xKey} tick={chartAxisStyle} tickLine={false} axisLine={false} tickFormatter={formatChartDate} minTickGap={28} />
          <YAxis tick={chartAxisStyle} tickLine={false} axisLine={false} tickFormatter={formatChartTick} width={48} />
          <Tooltip
            contentStyle={chartTooltipStyle}
            labelFormatter={(value) => formatChartDate(value)}
            formatter={(value, name) => [formatChartValue(value), String(name)]}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ color: chartColors.muted, fontSize: 12, paddingTop: 12 }} />
          {series.map((item, index) => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label}
              stroke={item.color || chartPalette[index % chartPalette.length]}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, fill: chartColors.surface }}
              isAnimationActive={false}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
