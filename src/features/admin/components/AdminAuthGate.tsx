import { FormEvent, type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useModerationAdmin } from "@/features/admin/ModerationAdminProvider";
import "@/styles/admin-auth.css";

function authErrorMessage(error: unknown) {
  if (error instanceof Error && /supabase browser config/i.test(error.message)) {
    return error.message;
  }
  return "Incorrect email or password.";
}

function environmentLabel() {
  const raw = (import.meta.env.VITE_VERCEL_ENV || import.meta.env.VITE_APP_ENV || import.meta.env.MODE || "").toLowerCase();
  if (import.meta.env.DEV || raw === "development" || raw === "local") return "Local";
  if (raw.includes("preview") || raw.includes("staging")) return "Staging";
  return "Production";
}

function AdminAuthStatusCard({
  eyebrow,
  title,
  message,
  tone = "default",
  children,
}: {
  eyebrow: string;
  title: string;
  message: string;
  tone?: "default" | "danger" | "warning";
  children?: ReactNode;
}) {
  return (
    <div className="admin-auth-screen">
      <div className="admin-auth-screen__ambient" aria-hidden="true" />
      <section className={`admin-auth-panel admin-auth-panel--status admin-auth-panel--${tone}`} aria-live="polite">
        <header className="admin-auth-panel__brand">
          <BrandLogo size={40} />
          <div>
            <p className="admin-auth-panel__eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          <span className="admin-auth-panel__env">{environmentLabel()}</span>
        </header>
        <p className="admin-auth-panel__lead">{message}</p>
        {children}
      </section>
    </div>
  );
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
      <AdminAuthStatusCard
        eyebrow="Secure access"
        title="Verifying session"
        message="Checking your Supabase session and moderator authorization."
      >
        <div className="admin-auth-panel__spinner" aria-hidden="true" />
      </AdminAuthStatusCard>
    );
  }

  if (admin.status === "not_configured") {
    return (
      <AdminAuthStatusCard
        eyebrow="Setup required"
        title="Supabase config missing"
        message="Add the public Supabase URL and publishable key for this environment. Server credentials must stay server-side."
        tone="warning"
      >
        <div className="admin-auth-panel__code">
          <code>VITE_SUPABASE_URL</code>
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>
        </div>
      </AdminAuthStatusCard>
    );
  }

  if (admin.status === "denied") {
    return (
      <AdminAuthStatusCard
        eyebrow="Access denied"
        title="Not authorized"
        message="Your account is signed in, but it is not authorized for the Explore console."
        tone="danger"
      >
        {admin.error && <p className="admin-auth-panel__note">{admin.error}</p>}
        <button type="button" className="admin-auth-panel__btn admin-auth-panel__btn--primary" onClick={() => void admin.signOut()}>
          Use another account
        </button>
      </AdminAuthStatusCard>
    );
  }

  if (admin.status === "api_unavailable" || admin.status === "supabase_unavailable") {
    const isSupabase = admin.status === "supabase_unavailable";
    return (
      <AdminAuthStatusCard
        eyebrow={isSupabase ? "Supabase unavailable" : "API unavailable"}
        title={isSupabase ? "Data source unavailable" : "Console API unreachable"}
        message={
          isSupabase
            ? "The API is responding, but Supabase verification failed. Check server configuration and logs."
            : "The browser could not reach the admin API. Check deployment routing and server health."
        }
        tone="warning"
      >
        {admin.error && <p className="admin-auth-panel__note">{admin.error}</p>}
        <div className="admin-auth-panel__actions">
          <button type="button" className="admin-auth-panel__btn admin-auth-panel__btn--secondary" onClick={() => void admin.refresh()}>
            Retry
          </button>
          <button type="button" className="admin-auth-panel__btn admin-auth-panel__btn--ghost" onClick={() => void admin.signOut()}>
            Sign out
          </button>
        </div>
      </AdminAuthStatusCard>
    );
  }

  return (
    <div className="admin-auth-screen">
      <div className="admin-auth-screen__ambient" aria-hidden="true" />
      <form className="admin-auth-panel" onSubmit={(event) => void handleSubmit(event)}>
        <header className="admin-auth-panel__brand">
          <BrandLogo size={44} />
          <div>
            <p className="admin-auth-panel__eyebrow">Explore Console</p>
            <h1>Sign in</h1>
          </div>
          <span className="admin-auth-panel__env">{environmentLabel()}</span>
        </header>

        <p className="admin-auth-panel__lead">
          Authorized operators only. Use your Supabase admin account to access moderation, analytics, and system health.
        </p>

        <label className="admin-auth-field">
          <span>Work email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
          />
        </label>

        <label className="admin-auth-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </label>

        {(error || admin.error) && (
          <p className="admin-auth-panel__error" role="alert">
            {error ?? admin.error}
          </p>
        )}

        <button type="submit" className="admin-auth-panel__btn admin-auth-panel__btn--primary admin-auth-panel__btn--full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in to console"}
        </button>

        <p className="admin-auth-panel__footnote">
          Session tokens are never displayed in the browser console.
        </p>
        <p className="admin-auth-panel__back">
          <Link to="/">← Back to Explore</Link>
        </p>
      </form>
    </div>
  );
}
