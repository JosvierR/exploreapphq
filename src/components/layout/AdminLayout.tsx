import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useModerationAdmin } from "@/features/admin/ModerationAdminProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { getHardcodedAdminSession } from "@/lib/hardcodedAdmin";
import "@/styles/admin-waitlist.css";

/** Minimal layout for /admin/* — no marketing nav overlap */
export function AdminLayout() {
  const { user, logout } = useAuth();
  const moderationAdmin = useModerationAdmin();
  const navigate = useNavigate();
  const hardcodedEmail = getHardcodedAdminSession();
  const displayEmail = moderationAdmin.user?.email ?? user?.email ?? hardcodedEmail ?? "Team";
  const hasSession = Boolean(moderationAdmin.user || user || hardcodedEmail);

  async function handleSignOut() {
    const hadModerationSession = Boolean(moderationAdmin.user);
    await Promise.all([logout(), moderationAdmin.signOut()]);
    navigate(hadModerationSession ? "/admin" : "/team", { replace: true });
  }

  return (
    <div className="admin-shell">
      <header className="admin-shell__bar">
        <Link to="/admin" className="admin-shell__brand">
          <BrandLogo />
          <span className="admin-shell__badge">Team</span>
        </Link>
        <nav className="admin-shell__nav" aria-label="Admin">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) => `admin-shell__link${isActive ? " is-active" : ""}`}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/admin/reports"
            className={({ isActive }) => `admin-shell__link${isActive ? " is-active" : ""}`}
          >
            Reports
          </NavLink>
          <NavLink
            to="/admin/waitlist"
            className={({ isActive }) => `admin-shell__link${isActive ? " is-active" : ""}`}
          >
            Waitlist
          </NavLink>
          <Link to="/" className="admin-shell__link">
            View site
          </Link>
        </nav>
        <div className="admin-shell__user">
          <span className="admin-shell__email">{displayEmail}</span>
          {hasSession && (
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void handleSignOut()}>
              Sign out
            </button>
          )}
        </div>
      </header>
      <main className="admin-shell__main">
        <Outlet />
      </main>
    </div>
  );
}
