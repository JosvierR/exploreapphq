import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useAuth } from "@/features/auth/AuthProvider";
import { joinWaitlistByEmail, mapFirebaseAuthError } from "@/features/auth/firebaseAuth";
import "@/styles/access.css";

export function AccessPage() {
  const { isAdmin } = useAuth();
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState<{ message: string; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAdmin) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const normalized = email.trim().toLowerCase();
      const { created } = await joinWaitlistByEmail(normalized);
      setSuccess({
        email: normalized,
        message: created
          ? "You're on the list. Check your inbox — we just sent you a welcome email."
          : "You're already on the list. Check your inbox for our last note, or wait for the launch email.",
      });
      setEmail("");
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code.startsWith("auth/")) {
        setError(mapFirebaseAuthError(code));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="access-page">
      <div className="access-card access-card--public">
        <div className="access-brand">
          <BrandLogo />
        </div>

        <p className="access-eyebrow">Early access</p>
        <h1>Be first to explore</h1>
        <p className="access-lead">
          Discover real places through videos. Join the list and we'll let you know the moment you
          can download Explore.
        </p>

        <ul className="access-perks" aria-hidden="true">
          <li>Real videos from real places</li>
          <li>Save spots and build routes</li>
          <li>Explore what's near you</li>
        </ul>

        {success ? (
          <div className="access-success access-success--wow" role="status">
            <div className="access-success__glow" aria-hidden="true" />
            <span className="access-success__icon" aria-hidden="true">
              ✓
            </span>
            <p className="access-success__title">You're in</p>
            <p className="access-success__message">{success.message}</p>
            <p className="access-success__email">{success.email}</p>
            <ul className="access-success__steps">
              <li>Watch real videos from real places</li>
              <li>Save spots and build routes</li>
              <li>We'll email you when the app is ready</li>
            </ul>
          </div>
        ) : (
          <form className="access-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Your email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {error && (
              <p className="access-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="btn btn-primary access-submit" disabled={loading}>
              {loading ? "Joining…" : "Get early access"}
            </button>

            <p className="access-footnote">No spam — just one email when the app is ready.</p>
          </form>
        )}
      </div>
    </div>
  );
}
