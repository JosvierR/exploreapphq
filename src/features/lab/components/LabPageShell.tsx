import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LAB_BUILDING_PATH, LAB_MINE_PATH, LAB_PATH } from "../lib/paths";
import { useI18n } from "@/features/i18n/I18nProvider";
import "@/styles/lab.css";

type Props = {
  children: ReactNode;
  wide?: boolean;
  showNav?: boolean;
};

export function LabPageShell({ children, wide = false, showNav = true }: Props) {
  const { pathname } = useLocation();
  const { t } = useI18n();

  const NAV = [
    { to: LAB_PATH, label: t("lab.nav.forum"), match: (p: string) => p === LAB_PATH },
    {
      to: LAB_BUILDING_PATH,
      label: t("lab.nav.building"),
      match: (p: string) => p.startsWith(LAB_BUILDING_PATH) || p.startsWith("/lab/roadmap"),
    },
    { to: LAB_MINE_PATH, label: t("lab.nav.mine"), match: (p: string) => p.startsWith(LAB_MINE_PATH) },
  ] as const;

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
