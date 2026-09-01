import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BuildTogether } from "@/features/lab/components/BuildTogether";
import { adminListIdeas, adminUpdateIdea } from "@/features/lab/data/labStore";
import { labIdeaPath } from "@/features/lab/lib/paths";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/features/lab/lib/status";
import { useLabStore } from "@/features/lab/lib/useLabStore";
import type { FeedbackStatus } from "@/features/lab/types";

const STATUS_FILTERS: Array<FeedbackStatus | "all"> = [
  "all",
  "listening",
  "considering",
  "planned",
  "building",
  "shipped",
  "not_now",
];

export function AdminExploreLabPage() {
  const snap = useLabStore();
  const [status, setStatus] = useState<FeedbackStatus | "all">("all");
  const [featured, setFeatured] = useState<"all" | "starred" | "inbox">("inbox");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [responseDraft, setResponseDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const ideas = useMemo(
    () => adminListIdeas({ status, query, featured }),
    [status, query, featured, snap],
  );
  const selected = ideas.find((i) => i.id === selectedId) ?? ideas[0] ?? null;

  return (
    <div className="admin-page">
      <header className="admin-page-header" style={{ marginBottom: "1.25rem" }}>
        <div>
          <p className="admin-eyebrow">Community</p>
          <h1>Explore Lab</h1>
          <p style={{ opacity: 0.65, marginTop: "0.35rem" }}>
            Accept ideas for Building. Update status. Talk with the proposer while you ship.
          </p>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(280px, 0.9fr)",
          gap: "1rem",
        }}
      >
        <section className="admin-card" style={{ padding: "1rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.85rem" }}>
            <input
              type="search"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: "1 1 160px", minWidth: 0 }}
            />
            <select value={featured} onChange={(e) => setFeatured(e.target.value as typeof featured)}>
              <option value="inbox">Forum (not accepted)</option>
              <option value="starred">Accepted / Building</option>
              <option value="all">All</option>
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as FeedbackStatus | "all")}
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f} value={f}>
                  {f === "all" ? "All statuses" : STATUS_LABELS[f]}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gap: "0.4rem" }}>
            {ideas.map((idea) => (
              <button
                key={idea.id}
                type="button"
                onClick={() => {
                  setSelectedId(idea.id);
                  setResponseDraft(idea.teamResponse ?? "");
                  setMessage(null);
                }}
                style={{
                  textAlign: "left",
                  padding: "0.7rem 0.8rem",
                  borderRadius: 10,
                  border:
                    selected?.id === idea.id
                      ? "1px solid rgba(0,155,255,0.5)"
                      : "1px solid rgba(255,255,255,0.08)",
                  background: selected?.id === idea.id ? "rgba(0,155,255,0.08)" : "transparent",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                  <strong style={{ fontWeight: 600 }}>
                    {idea.isFeatured ? "★ " : ""}
                    {idea.title}
                  </strong>
                  <span style={{ opacity: 0.6, fontSize: "0.85rem" }}>↑ {idea.boostCount}</span>
                </div>
                <div style={{ marginTop: 4, fontSize: "0.8rem", opacity: 0.6 }}>
                  {CATEGORY_LABELS[idea.category]} · {STATUS_LABELS[idea.status]}
                </div>
              </button>
            ))}
            {ideas.length === 0 ? <p style={{ opacity: 0.6 }}>No ideas match.</p> : null}
          </div>
        </section>

        <section className="admin-card" style={{ padding: "1rem" }}>
          {!selected ? (
            <p>Select an idea.</p>
          ) : (
            <>
              <h2 style={{ marginTop: 0, fontSize: "1.15rem", fontWeight: 650 }}>{selected.title}</h2>
              <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>{selected.description}</p>
              <p style={{ fontSize: "0.8rem", opacity: 0.55 }}>
                {selected.authorName} · ↑ {selected.boostCount} · {selected.commentCount} comments
              </p>
              <p>
                <Link to={labIdeaPath(selected.slug)} target="_blank" rel="noreferrer">
                  Open public page
                </Link>
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const nextFeatured = !selected.isFeatured;
                    adminUpdateIdea(selected.id, {
                      isFeatured: nextFeatured,
                      ...(nextFeatured &&
                      (selected.status === "listening" || selected.status === "considering")
                        ? { status: "planned" as const }
                        : {}),
                    });
                    setMessage(
                      nextFeatured
                        ? "Accepted — now on Building."
                        : "Removed from Building.",
                    );
                  }}
                >
                  {selected.isFeatured ? "Unaccept" : "Accept"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    adminUpdateIdea(selected.id, { isVisible: !selected.isVisible });
                    setMessage(selected.isVisible ? "Hidden." : "Restored.");
                  }}
                >
                  {selected.isVisible ? "Hide" : "Restore"}
                </button>
              </div>

              <label style={{ display: "grid", gap: 6, marginTop: "1rem" }}>
                Status
                <select
                  value={selected.status}
                  onChange={(e) => {
                    adminUpdateIdea(selected.id, { status: e.target.value as FeedbackStatus });
                    setMessage("Status updated.");
                  }}
                >
                  {(Object.keys(STATUS_LABELS) as FeedbackStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6, marginTop: "1rem" }}>
                Explore response
                <textarea
                  rows={4}
                  value={responseDraft}
                  onChange={(e) => setResponseDraft(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn"
                style={{ marginTop: "0.5rem" }}
                onClick={() => {
                  adminUpdateIdea(selected.id, { teamResponse: responseDraft.trim() || null });
                  setMessage("Response saved.");
                }}
              >
                Save response
              </button>

              {selected.isFeatured ? (
                <div style={{ marginTop: "1.25rem" }}>
                  <BuildTogether idea={selected} asTeam />
                </div>
              ) : (
                <p style={{ marginTop: "1rem", opacity: 0.65, fontSize: "0.875rem" }}>
                  Accept this idea to put it on Building and open the build thread.
                </p>
              )}

              {message ? <p role="status">{message}</p> : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
