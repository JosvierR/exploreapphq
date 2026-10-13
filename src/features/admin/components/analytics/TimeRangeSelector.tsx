import type { ChangeEvent } from "react";

export type ExecutiveRange = "24h" | "7d" | "30d" | "90d" | "custom";

const RANGE_OPTIONS: Array<{ value: ExecutiveRange; label: string }> = [
  { value: "24h", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "custom", label: "Custom" },
];

export function TimeRangeSelector({
  range,
  customStart,
  customEnd,
  compare,
  timezone,
  lastUpdated,
  loading,
  onRangeChange,
  onCustomStartChange,
  onCustomEndChange,
  onCompareChange,
  onRefresh,
}: {
  range: ExecutiveRange;
  customStart: string;
  customEnd: string;
  compare: boolean;
  timezone: string;
  lastUpdated: string | null;
  loading: boolean;
  onRangeChange: (range: ExecutiveRange) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
  onCompareChange: (enabled: boolean) => void;
  onRefresh: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const handleCompare = (event: ChangeEvent<HTMLInputElement>) => onCompareChange(event.target.checked);

  return (
    <section className="admin-reporting-controls" aria-label="Reporting controls">
      <div className="admin-reporting-controls__period">
        <span className="admin-reporting-controls__label">Reporting period</span>
        <div className="admin-segmented admin-reporting-controls__segments" aria-label="Reporting period">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={range === option.value ? "is-active" : undefined}
              aria-pressed={range === option.value}
              onClick={() => onRangeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {range === "custom" ? (
        <div className="admin-reporting-controls__dates">
          <label>
            <span>From</span>
            <input
              type="date"
              value={customStart}
              max={customEnd || today}
              onChange={(event) => onCustomStartChange(event.target.value)}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              max={today}
              onChange={(event) => onCustomEndChange(event.target.value)}
            />
          </label>
        </div>
      ) : null}

      <div className="admin-reporting-controls__meta">
        <label className="admin-reporting-controls__compare">
          <input type="checkbox" checked={compare} onChange={handleCompare} />
          <span>Compare previous period</span>
        </label>
        <span className="admin-reporting-controls__timezone" title="Analytics windows use UTC boundaries">
          UTC · Viewing in {timezone}
        </span>
        <span className="admin-reporting-controls__updated" aria-live="polite">
          {lastUpdated ? `Data through ${formatTimestamp(lastUpdated)}` : "Refresh time unavailable"}
        </span>
        <button
          type="button"
          className="admin-btn admin-btn--secondary admin-btn--sm"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </section>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
