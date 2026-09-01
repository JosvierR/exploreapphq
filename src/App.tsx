import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ModerationAdminProvider } from "@/features/admin/ModerationAdminProvider";
import { router } from "@/app/router";

export default function App() {
  return (
    <AuthProvider>
      <ModerationAdminProvider>
        <RouterProvider router={router} />
      </ModerationAdminProvider>
    </AuthProvider>
  );
}
