import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { createIdea, findSimilarIdeas, toggleBoost } from "../data/labStore";
import { trackLab } from "../lib/analytics";
import { labIdeaPath } from "../lib/paths";
import { CATEGORY_LABELS } from "../lib/status";
import type { FeedbackCategory, FeedbackIdea } from "../types";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as FeedbackCategory[];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SubmitIdeaModal({ open, onClose }: Props) {
  const titleId = useId();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("routes");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [similarQuery, setSimilarQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setSimilarQuery(title), 280);
    return () => window.clearTimeout(t);
  }, [title, open]);

  const similar = useMemo(() => findSimilarIdeas(similarQuery), [similarQuery]);

  if (!open) return null;

  const boostInstead = (idea: FeedbackIdea) => {
    toggleBoost(idea.id);
    onClose();
    navigate(labIdeaPath(idea.slug));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = createIdea({ title, description, category });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    trackLab("feedback_idea_created", {
      idea_id: result.idea.id,
      category: result.idea.category,
      status: result.idea.status,
      source: "submit_modal",
    });
    onClose();
    setTitle("");
    setDescription("");
    navigate(labIdeaPath(result.idea.slug));
  };

  return createPortal(
    <div className="lab-modal-root" role="presentation">
      <button type="button" className="lab-modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="lab-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>Share an idea</h2>
        <p className="lab-modal__lead">
          Ideas go to the Forum. If Explore accepts yours, it moves to Building and you can help ship
          it with us.
        </p>
        <form className="lab-form" onSubmit={submit}>
          <div className="lab-field">
            <label htmlFor="lab-idea-title">What should Explore do better?</label>
            <input
              id="lab-idea-title"
              value={title}
              maxLength={80}
              placeholder="Let friends build a route together"
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <div className="lab-field__hint">{title.length}/80</div>
          </div>

          {similar.length > 0 ? (
            <div className="lab-similar" aria-live="polite">
              <h3>Similar ideas</h3>
              {similar.map((idea) => (
                <div key={idea.id} className="lab-similar-item">
                  <div>
                    <strong>{idea.title}</strong>
                    <span>{idea.boostCount} Boosts</span>
                  </div>
                  <button
                    type="button"
                    className="lab-btn lab-btn--ghost lab-btn--sm"
                    onClick={() => boostInstead(idea)}
                  >
                    Boost this instead
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="lab-field">
            <label htmlFor="lab-idea-category">Category</label>
            <select
              id="lab-idea-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="lab-field">
            <label htmlFor="lab-idea-why">Why would this help?</label>
            <textarea
              id="lab-idea-why"
              rows={4}
              maxLength={500}
              placeholder="When you'd use this, or what problem it solves."
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

          <div className="lab-actions">
            <button type="submit" className="lab-btn lab-btn--primary" disabled={submitting}>
              {submitting ? "Sharing…" : "Share idea"}
            </button>
            <button type="button" className="lab-btn lab-btn--ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
