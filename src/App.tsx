import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { router } from "@/app/router";

export default function App() {
  return (
    <AuthProvider>
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>
    </AuthProvider>
  );
}
