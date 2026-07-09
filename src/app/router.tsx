import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { VercelAnalytics } from "@/features/analytics/VercelAnalytics";
import { AdminErrorBoundary } from "@/features/admin/components/AdminErrorBoundary";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { AccessPage } from "@/pages/auth/AccessPage";
import { PioneersPage } from "@/pages/marketing/PioneersPage";
import { TermsPage } from "@/pages/marketing/TermsPage";
import { PrivacyPage } from "@/pages/marketing/PrivacyPage";
import { SafetyPage } from "@/pages/marketing/SafetyPage";
import { ThanksPage } from "@/pages/marketing/ThanksPage";
import { FeedbackPage } from "@/pages/marketing/FeedbackPage";
import { NotFoundPage } from "@/pages/marketing/NotFoundPage";
import { DeepLinkFallbackPage } from "@/pages/marketing/DeepLinkFallbackPage";
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";
import { AdminAnalyticsPage } from "@/pages/admin/AdminAnalyticsPage";
import { AdminBusinessInsightsPage } from "@/pages/admin/AdminBusinessInsightsPage";
import { ReportsAdminPage } from "@/pages/admin/ReportsAdminPage";
import { WaitlistAdminPage } from "@/pages/admin/WaitlistAdminPage";

const HomePage = lazy(() => import("@/pages/marketing/HomePage"));
const HomePageLegacy = lazy(() => import("@/pages/marketing/legacy/HomePageLegacy"));

function AppRoot() {
  return (
    <>
      <Outlet />
      <VercelAnalytics />
    </>
  );
}

function LazyMarketingPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main aria-busy="true" />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  {
    element: <AppRoot />,
    children: [
      { path: "/access", element: <AccessPage /> },
      { path: "/feedback/*", element: <FeedbackPage /> },
      { path: "/team", element: <Navigate to="/admin" replace /> },
      { path: "/v/:videoId", element: <DeepLinkFallbackPage kind="video" paramName="videoId" /> },
      { path: "/p/:placeId", element: <DeepLinkFallbackPage kind="place" paramName="placeId" /> },
      { path: "/r/:routeId", element: <DeepLinkFallbackPage kind="route" paramName="routeId" /> },
      { path: "/u/:handleOrUserId", element: <DeepLinkFallbackPage kind="profile" paramName="handleOrUserId" /> },
      { path: "/me", element: <DeepLinkFallbackPage kind="me" /> },
      { path: "/video/:videoId", element: <DeepLinkFallbackPage kind="video" paramName="videoId" /> },
      { path: "/place/:placeId", element: <DeepLinkFallbackPage kind="place" paramName="placeId" /> },
      { path: "/route/:routeId", element: <DeepLinkFallbackPage kind="route" paramName="routeId" /> },
      { path: "/profile/:handleOrUserId", element: <DeepLinkFallbackPage kind="profile" paramName="handleOrUserId" /> },
      { path: "/users/:handleOrUserId", element: <DeepLinkFallbackPage kind="profile" paramName="handleOrUserId" /> },
      {
        element: (
          <AdminErrorBoundary>
            <AdminLayout />
          </AdminErrorBoundary>
        ),
        children: [
          { path: "/admin", element: <AdminDashboardPage /> },
          { path: "/admin/analytics", element: <AdminAnalyticsPage /> },
          { path: "/admin/analytics/business", element: <AdminBusinessInsightsPage /> },
          { path: "/admin/reports", element: <ReportsAdminPage /> },
          { path: "/admin/waitlist", element: <WaitlistAdminPage /> },
        ],
      },
      {
        element: <MarketingLayout />,
        children: [
          { path: "/", element: <PioneersPage /> },
          { path: "/pioneros", element: <Navigate to="/" replace /> },
          {
            path: "/explorar",
            element: (
              <LazyMarketingPage>
                <HomePage />
              </LazyMarketingPage>
            ),
          },
          {
            path: "/home-classic",
            element: (
              <LazyMarketingPage>
                <HomePageLegacy />
              </LazyMarketingPage>
            ),
          },
          { path: "/terms", element: <TermsPage /> },
          { path: "/privacy", element: <PrivacyPage /> },
          { path: "/safety", element: <SafetyPage /> },
          { path: "/thanks", element: <ThanksPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
