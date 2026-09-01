import { PROGRESS_STEPS, STATUS_LABELS } from "../lib/status";
import type { FeedbackStatus } from "../types";

export function StatusTimeline({ status }: { status: FeedbackStatus }) {
  if (status === "not_now") {
    return (
      <section className="lab-section">
        <h2>Progress</h2>
        <p className="lab-hint">{STATUS_LABELS.not_now}</p>
      </section>
    );
  }

  const visualIdx =
    status === "considering" ? 0 : Math.max(0, PROGRESS_STEPS.indexOf(status as (typeof PROGRESS_STEPS)[number]));

  return (
    <section className="lab-section">
      <h2>Progress</h2>
      <ol className="lab-timeline" aria-label="Idea progress">
        {PROGRESS_STEPS.map((step, idx) => {
          const done = idx < visualIdx;
          const active = idx === visualIdx;
          return (
            <li key={step} className={done ? "is-done" : active ? "is-active" : undefined}>
              <span className="lab-dot" aria-hidden="true" />
              <span>
                {STATUS_LABELS[step]}
                {active ? <span className="sr-only"> (current)</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      {status === "considering" ? (
        <p className="lab-hint" style={{ marginTop: "0.5rem" }}>
          Currently {STATUS_LABELS.considering}.
        </p>
      ) : null}
    </section>
  );
}
