import { useEffect } from "react";
import { Link } from "react-router-dom";
import { IdeaCard } from "../components/IdeaCard";
import { LabPageShell } from "../components/LabPageShell";
import { ensureLabSession, myBoostedIdeas, myIdeas, userBoosted } from "../labStore";
import { LAB_MINE_PATH, LAB_PATH } from "../lib/paths";
import { useLabStore } from "../lib/useLabStore";
import { usePageMeta } from "@/hooks/usePageMeta";

export function LabMinePage() {
  const snap = useLabStore();

  useEffect(() => {
    ensureLabSession();
  }, []);

  const created = myIdeas();
  const boosted = myBoostedIdeas();

  usePageMeta({
    title: "My ideas · Explore Lab",
    description: "Ideas you shared and Boosted.",
    path: LAB_MINE_PATH,
  });

  void snap;

  return (
    <LabPageShell>
      <header className="lab-intro">
        <p className="lab-intro__label">Explore Lab</p>
        <h1>My ideas</h1>
        <p>Ideas you shared and Boosted.</p>
      </header>

      <section className="lab-mine-section">
        <h2>Shared</h2>
        <p>When Explore accepts one, it appears under Building and you can help ship it.</p>
        {created.length === 0 ? (
          <div className="lab-empty">
            <h3>No ideas yet</h3>
            <p>Share something in the Forum.</p>
            <Link to={LAB_PATH} className="lab-btn lab-btn--primary">
              Go to Forum
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

      <section className="lab-mine-section">
        <h2>Boosted</h2>
        {boosted.length === 0 ? (
          <div className="lab-empty">
            <h3>No Boosts yet</h3>
            <p>Support ideas in the Forum.</p>
          </div>
        ) : (
          <div className="lab-feed">
            {boosted.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} boosted source="lab_mine" showAuthor />
            ))}
          </div>
        )}
      </section>
    </LabPageShell>
  );
}
