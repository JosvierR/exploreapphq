import { onAuthStateChanged, type User } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isAdminEmail } from "@/lib/admin";
import {
  clearHardcodedAdminSession,
  getHardcodedAdminSession,
} from "@/lib/hardcodedAdmin";
import { firebaseSignOut } from "@/features/auth/firebaseAuth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

type AuthState = {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  firebaseReady: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hardcodedEmail, setHardcodedEmail] = useState<string | null>(() =>
    getHardcodedAdminSession(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    const syncHardcoded = () => setHardcodedEmail(getHardcodedAdminSession());
    window.addEventListener("explore-admin-session", syncHardcoded);
    return () => window.removeEventListener("explore-admin-session", syncHardcoded);
  }, []);

  useEffect(() => {
    if (!firebaseReady) {
      setIsLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (next: User | null) => {
      if (next && !isAdminEmail(next.email)) {
        firebaseSignOut().finally(() => {
          setUser(null);
          setIsLoading(false);
        });
        return;
      }
      setUser(next);
      setIsLoading(false);
    });

    return () => unsub();
  }, [firebaseReady]);

  const logout = useCallback(async () => {
    clearHardcodedAdminSession();
    setHardcodedEmail(null);
    if (firebaseReady) await firebaseSignOut();
    setUser(null);
  }, [firebaseReady]);

  const isAdmin = Boolean(
    (user && isAdminEmail(user.email)) || isAdminEmail(hardcodedEmail),
  );

  const value = useMemo(
    () => ({ user, isAdmin, isLoading, firebaseReady, logout }),
    [user, isAdmin, isLoading, firebaseReady, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
