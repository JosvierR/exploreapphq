import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { VercelAnalytics } from "@/features/analytics/VercelAnalytics";
import { AdminErrorBoundary } from "@/features/admin/components/AdminErrorBoundary";
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
import { DownloadRedirectPage } from "@/pages/marketing/DownloadRedirectPage";
import { RouteSharePage } from "@/pages/marketing/RouteSharePage";
import { LabHomePage } from "@/features/lab/pages/LabHomePage";
import { LabIdeaPage } from "@/features/lab/pages/LabIdeaPage";
import { LabBuildingPage } from "@/features/lab/pages/LabBuildingPage";
import { LabMinePage } from "@/features/lab/pages/LabMinePage";
import UnifiedHomePage from "@/pages/marketing/UnifiedHomePage";

const AdminLayout = lazy(() => import("@/components/layout/AdminLayout").then((module) => ({ default: module.AdminLayout })));
const AdminDashboardPage = lazy(() => import("@/pages/admin/AdminDashboardPage").then((module) => ({ default: module.AdminDashboardPage })));
const AdminAnalyticsPage = lazy(() => import("@/pages/admin/AdminAnalyticsPage").then((module) => ({ default: module.AdminAnalyticsPage })));
const AdminBusinessInsightsPage = lazy(() => import("@/pages/admin/AdminBusinessInsightsPage").then((module) => ({ default: module.AdminBusinessInsightsPage })));
const AdminTourismBusinessPage = lazy(() => import("@/pages/admin/AdminTourismBusinessPage").then((module) => ({ default: module.AdminTourismBusinessPage })));
const AdminRevenuePage = lazy(() => import("@/pages/admin/AdminRevenuePage").then((module) => ({ default: module.AdminRevenuePage })));
const AdminReportBuilderPage = lazy(() => import("@/pages/admin/AdminReportBuilderPage").then((module) => ({ default: module.AdminReportBuilderPage })));
const AdminExploreLabPage = lazy(() => import("@/pages/admin/AdminExploreLabPage").then((module) => ({ default: module.AdminExploreLabPage })));
const ReportsAdminPage = lazy(() => import("@/pages/admin/ReportsAdminPage").then((module) => ({ default: module.ReportsAdminPage })));
const WaitlistAdminPage = lazy(() => import("@/pages/admin/WaitlistAdminPage").then((module) => ({ default: module.WaitlistAdminPage })));
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

function AdminRouteShell() {
  return (
    <AdminErrorBoundary>
      <LazyAdminPage>
        <AdminLayout />
      </LazyAdminPage>
    </AdminErrorBoundary>
  );
}

export const router = createBrowserRouter([
  {
    element: <AppRoot />,
    children: [
      { path: "/download", element: <DownloadRedirectPage /> },
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
        element: <AdminRouteShell />,
        children: [
          { path: "/admin", element: <LazyAdminPage><AdminDashboardPage /></LazyAdminPage> },
          { path: "/admin/analytics", element: <LazyAdminPage><AdminAnalyticsPage /></LazyAdminPage> },
          { path: "/admin/analytics/data", element: <LazyAdminPage><AdminBusinessInsightsPage /></LazyAdminPage> },
          { path: "/admin/analytics/business", element: <LazyAdminPage><AdminTourismBusinessPage /></LazyAdminPage> },
          { path: "/admin/analytics/revenue", element: <LazyAdminPage><AdminRevenuePage /></LazyAdminPage> },
          { path: "/admin/analytics/report-builder", element: <LazyAdminPage><AdminReportBuilderPage /></LazyAdminPage> },
          { path: "/admin/reports", element: <LazyAdminPage><ReportsAdminPage /></LazyAdminPage> },
          { path: "/admin/waitlist", element: <LazyAdminPage><WaitlistAdminPage /></LazyAdminPage> },
          { path: "/admin/lab", element: <LazyAdminPage><AdminExploreLabPage /></LazyAdminPage> },
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
