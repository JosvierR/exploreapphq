import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiUrl } from "@/lib/api";
import { clearToken, getToken, setToken } from "./authStorage";

type AuthState = {
  isAdmin: boolean;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const verify = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(apiUrl("/api/me"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("invalid");
      setIsAdmin(true);
    } catch {
      clearToken();
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    verify();
  }, [verify]);

  const login = useCallback((token: string) => {
    setToken(token);
    setIsAdmin(true);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setIsAdmin(false);
  }, []);

  const value = useMemo(
    () => ({ isAdmin, isLoading, login, logout }),
    [isAdmin, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
