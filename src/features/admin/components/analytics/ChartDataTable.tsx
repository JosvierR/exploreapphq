import { useState } from "react";
import { formatNumber } from "@/lib/analyticsDisplay";

export type ChartDataColumn = {
  key: string;
  label: string;
  format?: "date" | "number" | "text";
};

export function ChartDataTable({
  caption,
  rows,
  columns,
}: {
  caption: string;
  rows: Array<Record<string, unknown>>;
  columns: ChartDataColumn[];
}) {
  const [hasOpened, setHasOpened] = useState(false);
  return (
    <details className="admin-chart-data-table" onToggle={(event) => {
      if (event.currentTarget.open) setHasOpened(true);
    }}>
      <summary>View accessible data table</summary>
      {hasOpened ? <div className="admin-table-wrap">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${String(row[columns[0]?.key] ?? "row")}-${index}`}>
                {columns.map((column) => (
                  <td key={column.key}>{formatCell(row[column.key], column.format)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div> : null}
    </details>
  );
}

function formatCell(value: unknown, format: ChartDataColumn["format"]) {
  if (format === "number") return formatNumber(value);
  if (format === "date") {
    const raw = String(value ?? "");
    const date = new Date(`${raw}T00:00:00`);
    if (!raw || Number.isNaN(date.getTime())) return raw || "—";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
  }
  return value == null || value === "" ? "—" : String(value);
}
