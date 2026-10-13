import { RouterProvider } from "react-router-dom";
import { ModerationAdminProvider } from "@/features/admin/ModerationAdminProvider";
import { router } from "@/app/router";

export default function App() {
  return (
    <ModerationAdminProvider>
      <RouterProvider router={router} />
    </ModerationAdminProvider>
  );
}
