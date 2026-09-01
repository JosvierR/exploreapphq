import { useEffect } from "react";
import { Link } from "react-router-dom";
import { LabPageShell } from "../components/LabPageShell";
import { buildingBoardIdeas } from "../data/labStore";
import { trackLab } from "../lib/analytics";
import { LAB_BUILDING_PATH, LAB_PATH, labIdeaPath } from "../lib/paths";
import { STATUS_LABELS } from "../lib/status";
import { useLabStore } from "../lib/useLabStore";
import { usePageMeta } from "@/hooks/usePageMeta";
import type { FeedbackIdea, FeedbackStatus } from "../types";

function BuildingCard({ idea }: { idea: FeedbackIdea }) {
  return (
    <Link to={labIdeaPath(idea.slug)} className="lab-roadmap-card">
      <strong>{idea.title}</strong>
      <span>
        by {idea.authorName} · ↑ {idea.boostCount}
      </span>
    </Link>
  );
}

const COLUMNS: { key: FeedbackStatus; label: string }[] = [
  { key: "planned", label: STATUS_LABELS.planned },
  { key: "building", label: STATUS_LABELS.building },
  { key: "shipped", label: STATUS_LABELS.shipped },
];

export function LabBuildingPage() {
  const snap = useLabStore();
  const columns = buildingBoardIdeas();

  usePageMeta({
    title: "Building · Explore Lab",
    description: "Ideas Explore accepted and is building with the community.",
    path: LAB_BUILDING_PATH,
  });

  useEffect(() => {
    trackLab("feedback_roadmap_view", { source: "building" });
  }, []);

  void snap;

  return (
    <LabPageShell wide>
      <header className="lab-intro">
        <p className="lab-intro__label">Explore Lab</p>
        <h1>Building</h1>
        <p>
          Ideas Explore accepted. Each one shows who proposed it — and that person can work with us
          while it ships. Suggest more in the{" "}
          <Link to={LAB_PATH}>Forum</Link>.
        </p>
      </header>

      <div className="lab-roadmap">
        {COLUMNS.map(({ key, label }) => {
          const ideas = columns[key as "planned" | "building" | "shipped"];
          return (
            <section key={key} className="lab-roadmap-col" aria-labelledby={`building-${key}`}>
              <h2 id={`building-${key}`}>{label}</h2>
              {ideas.length === 0 ? (
                <p className="lab-hint">Nothing here yet.</p>
              ) : (
                ideas.map((idea) => <BuildingCard key={idea.id} idea={idea} />)
              )}
            </section>
          );
        })}
      </div>
    </LabPageShell>
  );
}

/** Keep old export name for any leftover imports. */
export const LabRoadmapPage = LabBuildingPage;
