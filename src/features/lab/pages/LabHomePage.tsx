import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LabPageShell } from "../components/LabPageShell";
import { createIdea } from "../labStore";
import { trackLab } from "../lib/analytics";
import { LAB_BUILDING_PATH, LAB_PATH } from "../lib/paths";
import { CATEGORY_LABELS, CATEGORY_LABELS_ES } from "../lib/status";
import type { FeedbackCategory } from "../types";
import { useI18n } from "@/features/i18n/I18nProvider";
import { usePageMeta } from "@/hooks/usePageMeta";
import { submitFeedback } from "@/lib/feedbackSubmit";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as FeedbackCategory[];

export function LabHomePage() {
  const { t, locale } = useI18n();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("other");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  usePageMeta({
    title: t("lab.meta.title"),
    description: t("lab.meta.description"),
    path: LAB_PATH,
  });

  useEffect(() => {
    trackLab("explore_lab_view", { source: "lab_forum" });
  }, []);

  const categoryLabels = locale === "es" ? CATEGORY_LABELS_ES : CATEGORY_LABELS;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const local = createIdea({ title, description, category, email });
      if (!local.ok) {
        setError(local.error);
        return;
      }

      await submitFeedback({
        message: `${title.trim()}\n\n${description.trim()}`,
        email: email.trim(),
        category: "idea",
        name: email.trim().split("@")[0],
        source: "lab",
      }).catch((err) => {
        console.warn("[lab] feedback API notify failed", err);
      });

      trackLab("feedback_idea_created", {
        idea_id: local.idea.id,
        category: local.idea.category,
        status: local.idea.status,
        source: "lab_forum",
      });

      setSuccess(true);
      setTitle("");
      setDescription("");
      setEmail("");
      setCategory("other");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("lab.form.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <LabPageShell>
      <header className="lab-intro">
        <p className="lab-intro__label">{t("lab.label")}</p>
        <h1>{t("lab.home.title")}</h1>
        <p>{t("lab.home.lead")}</p>
        <div className="lab-actions">
          <Link to={LAB_BUILDING_PATH} className="lab-btn lab-btn--ghost">
            {t("lab.home.cta.building")}
          </Link>
        </div>
      </header>

      <div className="lab-empty" style={{ marginBottom: "1.25rem" }}>
        <h3>{t("lab.empty.title")}</h3>
        <p>{t("lab.empty.body")}</p>
      </div>

      {success ? (
        <div className="lab-note" role="status">
          <strong style={{ display: "block", marginBottom: "0.35rem", color: "#fff" }}>
            {t("lab.form.successTitle")}
          </strong>
          {t("lab.form.successBody")}
          <div className="lab-actions" style={{ marginTop: "0.85rem" }}>
            <button type="button" className="lab-btn lab-btn--primary lab-btn--sm" onClick={() => setSuccess(false)}>
              {t("lab.form.another")}
            </button>
          </div>
        </div>
      ) : (
        <form className="lab-form" onSubmit={(e) => void handleSubmit(e)} style={{ maxWidth: 520 }}>
          <div className="lab-field">
            <label htmlFor="lab-email">{t("lab.form.email")}</label>
            <input
              id="lab-email"
              className="lab-input"
              type="email"
              required
              autoComplete="email"
              placeholder={t("lab.form.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="lab-field">
            <label htmlFor="lab-title">{t("lab.form.title")}</label>
            <input
              id="lab-title"
              className="lab-input"
              required
              maxLength={80}
              placeholder={t("lab.form.titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="lab-field__hint">{title.length}/80</div>
          </div>

          <div className="lab-field">
            <label htmlFor="lab-category">{t("lab.form.category")}</label>
            <select
              id="lab-category"
              className="lab-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabels[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="lab-field">
            <label htmlFor="lab-desc">{t("lab.form.description")}</label>
            <textarea
              id="lab-desc"
              required
              rows={5}
              maxLength={500}
              placeholder={t("lab.form.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="lab-field__hint">{description.length}/500</div>
          </div>

          {error ? (
            <p className="lab-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="lab-btn lab-btn--primary" disabled={loading}>
            {loading ? t("lab.form.sending") : t("lab.form.submit")}
          </button>
        </form>
      )}
    </LabPageShell>
  );
}
