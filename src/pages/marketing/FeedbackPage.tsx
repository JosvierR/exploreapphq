import "@/styles/feedback.css";

const FEEDBACK_URL = (import.meta.env.VITE_FEEDBACK_URL as string | undefined)?.trim();

export function FeedbackPage() {
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

      {FEEDBACK_URL ? (
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
          <details>
            <summary>Admin setup</summary>
            <ol>
              <li>
                Create a free board on <a href="https://canny.io" target="_blank" rel="noreferrer">Canny</a> or{" "}
                <a href="https://userjot.com" target="_blank" rel="noreferrer">UserJot</a>.
              </li>
              <li>
                Copy the public board URL and set <code>VITE_FEEDBACK_URL</code> in Netlify
                environment variables.
              </li>
              <li>Trigger a deploy — the board embeds here automatically.</li>
            </ol>
          </details>
        </div>
      )}
    </div>
  );
}
