import { FormEvent, type ReactNode, useState } from "react";
import { useModerationAdmin } from "@/features/admin/ModerationAdminProvider";
import "@/styles/admin-moderation.css";

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
      <section className={`admin-auth-card admin-auth-card--status admin-auth-card--${tone}`} aria-live="polite">
        <div className="admin-auth-brand">
          <span className="admin-auth-brand__mark" aria-hidden="true">EX</span>
          <div>
            <p className="admin-eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          <span className="admin-console__badge">{environmentLabel()}</span>
        </div>
        <p>{message}</p>
        {children}
        <dl className="admin-auth-debug">
          <div>
            <dt>Console</dt>
            <dd>Explore Admin Console</dd>
          </div>
          <div>
            <dt>Environment</dt>
            <dd>{environmentLabel()}</dd>
          </div>
        </dl>
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
        eyebrow="Secure admin access"
        title="Checking admin session"
        message="Verifying your Supabase session and moderator authorization."
      >
        <div className="admin-auth-progress">
          <div className="admin-spinner" aria-hidden="true" />
        </div>
      </AdminAuthStatusCard>
    );
  }

  if (admin.status === "not_configured") {
    return (
      <AdminAuthStatusCard
        eyebrow="Setup required"
        title="Supabase browser config is missing"
        message="Add the public Supabase URL and publishable key for this environment. Server credentials must stay server-side."
        tone="warning"
      >
        <div className="admin-auth-card__code">
          <code>VITE_SUPABASE_URL</code>
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>
          <code>server Supabase credential configured in Vercel</code>
        </div>
      </AdminAuthStatusCard>
    );
  }

  if (admin.status === "denied") {
    return (
      <AdminAuthStatusCard
        eyebrow="Access denied"
        title="No admin authorization"
        message="Your account is signed in, but it is not authorized for Explore Admin Console."
        tone="danger"
      >
        {admin.error && <p className="admin-auth-note">{admin.error}</p>}
        <button type="button" className="admin-btn admin-btn--primary" onClick={() => void admin.signOut()}>
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
        title={isSupabase ? "Admin data source unavailable" : "Admin API is not reachable"}
        message={
          isSupabase
            ? "The API is responding, but Supabase admin verification failed. Check server-side Supabase configuration and logs."
            : "The browser could not reach the admin API. Check deployment routing, network status, and server logs."
        }
        tone="warning"
      >
        {admin.error && <p className="admin-auth-note">{admin.error}</p>}
        <div className="admin-auth-actions">
          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => void admin.refresh()}>
            Retry verification
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void admin.signOut()}>
            Sign out
          </button>
        </div>
      </AdminAuthStatusCard>
    );
  }

  return (
    <div className="admin-auth-screen">
      <form className="admin-auth-card" onSubmit={(event) => void handleSubmit(event)}>
        <div className="admin-auth-card__header">
          <div className="admin-auth-brand">
            <span className="admin-auth-brand__mark" aria-hidden="true">EX</span>
            <div>
              <p className="admin-eyebrow">Secure admin access</p>
              <h2>Explore Admin Console</h2>
            </div>
            <span className="admin-console__badge">{environmentLabel()}</span>
          </div>
          <p>Sign in with an authorized Supabase admin account to operate moderation, content, and system health.</p>
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
        <p className="admin-auth-footnote">
          Tokens and raw auth payloads are never displayed in this console.
        </p>
      </form>
    </div>
  );
}
