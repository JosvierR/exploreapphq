import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { AccessPage } from "@/pages/auth/AccessPage";
import { HomePage } from "@/pages/marketing/HomePage";
import { TermsPage } from "@/pages/marketing/TermsPage";
import { PrivacyPage } from "@/pages/marketing/PrivacyPage";
import { ThanksPage } from "@/pages/marketing/ThanksPage";
import { NotFoundPage } from "@/pages/marketing/NotFoundPage";

export const router = createBrowserRouter([
  { path: "/access", element: <AccessPage /> },
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
]);
