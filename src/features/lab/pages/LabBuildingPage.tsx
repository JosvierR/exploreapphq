import { useEffect } from "react";
import { Link } from "react-router-dom";
import { LabPageShell } from "../components/LabPageShell";
import { buildingBoardIdeas } from "../labStore";
import { trackLab } from "../lib/analytics";
import { LAB_BUILDING_PATH, LAB_PATH, labIdeaPath } from "../lib/paths";
import { STATUS_LABELS, STATUS_LABELS_ES } from "../lib/status";
import { useLabStore } from "../lib/useLabStore";
import { useI18n } from "@/features/i18n/I18nProvider";
import { usePageMeta } from "@/hooks/usePageMeta";
import type { FeedbackIdea } from "../types";

function BuildingCard({ idea, byLabel }: { idea: FeedbackIdea; byLabel: string }) {
  return (
    <Link to={labIdeaPath(idea.slug)} className="lab-roadmap-card">
      <strong>{idea.title}</strong>
      <span>
        {byLabel} {idea.authorName || idea.email}
      </span>
    </Link>
  );
}

export function LabBuildingPage() {
  const { t, locale } = useI18n();
  const snap = useLabStore();
  const columns = buildingBoardIdeas();
  const statusLabels = locale === "es" ? STATUS_LABELS_ES : STATUS_LABELS;

  const COLUMNS: { key: keyof typeof columns; label: string }[] = [
    { key: "considering", label: statusLabels.considering },
    { key: "planned", label: statusLabels.planned },
    { key: "building", label: statusLabels.building },
    { key: "shipped", label: statusLabels.shipped },
  ];

  usePageMeta({
    title: t("lab.building.metaTitle"),
    description: t("lab.building.metaDescription"),
    path: LAB_BUILDING_PATH,
  });

  useEffect(() => {
    trackLab("feedback_roadmap_view", { source: "building" });
  }, []);

  void snap;

  const total =
    columns.considering.length +
    columns.planned.length +
    columns.building.length +
    columns.shipped.length;

  return (
    <LabPageShell wide>
      <header className="lab-intro">
        <p className="lab-intro__label">{t("lab.label")}</p>
        <h1>{t("lab.building.title")}</h1>
        <p>
          {t("lab.building.lead")}{" "}
          <Link to={LAB_PATH}>{t("lab.building.cta.forum")}</Link>.
        </p>
      </header>

      {total === 0 ? (
        <div className="lab-empty">
          <h3>{t("lab.building.emptyTitle")}</h3>
          <p>{t("lab.building.emptyBody")}</p>
          <Link to={LAB_PATH} className="lab-btn lab-btn--primary">
            {t("lab.building.cta.forum")}
          </Link>
        </div>
      ) : (
        <div className="lab-roadmap" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          {COLUMNS.map(({ key, label }) => {
            const ideas = columns[key];
            return (
              <section key={key} className="lab-roadmap-col" aria-labelledby={`building-${key}`}>
                <h2 id={`building-${key}`}>{label}</h2>
                {ideas.length === 0 ? (
                  <p className="lab-hint">{t("lab.building.columnEmpty")}</p>
                ) : (
                  ideas.map((idea) => (
                    <BuildingCard key={idea.id} idea={idea} byLabel={t("lab.building.by")} />
                  ))
                )}
              </section>
            );
          })}
        </div>
      )}
    </LabPageShell>
  );
}

export const LabRoadmapPage = LabBuildingPage;
