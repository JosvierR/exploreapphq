import { FormEvent, type ReactNode, useState } from "react";
import { useModerationAdmin } from "@/features/admin/ModerationAdminProvider";
import "@/styles/admin-moderation.css";

function authErrorMessage(error: unknown) {
  if (error instanceof Error && /supabase browser config/i.test(error.message)) {
    return error.message;
  }
  return "Incorrect email or password.";
}

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const admin = useModerationAdmin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await admin.signIn(email, password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (admin.status === "authorized") {
    return children;
  }

  if (admin.status === "checking") {
    return (
      <div className="admin-auth-screen">
        <div className="admin-auth-card admin-auth-card--compact" aria-live="polite">
          <div className="admin-spinner" aria-hidden="true" />
          <p className="admin-eyebrow">Secure access</p>
          <h2>Checking access</h2>
          <p>Verifying your Supabase session.</p>
        </div>
      </div>
    );
  }

  if (admin.status === "not_configured") {
    return (
      <div className="admin-auth-screen">
        <div className="admin-auth-card">
          <p className="admin-eyebrow">Setup required</p>
          <h2>Supabase admin is not configured</h2>
          <p>
            Add the public Supabase URL and publishable key to the Vite environment, and add the
            server-side Supabase credential in Vercel.
          </p>
          <div className="admin-auth-card__code">
            <code>VITE_SUPABASE_URL</code>
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>
            <code>server Supabase credential</code>
          </div>
        </div>
      </div>
    );
  }

  if (admin.status === "denied") {
    return (
      <div className="admin-auth-screen">
        <div className="admin-auth-card">
          <p className="admin-eyebrow">Access denied</p>
          <h2>No moderator role</h2>
          <p>{admin.error ?? "This Supabase user is not listed as an admin or moderator."}</p>
          <button type="button" className="admin-btn admin-btn--primary" onClick={() => void admin.signOut()}>
            Use another account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-auth-screen">
      <form className="admin-auth-card" onSubmit={(event) => void handleSubmit(event)}>
        <div className="admin-auth-card__header">
          <p className="admin-eyebrow">Explore moderation</p>
          <h2>Admin sign in</h2>
          <p>Access the Explore moderation console.</p>
        </div>

        <label className="admin-field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="admin-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {(error || admin.error) && (
          <p className="admin-alert admin-alert--error" role="alert">
            {error ?? admin.error}
          </p>
        )}

        <button type="submit" className="admin-btn admin-btn--primary admin-btn--full" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
