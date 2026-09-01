import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { IdeaCard } from "../components/IdeaCard";
import { LabPageShell } from "../components/LabPageShell";
import { SubmitIdeaModal } from "../components/SubmitIdeaModal";
import { listIdeas, userBoosted } from "../data/labStore";
import { trackLab } from "../lib/analytics";
import { LAB_BUILDING_PATH, LAB_PATH } from "../lib/paths";
import { CATEGORY_LABELS, LAB_TABS } from "../lib/status";
import { useLabStore } from "../lib/useLabStore";
import type { FeedbackCategory, LabTab } from "../types";
import { usePageMeta } from "@/hooks/usePageMeta";

function isLabTab(v: string | null): v is LabTab {
  return LAB_TABS.some((t) => t.id === v);
}

export function LabHomePage() {
  const [params, setParams] = useSearchParams();
  const snap = useLabStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(params.get("q") ?? "");

  usePageMeta({
    title: "Explore Lab · Forum",
    description: "Share ideas and Boost what matters for Explore.",
    path: LAB_PATH,
  });

  const tab: LabTab = isLabTab(params.get("sort")) ? (params.get("sort") as LabTab) : "trending";
  const category = (params.get("category") as FeedbackCategory | "all" | null) ?? "all";
  const q = params.get("q") ?? "";

  useEffect(() => {
    trackLab("explore_lab_view", { source: "lab_forum" });
  }, []);

  useEffect(() => {
    const trimmed = searchDraft.trim();
    if (trimmed === q) return;
    const t = window.setTimeout(() => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (trimmed) next.set("q", trimmed);
          else next.delete("q");
          return next;
        },
        { replace: true },
      );
      if (trimmed) trackLab("feedback_search", { source: "lab_forum" });
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchDraft, q, setParams]);

  const { items } = useMemo(
    () => listIdeas({ tab, category: category === "all" ? "all" : category, query: q, pageSize: 20 }),
    [tab, category, q, snap],
  );

  const setTab = (next: LabTab) => {
    const p = new URLSearchParams(params);
    if (next === "trending") p.delete("sort");
    else p.set("sort", next);
    setParams(p);
    trackLab("feedback_filter_changed", { status: next, source: "lab_forum" });
  };

  return (
    <LabPageShell>
      <header className="lab-intro">
        <p className="lab-intro__label">Explore Lab</p>
        <h1>Forum</h1>
        <p>
          Share ideas and Boost what you care about. When Explore accepts one, it moves to{" "}
          <Link to={LAB_BUILDING_PATH}>Building</Link> — and we build it with the person who
          proposed it.
        </p>
        <div className="lab-actions">
          <button type="button" className="lab-btn lab-btn--primary" onClick={() => setModalOpen(true)}>
            Share an idea
          </button>
          <Link to={LAB_BUILDING_PATH} className="lab-btn lab-btn--ghost">
            See what we&apos;re building
          </Link>
        </div>
      </header>

      <div className="lab-tabs" role="tablist" aria-label="Sort">
        {LAB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className="lab-tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="lab-toolbar">
        <input
          className="lab-input"
          type="search"
          placeholder="Search ideas…"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          aria-label="Search ideas"
        />
        <select
          className="lab-select"
          value={category}
          aria-label="Category"
          onChange={(e) => {
            const p = new URLSearchParams(params);
            const v = e.target.value;
            if (v === "all") p.delete("category");
            else p.set("category", v);
            setParams(p);
          }}
        >
          <option value="all">All categories</option>
          {(Object.keys(CATEGORY_LABELS) as FeedbackCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      {items.length === 0 ? (
        <div className="lab-empty">
          <h3>{q ? "No ideas found." : "No ideas yet."}</h3>
          <p>{q ? "Try another search." : "Be the first to share one."}</p>
          <button type="button" className="lab-btn lab-btn--primary" onClick={() => setModalOpen(true)}>
            Share an idea
          </button>
        </div>
      ) : (
        <div className="lab-feed" aria-live="polite">
          {items.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              boosted={userBoosted(idea.id, snap.session?.userId ?? "demo-user")}
              showAuthor
            />
          ))}
        </div>
      )}

      <SubmitIdeaModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </LabPageShell>
  );
}
