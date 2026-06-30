import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useModerationAdmin } from "@/features/admin/ModerationAdminProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { getHardcodedAdminSession } from "@/lib/hardcodedAdmin";
import "@/styles/admin-waitlist.css";
import "@/styles/admin-moderation.css";

type NavItem = {
  label: string;
  to?: string;
  disabled?: boolean;
};

const moderationItems: NavItem[] = [
  { label: "Dashboard", to: "/admin" },
  { label: "Reports", to: "/admin/reports" },
  { label: "Videos", disabled: true },
  { label: "Users", disabled: true },
  { label: "Places", disabled: true },
  { label: "Audit Log", disabled: true },
];

const operationsItems: NavItem[] = [{ label: "Waitlist", to: "/admin/waitlist" }];

function routeMeta(pathname: string) {
  if (pathname.startsWith("/admin/reports")) {
    return {
      title: "Moderation reports",
      description: "Review incoming user-submitted reports and take action quickly.",
    };
  }

  if (pathname.startsWith("/admin/waitlist")) {
    return {
      title: "Waitlist",
      description: "Manage early access operations.",
    };
  }

  return {
    title: "Moderation dashboard",
    description: "Monitor the Explore moderation queue.",
  };
}

function initials(email: string) {
  const cleaned = email.trim();
  if (!cleaned) return "EX";
  const name = cleaned.split("@")[0] ?? cleaned;
  return name.slice(0, 2).toUpperCase();
}

function roleLabel(role?: string) {
  if (!role) return "Admin";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function NavGroup({ title, items, onNavigate }: { title: string; items: NavItem[]; onNavigate: () => void }) {
  return (
    <div className="admin-console__nav-group">
      <p className="admin-console__nav-title">{title}</p>
      {items.map((item) =>
        item.to ? (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.to === "/admin"}
            className={({ isActive }) => `admin-console__link${isActive ? " is-active" : ""}`}
            onClick={onNavigate}
          >
            <span className="admin-console__link-dot" aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ) : (
          <span key={item.label} className="admin-console__link admin-console__link--disabled" aria-disabled="true">
            <span className="admin-console__link-dot" aria-hidden="true" />
            <span>{item.label}</span>
            <em>Soon</em>
          </span>
        ),
      )}
    </div>
  );
}

export function AdminLayout() {
  const { user, logout } = useAuth();
  const moderationAdmin = useModerationAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const hardcodedEmail = getHardcodedAdminSession();
  const displayEmail = moderationAdmin.user?.email ?? user?.email ?? hardcodedEmail ?? "Not signed in";
  const hasSession = Boolean(moderationAdmin.user || user || hardcodedEmail);
  const meta = useMemo(() => routeMeta(location.pathname), [location.pathname]);
  const displayRole = moderationAdmin.admin?.role ? roleLabel(moderationAdmin.admin.role) : hasSession ? "Admin" : "Guest";

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  async function handleSignOut() {
    const hadModerationSession = Boolean(moderationAdmin.user);
    await Promise.all([logout(), moderationAdmin.signOut()]);
    navigate(hadModerationSession ? "/admin" : "/team", { replace: true });
  }

  return (
    <div className={`admin-console${navOpen ? " is-nav-open" : ""}`}>
      <button
        type="button"
        className="admin-console__scrim"
        aria-label="Close admin navigation"
        onClick={() => setNavOpen(false)}
      />

      <aside className="admin-console__sidebar" id="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-console__brand">
          <Link to="/admin" className="admin-console__brand-link" onClick={() => setNavOpen(false)}>
            <BrandLogo size={34} />
          </Link>
          <span className="admin-console__badge">Console</span>
        </div>

        <nav className="admin-console__nav" aria-label="Admin sections">
          <NavGroup title="Moderation" items={moderationItems} onNavigate={() => setNavOpen(false)} />
          <NavGroup title="Operations" items={operationsItems} onNavigate={() => setNavOpen(false)} />
        </nav>

        <div className="admin-console__sidebar-footer">
          <p>Production moderation workspace</p>
          <Link to="/" className="admin-console__utility-link" onClick={() => setNavOpen(false)}>
            View public site
          </Link>
        </div>
      </aside>

      <div className="admin-console__workspace">
        <header className="admin-console__topbar">
          <button
            type="button"
            className="admin-console__menu"
            aria-label="Open admin navigation"
            aria-expanded={navOpen}
            aria-controls="admin-sidebar"
            onClick={() => setNavOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>

          <div className="admin-console__page-title">
            <span>Explore admin</span>
            <h1>{meta.title}</h1>
            <p>{meta.description}</p>
          </div>

          <div className="admin-console__identity">
            <span className="admin-console__avatar" aria-hidden="true">
              {initials(displayEmail)}
            </span>
            <span className="admin-console__identity-copy">
              <strong>{displayEmail}</strong>
              <small>{displayRole}</small>
            </span>
            {hasSession && (
              <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void handleSignOut()}>
                Sign out
              </button>
            )}
          </div>
        </header>

        <main className="admin-console__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
