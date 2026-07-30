import { Line, LineChart, ResponsiveContainer } from "recharts";
import { chartColors } from "./chartTheme";

export function Sparkline({
  data,
  dataKey,
  tone = "neutral",
}: {
  data: Array<Record<string, unknown>>;
  dataKey: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  if (data.length < 2) return null;
  const color = tone === "positive" ? chartColors.positive : tone === "negative" ? chartColors.negative : chartColors.primary;

  return (
    <div className="admin-sparkline" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 3, right: 2, bottom: 3, left: 2 }}>
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
