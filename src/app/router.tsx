import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { VercelAnalytics } from "@/features/analytics/VercelAnalytics";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { AccessPage } from "@/pages/auth/AccessPage";
import { TeamLoginPage } from "@/pages/auth/TeamLoginPage";
import { HomePage } from "@/pages/marketing/HomePage";
import { TermsPage } from "@/pages/marketing/TermsPage";
import { PrivacyPage } from "@/pages/marketing/PrivacyPage";
import { ThanksPage } from "@/pages/marketing/ThanksPage";
import { FeedbackPage } from "@/pages/marketing/FeedbackPage";
import { NotFoundPage } from "@/pages/marketing/NotFoundPage";
import { WaitlistAdminPage } from "@/pages/admin/WaitlistAdminPage";

function AppRoot() {
  return (
    <>
      <Outlet />
      <VercelAnalytics />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <AppRoot />,
    children: [
  { path: "/access", element: <AccessPage /> },
  { path: "/feedback/*", element: <FeedbackPage /> },
  { path: "/team", element: <TeamLoginPage /> },
  {
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [{ path: "/admin/waitlist", element: <WaitlistAdminPage /> }],
  },
  {
    element: (
      <ProtectedRoute>
        <MarketingLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/terms", element: <TermsPage /> },
      { path: "/privacy", element: <PrivacyPage /> },
      { path: "/thanks", element: <ThanksPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/access" replace /> },
    ],
  },
]);
