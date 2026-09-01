import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BuildTogether } from "../components/BuildTogether";
import { Discussion } from "../components/Discussion";
import { LabPageShell } from "../components/LabPageShell";
import { StatusTimeline } from "../components/StatusTimeline";
import {
  canViewIdea,
  ensureLabSession,
  getIdeaBySlugOrId,
  toggleBoost,
  userBoosted,
} from "../labStore";
import { trackLab } from "../lib/analytics";
import { LAB_BUILDING_PATH, LAB_PATH, labIdeaPath } from "../lib/paths";
import { CATEGORY_LABELS, STATUS_LABELS } from "../lib/status";
import { useLabStore } from "../lib/useLabStore";
import { usePageMeta } from "@/hooks/usePageMeta";

export function LabIdeaPage() {
  const { ideaId = "" } = useParams();
  const snap = useLabStore();
  const idea = getIdeaBySlugOrId(ideaId);
  const [pulse, setPulse] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureLabSession();
  }, []);

  usePageMeta({
    title: idea ? `${idea.title} · Explore Lab` : "Idea · Explore Lab",
    description: idea?.description?.slice(0, 160) || "Community idea on Explore Lab",
    path: idea ? labIdeaPath(idea.slug) : LAB_PATH,
  });

  useEffect(() => {
    if (!idea) return;
    trackLab("feedback_idea_view", {
      idea_id: idea.id,
      category: idea.category,
      status: idea.status,
      source: "idea_detail",
    });
    if (idea.teamResponse) {
      trackLab("feedback_team_response_view", { idea_id: idea.id, source: "idea_detail" });
    }
  }, [idea?.id]);

  const sessionId = snap.session?.userId ?? null;

  if (!idea || !canViewIdea(idea, sessionId)) {
    return (
      <LabPageShell showNav={false}>
        <div className="lab-empty">
          <h3>Idea not found</h3>
          <p>It may have been removed.</p>
          <Link to={LAB_PATH} className="lab-btn lab-btn--primary">
            Back to Forum
          </Link>
        </div>
      </LabPageShell>
    );
  }

  const boosted = userBoosted(idea.id, sessionId ?? "demo-user");
  const canonical = idea.duplicateOf ? getIdeaBySlugOrId(idea.duplicateOf) : null;
  const helpedShip = idea.status === "shipped" && boosted;
  const isAuthor = sessionId === idea.userId;

  const onBoost = () => {
    setPulse(true);
    window.setTimeout(() => setPulse(false), 280);
    const result = toggleBoost(idea.id);
    if (!result.ok) {
      setError(result.error || "Couldn't Boost this idea. Try again.");
      return;
    }
    setError(null);
    trackLab(result.boosted ? "feedback_idea_boosted" : "feedback_idea_unboosted", {
      idea_id: idea.id,
      category: idea.category,
      status: idea.status,
      source: "idea_detail",
    });
  };

  return (
    <LabPageShell showNav={false}>
      <nav className="lab-crumb" aria-label="Breadcrumb">
        <Link to={LAB_PATH}>Forum</Link>
        {idea.isFeatured ? (
          <>
            <span aria-hidden="true">/</span>
            <Link to={LAB_BUILDING_PATH}>Building</Link>
          </>
        ) : null}
        <span aria-hidden="true">/</span>
        <span>{idea.title}</span>
      </nav>

      <div className="lab-card__meta">
        <span>{STATUS_LABELS[idea.status]}</span>
        <span>{CATEGORY_LABELS[idea.category]}</span>
        {idea.isFeatured ? <span>Accepted</span> : null}
      </div>

      <h1 className="lab-detail-title">{idea.title}</h1>
      <p className="lab-detail-desc">{idea.description}</p>
      <p className="lab-author">Proposed by {idea.authorName}</p>

      {idea.isFeatured ? (
        <p className="lab-note" role="status">
          Explore accepted this idea
          {isAuthor ? " — you can talk with the team below and help build it." : "."} Follow progress
          on <Link to={LAB_BUILDING_PATH}>Building</Link>.
        </p>
      ) : null}

      {canonical ? (
        <div className="lab-dup">
          <p style={{ margin: "0 0 0.35rem" }}>This idea is similar to another suggestion.</p>
          <Link to={labIdeaPath(canonical.slug)}>View the main idea →</Link>
        </div>
      ) : null}

      {helpedShip ? (
        <div className="lab-impact" role="status">
          <strong>You helped make this happen.</strong>
          <p>You Boosted this before it shipped. Thanks for shaping Explore.</p>
        </div>
      ) : null}

      {!canonical ? (
        <button
          type="button"
          className={`lab-boost${pulse ? " is-pulse" : ""}`}
          aria-pressed={boosted}
          aria-label={boosted ? `Boosted, ${idea.boostCount}. Remove Boost` : `Boost, ${idea.boostCount}`}
          onClick={onBoost}
        >
          <span aria-hidden="true">{boosted ? "✓" : "↑"}</span>
          <span>{idea.boostCount}</span>
        </button>
      ) : null}
      {error ? (
        <p className="lab-error" role="alert" style={{ marginTop: "0.5rem" }}>
          {error}
        </p>
      ) : null}

      {idea.teamResponse ? (
        <section className="lab-team" aria-label="Explore team response">
          <div className="lab-team__head">Explore Team</div>
          <p>{idea.teamResponse}</p>
        </section>
      ) : null}

      {idea.isFeatured ? <StatusTimeline status={idea.status} /> : null}
      {idea.isFeatured ? <BuildTogether idea={idea} /> : null}
      <Discussion ideaId={idea.id} />
    </LabPageShell>
  );
}
