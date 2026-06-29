import { useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";

/**
 * Vercel Web Analytics for React Router (SPA).
 * Pass route + path so page views update on client navigation.
 * @see https://vercel.com/docs/analytics/package
 */
export function VercelAnalytics() {
  const { pathname, search } = useLocation();

  return <Analytics route={pathname} path={`${pathname}${search}`} framework="react" />;
}
