import "@/styles/feedback.css";

const CANNY_PORTAL_URL = (import.meta.env.VITE_CANNY_PORTAL_URL as string | undefined)?.trim();
const FEEDBACK_URL = (import.meta.env.VITE_FEEDBACK_URL as string | undefined)?.trim();

/** Public board URL — iframe + “open in tab” (works with ad blockers; widget often breaks). */
function getBoardUrl(): string | null {
  if (FEEDBACK_URL) return FEEDBACK_URL;
  if (CANNY_PORTAL_URL) {
    const base = CANNY_PORTAL_URL.replace(/\/$/, "");
    return `${base}/feature-requests`;
  }
  return null;
}

export function FeedbackPage() {
  const boardUrl = getBoardUrl();

  return (
    <div className="feedback-page container">
      <header className="feedback-head">
        <p className="feedback-eyebrow">Shape Explore</p>
        <h1>Feature requests &amp; feedback</h1>
        <p className="feedback-lead">
          Tell us what you want Explore to do — and vote on ideas from other early users. What
          floats to the top guides what we build next.
        </p>
      </header>

      {boardUrl ? (
        <div className="feedback-embed">
          <p className="feedback-open-cta">
            <a href={boardUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
              Open feedback board →
            </a>
            <span className="feedback-open-hint">
              Best experience in a new tab (works with Brave / ad blockers).
            </span>
          </p>
          <iframe
            title="Explore feedback board"
            src={boardUrl}
            loading="lazy"
            allow="clipboard-write"
          />
          <p className="feedback-fallback">
            Preview not loading?{" "}
            <a href={boardUrl} target="_blank" rel="noreferrer">
              Open explore.canny.io/feature-requests
            </a>
          </p>
        </div>
      ) : (
        <div className="feedback-setup">
          <h2>Board coming soon</h2>
          <p>
            We're setting up the public board. In the meantime, send your ideas to{" "}
            <a href="mailto:josvierrod@exploreapphq.com">josvierrod@exploreapphq.com</a>.
          </p>
          <details open>
            <summary>Connect Canny (5 min)</summary>
            <ol>
              <li>
                Portal: <code>https://explore.canny.io/feature-requests</code>
              </li>
              <li>
                Netlify → <code>VITE_CANNY_PORTAL_URL=https://explore.canny.io</code> and/or{" "}
                <code>VITE_FEEDBACK_URL=https://explore.canny.io/feature-requests</code>
              </li>
              <li>
                <strong>Deploys → Trigger deploy</strong>
              </li>
            </ol>
            <p className="feedback-setup-note">
              Guide: <code>docs/CANNY_FEEDBACK.md</code>
            </p>
          </details>
        </div>
      )}
    </div>
  );
}
