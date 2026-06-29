import { useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

/**
 * Vercel Web Analytics + Speed Insights for React Router (SPA).
 * Pass route so metrics update on client navigation.
 */
export function VercelAnalytics() {
  const { pathname, search } = useLocation();

  return (
    <>
      <Analytics route={pathname} path={`${pathname}${search}`} framework="react" />
      <SpeedInsights route={pathname} framework="react" />
    </>
  );
}
