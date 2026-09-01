import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LAB_BUILDING_PATH, LAB_MINE_PATH, LAB_PATH } from "../lib/paths";
import "@/styles/lab.css";

const NAV = [
  { to: LAB_PATH, label: "Forum", match: (p: string) => p === LAB_PATH },
  {
    to: LAB_BUILDING_PATH,
    label: "Building",
    match: (p: string) => p.startsWith(LAB_BUILDING_PATH) || p.startsWith("/lab/roadmap"),
  },
  { to: LAB_MINE_PATH, label: "My ideas", match: (p: string) => p.startsWith(LAB_MINE_PATH) },
] as const;

type Props = {
  children: ReactNode;
  wide?: boolean;
  showNav?: boolean;
};

export function LabPageShell({ children, wide = false, showNav = true }: Props) {
  const { pathname } = useLocation();

  return (
    <div className="lab-page">
      <div className={`lab-shell${wide ? " lab-shell--wide" : ""}`}>
        {showNav ? (
          <nav className="lab-nav" aria-label="Explore Lab">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={item.match(pathname) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
        {children}
      </div>
    </div>
  );
}
