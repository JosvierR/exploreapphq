import "@/styles/feedback.css";
import { CannyBoard } from "@/components/feedback/CannyBoard";

const CANNY_BOARD_TOKEN = (import.meta.env.VITE_CANNY_BOARD_TOKEN as string | undefined)?.trim();
const FEEDBACK_URL = (import.meta.env.VITE_FEEDBACK_URL as string | undefined)?.trim();
/** Optional: https://yourcompany.canny.io — used for “open in new tab” with widget */
const CANNY_PORTAL_URL = (import.meta.env.VITE_CANNY_PORTAL_URL as string | undefined)?.trim();

export function FeedbackPage() {
  const portalUrl = CANNY_PORTAL_URL || FEEDBACK_URL;

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

      {CANNY_BOARD_TOKEN ? (
        <CannyBoard boardToken={CANNY_BOARD_TOKEN} portalUrl={portalUrl || undefined} />
      ) : FEEDBACK_URL ? (
        <div className="feedback-embed">
          <iframe
            title="Explore feedback board"
            src={FEEDBACK_URL}
            loading="lazy"
            allow="clipboard-write"
          />
          <p className="feedback-fallback">
            Board not loading?{" "}
            <a href={FEEDBACK_URL} target="_blank" rel="noreferrer">
              Open it in a new tab
            </a>
            .
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
                In Canny, finish setup and open your <strong>Portal</strong> (subdomain like{" "}
                <code>explore.canny.io</code>).
              </li>
              <li>
                <strong>Settings → Boards →</strong> your board → <strong>Install</strong> → copy{" "}
                <strong>Board token</strong>.
              </li>
              <li>
                Netlify → Environment variables:
                <ul>
                  <li>
                    <code>VITE_CANNY_BOARD_TOKEN</code> = board token
                  </li>
                  <li>
                    <code>VITE_CANNY_PORTAL_URL</code> = portal URL (e.g.{" "}
                    <code>https://explore.canny.io</code>)
                  </li>
                </ul>
              </li>
              <li>
                <strong>Deploys → Trigger deploy</strong>. Reload{" "}
                <code>/feedback</code>.
              </li>
            </ol>
            <p className="feedback-setup-note">
              Full guide: <code>docs/CANNY_FEEDBACK.md</code> in the repo.
            </p>
          </details>
        </div>
      )}
    </div>
  );
}
