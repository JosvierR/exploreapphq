import { useEffect, useState } from "react";
import {
  addComment,
  deleteComment,
  ensureLabSession,
  updateComment,
} from "../labStore";
import { trackLab } from "../lib/analytics";
import { useLabStore } from "../lib/useLabStore";

type Props = { ideaId: string };

export function Discussion({ ideaId }: Props) {
  const snap = useLabStore();
  const comments = snap.comments
    .filter((c) => c.ideaId === ideaId && c.isVisible)
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const session = snap.session;
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  useEffect(() => {
    ensureLabSession();
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    ensureLabSession();
    const result = addComment(ideaId, body);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBody("");
    setError(null);
    trackLab("feedback_comment_created", { idea_id: ideaId, source: "idea_detail" });
  };

  return (
    <section className="lab-discussion" aria-labelledby="lab-discussion-title">
      <h2 id="lab-discussion-title">Discussion</h2>

      {comments.length === 0 ? (
        <p className="lab-hint" style={{ margin: "0.75rem 0" }}>
          Be the first to comment.
        </p>
      ) : (
        comments.map((c) => (
          <div key={c.id} className="lab-comment">
            <div className="lab-comment__meta">
              <strong>{c.authorName}</strong>
              <span>{new Date(c.createdAt).toLocaleDateString()}</span>
            </div>
            {editingId === c.id ? (
              <form
                className="lab-compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  const r = updateComment(c.id, editBody);
                  if (!r.ok) {
                    setError(r.error);
                    return;
                  }
                  setEditingId(null);
                }}
              >
                <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={3} />
                <div className="lab-actions">
                  <button type="submit" className="lab-btn lab-btn--primary lab-btn--sm">
                    Save
                  </button>
                  <button type="button" className="lab-btn lab-btn--ghost lab-btn--sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <p>{c.body}</p>
            )}
            {session && c.userId === session.userId && editingId !== c.id ? (
              <div className="lab-comment__actions">
                <button
                  type="button"
                  className="lab-linkish"
                  onClick={() => {
                    setEditingId(c.id);
                    setEditBody(c.body);
                  }}
                >
                  Edit
                </button>
                <button type="button" className="lab-linkish" onClick={() => deleteComment(c.id)}>
                  Delete
                </button>
              </div>
            ) : (
              <div className="lab-comment__actions">
                <button
                  type="button"
                  className="lab-linkish"
                  onClick={() => window.alert("Thanks — we'll review this report.")}
                >
                  Report
                </button>
              </div>
            )}
          </div>
        ))
      )}

      <form className="lab-compose" onSubmit={submit}>
        <label className="sr-only" htmlFor="lab-comment-body">
          Comment
        </label>
        <textarea
          id="lab-comment-body"
          rows={3}
          placeholder="Add a comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={1000}
        />
        {error ? (
          <p className="lab-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="lab-btn lab-btn--primary lab-btn--sm">
          Post
        </button>
      </form>
    </section>
  );
}
