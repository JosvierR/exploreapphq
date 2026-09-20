import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { VercelAnalytics } from "@/features/analytics/VercelAnalytics";
import { AdminErrorBoundary } from "@/features/admin/components/AdminErrorBoundary";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { AccessPage } from "@/pages/auth/AccessPage";
import { ChallengeMissionPage } from "@/features/pioneers";
import { TermsPage } from "@/pages/marketing/TermsPage";
import { PrivacyPage } from "@/pages/marketing/PrivacyPage";
import { SafetyPage } from "@/pages/marketing/SafetyPage";
import { ThanksPage } from "@/pages/marketing/ThanksPage";
import { FeedbackPage } from "@/pages/marketing/FeedbackPage";
import { NotFoundPage } from "@/pages/marketing/NotFoundPage";
import { DeepLinkFallbackPage } from "@/pages/marketing/DeepLinkFallbackPage";
import { RouteSharePage } from "@/pages/marketing/RouteSharePage";
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";
import { AdminAnalyticsPage } from "@/pages/admin/AdminAnalyticsPage";
import { AdminBusinessInsightsPage } from "@/pages/admin/AdminBusinessInsightsPage";
import { AdminTourismBusinessPage } from "@/pages/admin/AdminTourismBusinessPage";
import { AdminExploreLabPage } from "@/pages/admin/AdminExploreLabPage";
import { ReportsAdminPage } from "@/pages/admin/ReportsAdminPage";
import { WaitlistAdminPage } from "@/pages/admin/WaitlistAdminPage";
import { LabHomePage } from "@/features/lab/pages/LabHomePage";
import { LabIdeaPage } from "@/features/lab/pages/LabIdeaPage";
import { LabBuildingPage } from "@/features/lab/pages/LabBuildingPage";
import { LabMinePage } from "@/features/lab/pages/LabMinePage";
import UnifiedHomePage from "@/pages/marketing/UnifiedHomePage";

const ApiDocsPage = lazy(() => import("@/pages/admin/ApiDocsPage"));
function AppRoot() {
  return (
    <I18nProvider>
      <Outlet />
      <VercelAnalytics />
    </I18nProvider>
  );
}

function LazyAdminPage({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="admin-page" aria-busy="true">Loading…</div>}>
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    element: <AppRoot />,
    children: [
      { path: "/access", element: <AccessPage /> },
      { path: "/feedback/*", element: <FeedbackPage /> },
      { path: "/team", element: <Navigate to="/admin" replace /> },
      { path: "/challenges/:type", element: <ChallengeMissionPage /> },
      { path: "/v/:videoId", element: <DeepLinkFallbackPage kind="video" paramName="videoId" /> },
      { path: "/p/:placeId", element: <DeepLinkFallbackPage kind="place" paramName="placeId" /> },
      { path: "/r/:routeId", element: <RouteSharePage /> },
      { path: "/go/:routeId", element: <RouteSharePage /> },
      { path: "/u/:handleOrUserId", element: <DeepLinkFallbackPage kind="profile" paramName="handleOrUserId" /> },
      { path: "/me", element: <DeepLinkFallbackPage kind="me" /> },
      { path: "/video/:videoId", element: <DeepLinkFallbackPage kind="video" paramName="videoId" /> },
      { path: "/place/:placeId", element: <DeepLinkFallbackPage kind="place" paramName="placeId" /> },
      { path: "/route/:routeId", element: <RouteSharePage /> },
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
          { path: "/admin/analytics/data", element: <AdminBusinessInsightsPage /> },
          { path: "/admin/analytics/business", element: <AdminTourismBusinessPage /> },
          { path: "/admin/reports", element: <ReportsAdminPage /> },
          { path: "/admin/waitlist", element: <WaitlistAdminPage /> },
          { path: "/admin/lab", element: <AdminExploreLabPage /> },
          {
            path: "/admin/api-docs",
            element: (
              <LazyAdminPage>
                <ApiDocsPage />
              </LazyAdminPage>
            ),
          },
        ],
      },
      {
        element: <MarketingLayout />,
        children: [
          { path: "/", element: <UnifiedHomePage /> },
          { path: "/pioneros", element: <Navigate to="/" replace /> },
          { path: "/explorar", element: <Navigate to="/" replace /> },
          { path: "/lab", element: <LabHomePage /> },
          { path: "/lab/building", element: <LabBuildingPage /> },
          { path: "/lab/roadmap", element: <Navigate to="/lab/building" replace /> },
          { path: "/lab/mine", element: <LabMinePage /> },
          { path: "/lab/ideas/:ideaId", element: <LabIdeaPage /> },
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
