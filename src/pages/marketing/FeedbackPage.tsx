import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { submitFeedback } from "@/lib/feedbackSubmit";
import "@/styles/feedback.css";

const CATEGORIES = [
  { id: "idea", label: "Feature idea", icon: "💡" },
  { id: "love", label: "Something I love", icon: "❤️" },
  { id: "bug", label: "Something broken", icon: "🔧" },
  { id: "other", label: "Other", icon: "✨" },
] as const;

export function FeedbackPage() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>("idea");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (message.trim().length < 3) {
      setError("Share at least a few words — we want to hear you.");
      return;
    }

    setLoading(true);
    try {
      const result = await submitFeedback({
        message: message.trim(),
        email: email.trim() || undefined,
        name: name.trim() || undefined,
        category,
      });
      setSuccess(result.message);
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="feedback-page">
      <div className="feedback-bg" aria-hidden="true" />
      <div className="feedback-shell">
        <header className="feedback-head">
          <Link to="/access" className="feedback-back">
            ← Waitlist
          </Link>
          <div className="feedback-brand">
            <BrandLogo />
          </div>
          <p className="feedback-eyebrow">Shape Explore</p>
          <h1>Your voice matters</h1>
          <p className="feedback-lead">
            Every idea goes to our team. We read each one and use what rises to the top to decide
            what we build next.
          </p>
        </header>

        {success ? (
          <div className="feedback-success" role="status">
            <div className="feedback-success__ring" aria-hidden="true">
              <span className="feedback-success__check">✓</span>
            </div>
            <h2>We got it</h2>
            <p>{success}</p>
            <p className="feedback-success__sub">
              Your feedback is saved and will be reviewed by the Explore team. Thank you for helping
              us build something people love.
            </p>
            <button
              type="button"
              className="feedback-btn feedback-btn--ghost"
              onClick={() => {
                setSuccess(null);
                setCategory("idea");
              }}
            >
              Share another idea
            </button>
          </div>
        ) : (
          <form className="feedback-form" onSubmit={(e) => void handleSubmit(e)}>
            <fieldset className="feedback-categories">
              <legend className="sr-only">Category</legend>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`feedback-chip ${category === c.id ? "feedback-chip--active" : ""}`}
                  onClick={() => setCategory(c.id)}
                  aria-pressed={category === c.id}
                >
                  <span aria-hidden="true">{c.icon}</span> {c.label}
                </button>
              ))}
            </fieldset>

            <label className="feedback-field">
              <span>What should Explore do?</span>
              <textarea
                required
                rows={5}
                placeholder="Describe your idea, what problem it solves, or what you'd love to see…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={4000}
              />
            </label>

            <div className="feedback-row">
              <label className="feedback-field">
                <span>Name <em>(optional)</em></span>
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="feedback-field">
                <span>Email <em>(optional)</em></span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </div>

            {error && (
              <p className="feedback-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="feedback-btn feedback-btn--primary" disabled={loading}>
              {loading ? "Sending…" : "Submit feedback"}
            </button>

            <p className="feedback-trust">
              🔒 Saved securely · Read by our team · No spam, ever
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
