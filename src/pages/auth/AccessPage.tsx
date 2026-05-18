import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useAuth } from "@/features/auth/AuthProvider";
import { requestAccess } from "@/lib/api";
import "@/styles/access.css";

const ADMIN_EMAIL = "admin@example.com";

export function AccessPage() {
  const { isAdmin, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAdmin) {
    return <Navigate to="/" replace />;
  }

  const normalized = email.trim().toLowerCase();
  const isAdminEmail = normalized === ADMIN_EMAIL;

  function handleEmailChange(value: string) {
    setEmail(value);
    setError(null);
    setWaitlistMessage(null);
    setNeedsPassword(value.trim().toLowerCase() === ADMIN_EMAIL);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setWaitlistMessage(null);
    setLoading(true);

    try {
      const result = await requestAccess(
        normalized,
        needsPassword && isAdminEmail ? password : undefined,
      );

      if (result.access === "password_required") {
        setNeedsPassword(true);
        return;
      }

      if (result.access === "full") {
        login(result.token);
        navigate("/", { replace: true });
        return;
      }

      setWaitlistMessage(result.message);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="access-page">
      <div className="access-card">
        <div className="access-brand">
          <BrandLogo />
        </div>
        <h1>Get access to Explore</h1>
        <p className="access-lead">
          Enter your email. Team members sign in with a password; everyone else joins the waitlist.
        </p>

        {waitlistMessage ? (
          <div className="access-success" role="status">
            <p>{waitlistMessage}</p>
            <p className="access-hint">Check Mailpit at localhost:8025 if you are testing locally.</p>
          </div>
        ) : (
          <form className="access-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
            />

            {needsPassword && isAdminEmail && (
              <>
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </>
            )}

            {error && (
              <p className="access-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="btn btn-primary access-submit" disabled={loading}>
              {loading
                ? "Please wait…"
                : needsPassword && isAdminEmail
                  ? "Sign in"
                  : "Continue"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
