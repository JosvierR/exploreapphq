import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useAuth } from "@/features/auth/AuthProvider";
import { firebaseAdminSignIn, mapFirebaseAuthError } from "@/features/auth/firebaseAuth";
import { isFirebaseConfigured } from "@/lib/firebase";
import "@/styles/access.css";

/** Hidden team login — not linked from the public site. */
export function TeamLoginPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAdmin) {
    return <Navigate to="/admin/waitlist" replace />;
  }

  if (!isFirebaseConfigured()) {
    return (
      <div className="access-page">
        <div className="access-card">
          <div className="access-brand">
            <BrandLogo />
          </div>
          <h1>Firebase required</h1>
          <p className="access-lead">
            Add <code>VITE_FIREBASE_*</code> and <code>VITE_ADMIN_EMAILS</code> to{" "}
            <code>.env</code>, then create the admin user in Firebase Console → Authentication.
          </p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await firebaseAdminSignIn(email, password);
      navigate("/admin/waitlist", { replace: true });
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code.startsWith("auth/")) {
        setError(mapFirebaseAuthError(code));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Sign in failed.");
      }
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
        <h1>Team access</h1>
        <p className="access-lead">Sign in with your team account to preview the site.</p>
        <form className="access-form" onSubmit={handleSubmit}>
          <label htmlFor="team-email">Email</label>
          <input
            id="team-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="team-password">Password</label>
          <input
            id="team-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="access-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary access-submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
