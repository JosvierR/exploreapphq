import { useEffect } from "react";
import { Link } from "react-router-dom";
import { IdeaCard } from "../components/IdeaCard";
import { LabPageShell } from "../components/LabPageShell";
import { ensureLabSession, myIdeas, userBoosted } from "../labStore";
import { LAB_MINE_PATH, LAB_PATH } from "../lib/paths";
import { useLabStore } from "../lib/useLabStore";
import { useI18n } from "@/features/i18n/I18nProvider";
import { usePageMeta } from "@/hooks/usePageMeta";

export function LabMinePage() {
  const { t } = useI18n();
  const snap = useLabStore();

  useEffect(() => {
    ensureLabSession();
  }, []);

  const created = myIdeas();

  usePageMeta({
    title: t("lab.mine.metaTitle"),
    description: t("lab.mine.metaDescription"),
    path: LAB_MINE_PATH,
  });

  void snap;

  return (
    <LabPageShell>
      <header className="lab-intro">
        <p className="lab-intro__label">{t("lab.label")}</p>
        <h1>{t("lab.mine.title")}</h1>
        <p>{t("lab.mine.lead")}</p>
      </header>

      <section className="lab-mine-section">
        <h2>{t("lab.mine.shared")}</h2>
        <p>{t("lab.mine.sharedHelp")}</p>
        {created.length === 0 ? (
          <div className="lab-empty">
            <h3>{t("lab.mine.emptyTitle")}</h3>
            <p>{t("lab.mine.emptyBody")}</p>
            <Link to={LAB_PATH} className="lab-btn lab-btn--primary">
              {t("lab.mine.cta")}
            </Link>
          </div>
        ) : (
          <div className="lab-feed">
            {created.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                boosted={userBoosted(idea.id, snap.session?.userId)}
                source="lab_mine"
                showAuthor
              />
            ))}
          </div>
        )}
      </section>
    </LabPageShell>
  );
}
