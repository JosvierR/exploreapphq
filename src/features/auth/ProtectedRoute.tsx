import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading__spinner" aria-hidden="true" />
        <p>Loading…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/access" replace state={{ from: location.pathname }} />;
  }

  return children;
}
