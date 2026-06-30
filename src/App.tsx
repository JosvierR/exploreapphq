import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ModerationAdminProvider } from "@/features/admin/ModerationAdminProvider";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { router } from "@/app/router";

export default function App() {
  return (
    <AuthProvider>
      <ModerationAdminProvider>
        <I18nProvider>
          <RouterProvider router={router} />
        </I18nProvider>
      </ModerationAdminProvider>
    </AuthProvider>
  );
}
