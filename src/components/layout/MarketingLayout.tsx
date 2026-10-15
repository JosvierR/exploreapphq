import { Outlet, useLocation } from "react-router-dom";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

/** Layout for marketing pages (landing, legal, etc.) */
export function MarketingLayout() {
  const { pathname } = useLocation();

  // The home includes its own header; other marketing pages keep their shared shell.
  if (pathname === "/") return <Outlet />;

  return (
    <>
      <SiteHeader />
      <Outlet />
      <SiteFooter />
    </>
  );
}
