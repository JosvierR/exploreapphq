import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toggleBoost } from "../data/labStore";
import { trackLab } from "../lib/analytics";
import { labIdeaPath } from "../lib/paths";
import { CATEGORY_LABELS, STATUS_LABELS } from "../lib/status";
import type { FeedbackIdea } from "../types";

type Props = {
  idea: FeedbackIdea;
  boosted: boolean;
  source?: string;
  /** Show author + accepted badge (building board). */
  showAuthor?: boolean;
};

export function IdeaCard({ idea, boosted, source = "lab_home", showAuthor = false }: Props) {
  const [localBoosted, setLocalBoosted] = useState(boosted);
  const [count, setCount] = useState(idea.boostCount);
  const [pulse, setPulse] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalBoosted(boosted);
    setCount(idea.boostCount);
  }, [boosted, idea.boostCount, idea.id]);

  const onBoost = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const prevBoosted = localBoosted;
    const prevCount = count;
    setLocalBoosted(!prevBoosted);
    setCount(prevBoosted ? Math.max(0, prevCount - 1) : prevCount + 1);
    setPulse(true);
    setError(null);
    window.setTimeout(() => setPulse(false), 280);

    const result = toggleBoost(idea.id);
    if (!result.ok) {
      setLocalBoosted(prevBoosted);
      setCount(prevCount);
      setError("Couldn't Boost this idea. Try again.");
      return;
    }
    setLocalBoosted(result.boosted);
    setCount(result.boostCount);
    trackLab(result.boosted ? "feedback_idea_boosted" : "feedback_idea_unboosted", {
      idea_id: idea.id,
      category: idea.category,
      status: idea.status,
      source,
    });
  };

  return (
    <article>
      <Link to={labIdeaPath(idea.slug)} className="lab-card">
        <div className="lab-card__meta">
          <span>{STATUS_LABELS[idea.status]}</span>
          <span>{CATEGORY_LABELS[idea.category]}</span>
          {idea.isFeatured ? <span>Accepted</span> : null}
          {showAuthor ? <span>by {idea.authorName}</span> : null}
        </div>
        <h3>{idea.title}</h3>
        <p>{idea.description}</p>
        <div className="lab-card__footer">
          <button
            type="button"
            className={`lab-boost${pulse ? " is-pulse" : ""}`}
            aria-pressed={localBoosted}
            aria-label={localBoosted ? `Boosted, ${count}. Remove Boost` : `Boost, ${count}`}
            onClick={onBoost}
          >
            <span aria-hidden="true">{localBoosted ? "✓" : "↑"}</span>
            <span>{count}</span>
          </button>
          {idea.teamResponse ? <span className="lab-hint">Explore replied</span> : null}
        </div>
      </Link>
      {error ? (
        <p className="lab-error" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}
