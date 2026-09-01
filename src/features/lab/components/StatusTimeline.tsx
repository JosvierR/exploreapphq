import { PROGRESS_STEPS, STATUS_LABELS, STATUS_LABELS_ES } from "../lib/status";
import type { FeedbackStatus } from "../types";
import { useI18n } from "@/features/i18n/I18nProvider";

export function StatusTimeline({ status }: { status: FeedbackStatus }) {
  const { t, locale } = useI18n();
  const labels = locale === "es" ? STATUS_LABELS_ES : STATUS_LABELS;

  if (status === "not_now") {
    return (
      <section className="lab-section">
        <h2>{t("lab.progress.title")}</h2>
        <p className="lab-hint">{labels.not_now}</p>
      </section>
    );
  }

  const visualIdx = Math.max(0, PROGRESS_STEPS.indexOf(status as (typeof PROGRESS_STEPS)[number]));

  return (
    <section className="lab-section">
      <h2>{t("lab.progress.title")}</h2>
      <ol className="lab-timeline" aria-label={t("lab.progress.title")}>
        {PROGRESS_STEPS.map((step, idx) => {
          const done = idx < visualIdx;
          const active = idx === visualIdx;
          return (
            <li key={step} className={done ? "is-done" : active ? "is-active" : undefined}>
              <span className="lab-dot" aria-hidden="true" />
              <span>
                {labels[step]}
                {active ? <span className="sr-only"> (current)</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
