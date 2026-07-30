import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatNumber } from "@/lib/analyticsDisplay";
import { chartPalette, chartTooltipStyle, formatChartValue } from "./chartTheme";

export type DonutDatum = {
  label: string;
  value: number;
};

export function DonutBreakdownChart({
  data,
  valueLabel,
  ariaLabel,
}: {
  data: DonutDatum[];
  valueLabel: string;
  ariaLabel: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="admin-donut" role="img" aria-label={ariaLabel}>
      <div className="admin-donut__plot">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((item, index) => <Cell key={item.label} fill={chartPalette[index % chartPalette.length]} />)}
            </Pie>
            <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [formatChartValue(value), valueLabel]} />
          </PieChart>
        </ResponsiveContainer>
        <span className="admin-donut__total"><strong>{formatNumber(total)}</strong><small>{valueLabel}</small></span>
      </div>
      <ul className="admin-donut__legend">
        {data.map((item, index) => (
          <li key={item.label}>
            <i style={{ backgroundColor: chartPalette[index % chartPalette.length] }} />
            <span>{item.label}</span>
            <strong>{total > 0 ? `${Math.round((item.value / total) * 100)}%` : "0%"}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
