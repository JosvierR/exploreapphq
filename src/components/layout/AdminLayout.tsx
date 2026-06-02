import { Link, Outlet, useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useAuth } from "@/features/auth/AuthProvider";
import { getHardcodedAdminSession } from "@/lib/hardcodedAdmin";

/** Minimal layout for /admin/* — no marketing nav overlap */
export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const displayEmail = user?.email ?? getHardcodedAdminSession() ?? "Team";

  async function handleSignOut() {
    await logout();
    navigate("/team", { replace: true });
  }

  return (
    <div className="admin-shell">
      <header className="admin-shell__bar">
        <Link to="/admin/waitlist" className="admin-shell__brand">
          <BrandLogo />
          <span className="admin-shell__badge">Team</span>
        </Link>
        <nav className="admin-shell__nav" aria-label="Admin">
          <Link to="/admin/waitlist" className="admin-shell__link is-active">
            Waitlist
          </Link>
          <Link to="/" className="admin-shell__link">
            View site
          </Link>
        </nav>
        <div className="admin-shell__user">
          <span className="admin-shell__email">{displayEmail}</span>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void handleSignOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="admin-shell__main">
        <Outlet />
      </main>
    </div>
  );
}
