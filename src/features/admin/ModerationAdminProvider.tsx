import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { AdminApiError, fetchAdminMe, type AdminMe } from "@/lib/moderationAdminApi";
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabaseClient";

type AdminStatus =
  | "not_configured"
  | "checking"
  | "logged_out"
  | "authorized"
  | "denied"
  | "api_unavailable"
  | "supabase_unavailable";

type ModerationAdminState = {
  status: AdminStatus;
  session: Session | null;
  user: User | null;
  admin: AdminMe | null;
  error: string | null;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const ModerationAdminContext = createContext<ModerationAdminState | null>(null);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function logAuthError(error: unknown) {
  if (!import.meta.env.DEV) return;
  console.error("[supabase-admin] signInWithPassword failed", error);
}

export function ModerationAdminProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseBrowserConfigured();
  const [status, setStatus] = useState<AdminStatus>(configured ? "checking" : "not_configured");
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState<AdminMe | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifySession = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    setAdmin(null);
    setError(null);

    if (!configured) {
      setStatus("not_configured");
      return;
    }

    if (!nextSession?.access_token) {
      setStatus("logged_out");
      return;
    }

    setStatus("checking");
    try {
      const me = await fetchAdminMe(nextSession.access_token);
      setAdmin(me);
      setStatus("authorized");
    } catch (err) {
      const httpStatus = err instanceof AdminApiError ? err.status : undefined;
      setError(err instanceof Error ? err.message : "Could not verify admin access.");
      if (httpStatus === 403) setStatus("denied");
      else if (httpStatus === 500) setStatus("supabase_unavailable");
      else if (!httpStatus) setStatus("api_unavailable");
      else setStatus("logged_out");
    }
  }, [configured]);

  useEffect(() => {
    if (!configured) {
      setStatus("not_configured");
      return;
    }

    const client = getSupabaseBrowserClient();
    let active = true;

    client.auth.getSession().then(({ data }) => {
      if (active) void verifySession(data.session);
    });

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      void verifySession(nextSession);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [configured, verifySession]);

  const refresh = useCallback(async () => {
    if (!configured) {
      setStatus("not_configured");
      return;
    }

    const { data } = await getSupabaseBrowserClient().auth.getSession();
    await verifySession(data.session);
  }, [configured, verifySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!configured) {
      throw new Error("Supabase browser config is missing.");
    }

    setStatus("checking");
    setError(null);
    const normalizedEmail = normalizeEmail(email);
    const { data, error: authError } = await getSupabaseBrowserClient().auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (authError) {
      logAuthError(authError);
      setStatus("logged_out");
      setError("Incorrect email or password.");
      throw authError;
    }

    await verifySession(data.session);
  }, [configured, verifySession]);

  const signOut = useCallback(async () => {
    if (configured) {
      await getSupabaseBrowserClient().auth.signOut();
    }
    setSession(null);
    setAdmin(null);
    setError(null);
    setStatus(configured ? "logged_out" : "not_configured");
  }, [configured]);

  const value = useMemo(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      admin,
      error,
      configured,
      signIn,
      signOut,
      refresh,
    }),
    [admin, configured, error, refresh, session, signIn, signOut, status],
  );

  return (
    <ModerationAdminContext.Provider value={value}>
      {children}
    </ModerationAdminContext.Provider>
  );
}

export function useModerationAdmin() {
  const context = useContext(ModerationAdminContext);
  if (!context) {
    throw new Error("useModerationAdmin must be used within ModerationAdminProvider");
  }
  return context;
}
