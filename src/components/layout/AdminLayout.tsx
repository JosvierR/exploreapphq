import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useModerationAdmin } from "@/features/admin/ModerationAdminProvider";
import { fetchApiHealth, type AdminHealth } from "@/lib/moderationAdminApi";
import { getHardcodedAdminSession } from "@/lib/hardcodedAdmin";
import "@/styles/admin-waitlist.css";
import "@/styles/admin-moderation.css";

type NavItem = {
  label: string;
  to?: string;
  disabled?: boolean;
  note?: string;
  exactQuery?: boolean;
};

const moderationItems: NavItem[] = [
  { label: "Moderation Home", to: "/admin?section=moderation" },
  { label: "Reports", to: "/admin/reports?status=all", exactQuery: true },
  { label: "Pending Queue", to: "/admin/reports?status=pending" },
  { label: "Reviewed", to: "/admin/reports?status=reviewed" },
  { label: "Removed/Hidden", to: "/admin/reports?status=all&visibility=hidden_removed" },
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
  { label: "Product Insights", to: "/admin?section=insights", exactQuery: true },
  { label: "Analytics", to: "/admin/analytics" },
];

const systemItems: NavItem[] = [
  { label: "System / Observability", to: "/admin?section=system", exactQuery: true },
  { label: "Admins", to: "/admin?section=admins", exactQuery: true },
];

function routeMeta(pathname: string, search: string) {
  if (pathname === "/admin") {
    const section = new URLSearchParams(search).get("section") || "overview";
    if (section === "users") {
      return {
        title: "Users",
        description: "Review account growth, recent users, and profile health.",
      };
    }
    if (section === "content") {
      return {
        title: "Content operations",
        description: "Monitor videos, places, routes, and publication state.",
      };
    }
    if (section === "moderation") {
      return {
        title: "Moderation home",
        description: "Keep report workflow separate from public content visibility.",
      };
    }
    if (section === "insights" || section === "analytics") {
      return {
        title: "Product insights",
        description: "Use available operational data and identify analytics gaps.",
      };
    }
    if (section === "system" || section === "admins") {
      return {
        title: "System / Observability",
        description: "Check API, Supabase, request ids, metrics, logs, and admin authorization status.",
      };
    }

    return {
      title: "Explore Admin Console",
      description: "Operate users, content, moderation, and product health.",
    };
  }

  if (pathname === "/admin/analytics") {
    return {
      title: "Analytics",
      description: "Product and ingestion insights from Explore event pipelines.",
    };
  }

  if (pathname.startsWith("/admin/reports")) {
    const params = new URLSearchParams(search);
    const status = params.get("status");
    const visibility = params.get("visibility");

    if (status === "pending") {
      return {
        title: "Pending queue",
        description: "Prioritize unresolved reports and keep global visibility decisions explicit.",
      };
    }

    if (status === "reviewed") {
      return {
        title: "Reviewed reports",
        description: "Audit report decisions that did not necessarily change public content visibility.",
      };
    }

    if (visibility === "hidden_removed") {
      return {
        title: "Removed and hidden content",
        description: "Inspect reports tied to globally hidden or removed content.",
      };
    }

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
    title: "Explore Admin Console",
    description: "Operate users, content, moderation, and product health.",
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
            className={`admin-console__link${
              isItemActive(item, location.pathname, location.search) ? " is-active" : ""
            }`}
            onClick={onNavigate}
          >
            <span className="admin-console__link-dot" aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        ) : (
          <span key={item.label} className="admin-console__link admin-console__link--disabled" aria-disabled="true">
            <span className="admin-console__link-dot" aria-hidden="true" />
            <span>{item.label}</span>
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

  const supabaseConfigured =
    Boolean(health?.supabaseUrlConfigured && health.publishableKeyConfigured && health.secretKeyConfigured) ||
    (moderationAdmin.configured && health === null);
  const adminAuthorized = moderationAdmin.status === "authorized";

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
          <p>Explore Admin Console for operations, content, moderation, and product health.</p>
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
            <span>Explore Admin Console</span>
            <h1>{meta.title}</h1>
            <p>{meta.description}</p>
          </div>

          <div className="admin-console__topbar-actions">
            <div className="admin-system-status" aria-label="System status">
              <HealthPill label="API connected" tone={health?.ok ? "ok" : healthLoading ? "warning" : "error"} />
              <HealthPill label="Supabase configured" tone={supabaseConfigured ? "ok" : "error"} />
              <HealthPill
                label="Admin authorized"
                tone={adminAuthorized ? "ok" : moderationAdmin.status === "checking" ? "warning" : "error"}
              />
            </div>

            <div className="admin-console__refresh">
              <span>Updated {formatLastUpdated(lastUpdated)}</span>
              <button
                type="button"
                className="admin-btn admin-btn--ghost admin-btn--sm"
                aria-label="Refresh admin data"
                onClick={() => void handleRefresh()}
                disabled={healthLoading}
              >
                {healthLoading ? "Refreshing..." : "Refresh"}
              </button>
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
                <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => void handleSignOut()}>
                  Sign out
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="admin-console__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
