import { useEffect, useState } from "react";
import { addBuildMessage, ensureLabSession, getBuildMessages } from "../data/labStore";
import { useLabStore } from "../lib/useLabStore";
import type { FeedbackIdea } from "../types";

type Props = {
  idea: FeedbackIdea;
  asTeam?: boolean;
};

export function BuildTogether({ idea, asTeam = false }: Props) {
  const snap = useLabStore();
  const messages = getBuildMessages(idea.id);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!asTeam) ensureLabSession();
  }, [asTeam]);

  if (!idea.isFeatured) return null;

  const isAuthor = Boolean(snap.session && snap.session.userId === idea.userId);
  const canWrite = asTeam || isAuthor;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!asTeam) ensureLabSession();
    const result = addBuildMessage(idea.id, body, { asTeam });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBody("");
    setError(null);
  };

  return (
    <section className="lab-build" aria-labelledby="lab-build-title">
      <div className="lab-build__head">
        <h2 id="lab-build-title">Build with the proposer</h2>
        <p>
          {canWrite
            ? "Private thread with the person who proposed this."
            : "Only the author can message the team here."}
        </p>
      </div>

      <div className="lab-build__thread">
        {messages.length === 0 ? (
          <p className="lab-hint">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`lab-build__msg${m.isTeam ? " is-team" : ""}`}>
              <div className="lab-build__meta">
                <strong>{m.isTeam ? "Explore Team" : m.authorName}</strong>
                <span>{new Date(m.createdAt).toLocaleDateString()}</span>
              </div>
              <p>{m.body}</p>
            </div>
          ))
        )}
      </div>

      {canWrite ? (
        <form className="lab-compose" onSubmit={submit}>
          <label className="sr-only" htmlFor={`lab-build-${idea.id}`}>
            Message
          </label>
          <textarea
            id={`lab-build-${idea.id}`}
            rows={3}
            maxLength={1000}
            placeholder={asTeam ? "Reply as Explore…" : "Share how you'd use this…"}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {error ? (
            <p className="lab-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="lab-btn lab-btn--primary lab-btn--sm">
            Send
          </button>
        </form>
      ) : null}
    </section>
  );
}
