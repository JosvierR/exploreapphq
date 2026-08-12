import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useModerationAdmin } from "@/features/admin/ModerationAdminProvider";
import { fetchApiHealth, type AdminHealth } from "@/lib/moderationAdminApi";
import { getHardcodedAdminSession } from "@/lib/hardcodedAdmin";
import "@/styles/admin-waitlist.css";
import "@/styles/admin-moderation.css";
import "@/styles/admin-apple.css";

type NavItem = {
  label: string;
  to?: string;
  disabled?: boolean;
  note?: string;
  exactQuery?: boolean;
};

/** Small outline icon glyphs for the sidebar nav (no external icon library). */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const NAV_ICONS: Record<string, ReactNode> = {
  Dashboard: (
    <Icon>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
    </Icon>
  ),
  Moderation: (
    <Icon>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9.3 12.2l1.9 1.9L14.9 10" />
    </Icon>
  ),
  Reports: (
    <Icon>
      <path d="M6 3v18" />
      <path d="M6 4.5h11l-2.2 3.5L17 11.5H6" />
    </Icon>
  ),
  Pending: (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  ),
  Reviewed: (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 12.3l2.5 2.4 4.6-5.2" />
    </Icon>
  ),
  Hidden: (
    <Icon>
      <path d="M3.5 12s3.5-6.5 8.5-6.5 8.5 6.5 8.5 6.5-3.5 6.5-8.5 6.5S3.5 12 3.5 12z" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M4 4l16 16" />
    </Icon>
  ),
  Users: (
    <Icon>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M15.5 14.2c2 .3 3.7 1.9 3.7 4.3" />
    </Icon>
  ),
  Content: (
    <Icon>
      <path d="M7 3.5h7l4 4V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z" />
      <path d="M14 3.5V8h4" />
      <path d="M8.5 12.5h7M8.5 15.5h7M8.5 18h4" />
    </Icon>
  ),
  Places: (
    <Icon>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 105 9.5C5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.3" r="2.3" />
    </Icon>
  ),
  Routes: (
    <Icon>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M6 8.2V13a4 4 0 004 4h4" />
    </Icon>
  ),
  Waitlist: (
    <Icon>
      <path d="M4 6h11M4 12h11M4 18h7" />
      <circle cx="19" cy="6" r="1.3" />
      <circle cx="19" cy="12" r="1.3" />
    </Icon>
  ),
  Insights: (
    <Icon>
      <path d="M4 20V10M11 20V4M18 20v-7" />
    </Icon>
  ),
  "Analytics Ops": (
    <Icon>
      <path d="M3.5 12h3.5l2-6 4 12 2-8 1.5 2h3.5" />
    </Icon>
  ),
  Data: (
    <Icon>
      <ellipse cx="12" cy="6" rx="7" ry="2.6" />
      <path d="M5 6v6c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6" />
      <path d="M5 12v6c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-6" />
    </Icon>
  ),
  System: (
    <Icon>
      <rect x="7.5" y="7.5" width="9" height="9" rx="1.4" />
      <path d="M12 3.2v2.4M12 18.4v2.4M3.2 12h2.4M18.4 12h2.4M5.8 5.8l1.7 1.7M16.5 16.5l1.7 1.7M5.8 18.2l1.7-1.7M16.5 7.5l1.7-1.7" />
    </Icon>
  ),
  "API Docs": (
    <Icon>
      <path d="M9 8l-4.5 4L9 16" />
      <path d="M15 8l4.5 4-4.5 4" />
    </Icon>
  ),
  Admins: (
    <Icon>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <circle cx="12" cy="10.3" r="2" />
      <path d="M9 15.2c.5-1.6 1.6-2.3 3-2.3s2.5.7 3 2.3" />
    </Icon>
  ),
};

function SidebarToggleIcon() {
  return (
    <Icon>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9.5 4.5v15" />
    </Icon>
  );
}

function BellIcon() {
  return (
    <Icon>
      <path d="M6 9a6 6 0 1112 0c0 4 1.2 5.4 1.8 6.1a.9.9 0 01-.7 1.4H4.9a.9.9 0 01-.7-1.4C4.8 14.4 6 13 6 9z" />
      <path d="M10 19a2 2 0 004 0" />
    </Icon>
  );
}

const moderationItems: NavItem[] = [
  { label: "Moderation", to: "/admin?section=moderation" },
  { label: "Reports", to: "/admin/reports?status=all", exactQuery: true },
  { label: "Pending", to: "/admin/reports?status=pending" },
  { label: "Reviewed", to: "/admin/reports?status=reviewed" },
  { label: "Hidden", to: "/admin/reports?status=all&visibility=hidden_removed" },
];

const overviewItems: NavItem[] = [{ label: "Dashboard", to: "/admin?section=overview", exactQuery: true }];

const operationsItems: NavItem[] = [
  { label: "Users", to: "/admin?section=users", exactQuery: true },
  { label: "Content", to: "/admin?section=content", exactQuery: true },
  { label: "Places", to: "/admin?section=content&content=places" },
  { label: "Routes", to: "/admin?section=content&content=routes" },
  { label: "Waitlist", to: "/admin/waitlist" },
];

const insightsItems: NavItem[] = [
  { label: "Insights", to: "/admin?section=insights", exactQuery: true },
  { label: "Analytics Ops", to: "/admin/analytics" },
  { label: "Data", to: "/admin/analytics/data" },
  { label: "Business", to: "/admin/analytics/business" },
];

const systemItems: NavItem[] = [
  { label: "System", to: "/admin?section=system", exactQuery: true },
  { label: "API Docs", to: "/admin/api-docs" },
  { label: "Admins", to: "/admin?section=admins", exactQuery: true },
];

function routeMeta(pathname: string, search: string) {
  if (pathname === "/admin") {
    const section = new URLSearchParams(search).get("section") || "overview";
    if (section === "users") return { title: "Users", description: "" };
    if (section === "content") return { title: "Content", description: "" };
    if (section === "moderation") return { title: "Moderation", description: "" };
    if (section === "insights" || section === "analytics") return { title: "Insights", description: "" };
    if (section === "system") return { title: "System", description: "" };
    if (section === "admins") return { title: "Admins", description: "" };
    return { title: "Dashboard", description: "" };
  }

  if (pathname === "/admin/analytics/data") {
    return { title: "Data", description: "" };
  }

  if (pathname === "/admin/analytics/business") {
    return { title: "Business", description: "" };
  }

  if (pathname === "/admin/analytics") {
    return { title: "Analytics Ops", description: "" };
  }

  if (pathname.startsWith("/admin/reports")) {
    const params = new URLSearchParams(search);
    const status = params.get("status");
    const visibility = params.get("visibility");
    if (status === "pending") return { title: "Pending", description: "" };
    if (status === "reviewed") return { title: "Reviewed", description: "" };
    if (visibility === "hidden_removed") return { title: "Hidden", description: "" };
    return { title: "Reports", description: "" };
  }

  if (pathname.startsWith("/admin/waitlist")) {
    return { title: "Waitlist", description: "" };
  }

  if (pathname.startsWith("/admin/api-docs")) {
    return { title: "API Docs", description: "" };
  }

  return { title: "Admin", description: "" };
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

function environmentLabel() {
  const rawEnv = (
    import.meta.env.VITE_VERCEL_ENV ||
    import.meta.env.VITE_APP_ENV ||
    import.meta.env.MODE ||
    ""
  ).toLowerCase();

  if (import.meta.env.DEV || rawEnv === "development" || rawEnv === "local") return "Local";
  if (rawEnv.includes("preview") || rawEnv.includes("staging")) return "Staging";
  return "Production";
}

function formatLastUpdated(value: Date | null) {
  if (!value) return "Not refreshed";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

function isItemActive(item: NavItem, pathname: string, search: string) {
  if (!item.to) return false;
  const to = item.to;
  const [targetPath, query = ""] = to.split("?");
  if (pathname !== targetPath) return false;

  if (!query) {
    return pathname === targetPath && !search;
  }

  const expected = new URLSearchParams(query);
  const current = new URLSearchParams(search);
  for (const [key, value] of expected.entries()) {
    if (current.get(key) !== value) return false;
  }
  if (item.exactQuery) {
    return [...current.keys()].every((key) => expected.has(key));
  }
  return true;
}

function NavGroup({ title, items, onNavigate }: { title: string; items: NavItem[]; onNavigate: () => void }) {
  const location = useLocation();

  return (
    <div className="admin-console__nav-group">
      <p className="admin-console__nav-title">{title}</p>
      {items.map((item) =>
        item.to ? (
          <Link
            key={item.label}
            to={item.to}
            title={item.label}
            className={`admin-console__link${
              isItemActive(item, location.pathname, location.search) ? " is-active" : ""
            }`}
            onClick={onNavigate}
          >
            <span className="admin-console__link-dot" aria-hidden="true" />
            <span className="admin-console__link-icon">
              {NAV_ICONS[item.label] ?? (
                <Icon>
                  <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
                </Icon>
              )}
            </span>
            <span className="admin-console__link-label">{item.label}</span>
          </Link>
        ) : (
          <span
            key={item.label}
            title={item.label}
            className="admin-console__link admin-console__link--disabled"
            aria-disabled="true"
          >
            <span className="admin-console__link-dot" aria-hidden="true" />
            <span className="admin-console__link-icon">
              {NAV_ICONS[item.label] ?? (
                <Icon>
                  <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
                </Icon>
              )}
            </span>
            <span className="admin-console__link-label">{item.label}</span>
            <em>{item.note ?? "Soon"}</em>
          </span>
        ),
      )}
    </div>
  );
}

function HealthPill({ label, tone }: { label: string; tone: "ok" | "warning" | "error" }) {
  return (
    <span className={`admin-system-pill admin-system-pill--${tone}`}>
      <span aria-hidden="true" />
      {label}
    </span>
  );
}

export function AdminLayout() {
  const moderationAdmin = useModerationAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("admin:sidebar-collapsed") === "1";
  });
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const hardcodedEmail = getHardcodedAdminSession();
  const displayEmail = moderationAdmin.user?.email ?? hardcodedEmail ?? "Not signed in";
  const hasSession = Boolean(moderationAdmin.user || hardcodedEmail);
  const meta = useMemo(() => routeMeta(location.pathname, location.search), [location.pathname, location.search]);
  const displayRole = moderationAdmin.admin?.role ? roleLabel(moderationAdmin.admin.role) : hasSession ? "Admin" : "Guest";
  const envLabel = environmentLabel();

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const nextHealth = await fetchApiHealth();
      setHealth(nextHealth);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    void loadHealth().then(() => setLastUpdated(new Date()));
  }, [loadHealth]);

  async function handleRefresh() {
    await Promise.allSettled([loadHealth(), moderationAdmin.refresh()]);
    setLastUpdated(new Date());
    window.dispatchEvent(new Event("admin:refresh"));
  }

  async function handleSignOut() {
    await moderationAdmin.signOut();
    navigate("/", { replace: true });
  }

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("admin:sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  const supabaseConfigured =
    Boolean(health?.supabaseUrlConfigured && health.publishableKeyConfigured && health.secretKeyConfigured) ||
    (moderationAdmin.configured && health === null);
  const adminAuthorized = moderationAdmin.status === "authorized";

  return (
    <div className={`admin-console${navOpen ? " is-nav-open" : ""}${collapsed ? " is-collapsed" : ""}`}>
      <button
        type="button"
        className="admin-console__scrim"
        aria-label="Close admin navigation"
        onClick={() => setNavOpen(false)}
      />

      <aside className="admin-console__sidebar" id="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-console__brand">
          <Link to="/admin" className="admin-console__brand-link" onClick={() => setNavOpen(false)}>
            <BrandLogo size={34} showName={false} />
            <span className="admin-console__brand-copy">
              <strong>Explore</strong>
              <small>Admin</small>
            </span>
          </Link>
          <span className="admin-console__badge">{envLabel}</span>
        </div>

        <nav className="admin-console__nav" aria-label="Admin sections">
          <NavGroup title="Overview" items={overviewItems} onNavigate={() => setNavOpen(false)} />
          <NavGroup title="Operations" items={operationsItems} onNavigate={() => setNavOpen(false)} />
          <NavGroup title="Moderation" items={moderationItems} onNavigate={() => setNavOpen(false)} />
          <NavGroup title="Insights" items={insightsItems} onNavigate={() => setNavOpen(false)} />
          <NavGroup title="System" items={systemItems} onNavigate={() => setNavOpen(false)} />
        </nav>

        <div className="admin-console__sidebar-footer">
          <Link to="/" className="admin-console__utility-link" title="Public site" onClick={() => setNavOpen(false)}>
            <span className="admin-console__link-icon">
              <Icon>
                <path d="M9 5H5a1.5 1.5 0 00-1.5 1.5v13A1.5 1.5 0 005 21h13a1.5 1.5 0 001.5-1.5V15" />
                <path d="M14 4h6v6M20 4L11 13" />
              </Icon>
            </span>
            <span>Public site</span>
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

          <button
            type="button"
            className="admin-console__collapse-toggle"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleCollapsed}
          >
            <SidebarToggleIcon />
          </button>

          <div className="admin-console__page-title">
            <h1>{meta.title}</h1>
          </div>

          <div className="admin-console__topbar-actions">
            <div className="admin-system-status" aria-label="System status">
              <HealthPill label="API" tone={health?.ok ? "ok" : healthLoading ? "warning" : "error"} />
              <HealthPill label="Supabase" tone={supabaseConfigured ? "ok" : "error"} />
              <HealthPill
                label="Admin"
                tone={
                  adminAuthorized
                    ? "ok"
                    : moderationAdmin.status === "checking" && !moderationAdmin.sessionRefreshing
                      ? "warning"
                      : "error"
                }
              />
            </div>

            <div className="admin-console__refresh">
              <span title={moderationAdmin.sessionRefreshing ? "Refreshing session…" : undefined}>
                {formatLastUpdated(lastUpdated)}
              </span>
              <button
                type="button"
                className="admin-btn admin-btn--ghost admin-btn--sm"
                aria-label="Refresh admin data"
                onClick={() => void handleRefresh()}
                disabled={healthLoading}
              >
                {healthLoading ? "…" : "Refresh"}
              </button>
            </div>

            <button type="button" className="admin-console__notification" aria-label="Notifications">
              <BellIcon />
              <span className="admin-console__notification-dot" aria-hidden="true" />
            </button>

            <div className="admin-console__identity">
              <span className="admin-console__avatar" aria-hidden="true">
                {initials(displayEmail)}
              </span>
              <span className="admin-console__identity-copy">
                <strong>{displayEmail}</strong>
                <small>{displayRole}</small>
              </span>
              {hasSession && (
                <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => void handleSignOut()}>
                  Sign out
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="admin-console__main">
          <div className="admin-console__route" key={`${location.pathname}${location.search}`}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
