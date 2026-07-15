import { useId } from "react";
import { Area, AreaChart as RechartsAreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendSeries } from "./LineTrendChart";
import { chartAxisStyle, chartColors, chartPalette, chartTooltipStyle, formatChartDate, formatChartTick, formatChartValue } from "./chartTheme";

export function AreaTrendChart({
  data,
  series,
  xKey = "day",
  height = 340,
  ariaLabel = "Usage over the selected period",
}: {
  data: Array<Record<string, unknown>>;
  series: TrendSeries[];
  xKey?: string;
  height?: number;
  ariaLabel?: string;
}) {
  const id = useId().replace(/:/g, "");

  return (
    <div className="admin-chart" style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart data={data} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
          <defs>
            {series.map((item, index) => {
              const color = item.color || chartPalette[index % chartPalette.length];
              return (
                <linearGradient key={item.key} id={`${id}-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey={xKey} tick={chartAxisStyle} tickLine={false} axisLine={false} tickFormatter={formatChartDate} minTickGap={28} />
          <YAxis tick={chartAxisStyle} tickLine={false} axisLine={false} tickFormatter={formatChartTick} width={48} />
          <Tooltip
            contentStyle={chartTooltipStyle}
            labelFormatter={(value) => formatChartDate(value)}
            formatter={(value, name) => [formatChartValue(value), String(name)]}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ color: chartColors.muted, fontSize: 12, paddingTop: 12 }} />
          {series.map((item, index) => {
            const color = item.color || chartPalette[index % chartPalette.length];
            return (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#${id}-${item.key})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, fill: chartColors.surface }}
                isAnimationActive={false}
              />
            );
          })}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
