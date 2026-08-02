import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
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

type VerifyMode = "hard" | "soft";

type ModerationAdminState = {
  status: AdminStatus;
  session: Session | null;
  user: User | null;
  admin: AdminMe | null;
  error: string | null;
  configured: boolean;
  /** True while a background soft re-check is in flight; UI should stay authorized. */
  sessionRefreshing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const ModerationAdminContext = createContext<ModerationAdminState | null>(null);

/** Skip duplicate soft `/api/admin/me` calls on tab focus / token refresh storms. */
const VERIFY_COOLDOWN_MS = 20_000;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function logAuthError(error: unknown) {
  if (!import.meta.env.DEV) return;
  console.error("[supabase-admin] signInWithPassword failed", error);
}

function isSoftAuthEvent(event: AuthChangeEvent) {
  return event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION";
}

export function ModerationAdminProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseBrowserConfigured();
  const [status, setStatus] = useState<AdminStatus>(configured ? "checking" : "not_configured");
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState<AdminMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionRefreshing, setSessionRefreshing] = useState(false);

  const adminRef = useRef<AdminMe | null>(null);
  const statusRef = useRef<AdminStatus>(status);
  const lastSuccessAtRef = useRef(0);
  const lastUserIdRef = useRef<string | null>(null);
  const verifyInFlightRef = useRef(0);

  useEffect(() => {
    adminRef.current = admin;
  }, [admin]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const verifySession = useCallback(async (nextSession: Session | null, mode: VerifyMode = "hard") => {
    setSession(nextSession);

    if (!configured) {
      setAdmin(null);
      setError(null);
      setSessionRefreshing(false);
      setStatus("not_configured");
      lastUserIdRef.current = null;
      return;
    }

    if (!nextSession?.access_token) {
      setAdmin(null);
      setError(null);
      setSessionRefreshing(false);
      setStatus("logged_out");
      lastUserIdRef.current = null;
      lastSuccessAtRef.current = 0;
      return;
    }

    const userId = nextSession.user?.id ?? null;
    const sameUser = Boolean(userId && userId === lastUserIdRef.current);
    const alreadyAuthorized = statusRef.current === "authorized" && Boolean(adminRef.current);
    const soft = mode === "soft" && sameUser && alreadyAuthorized;
    const withinCooldown = Date.now() - lastSuccessAtRef.current < VERIFY_COOLDOWN_MS;

    if (soft && withinCooldown) {
      // Keep current authorized UI; skip redundant network verify on focus storms.
      return;
    }

    const requestId = ++verifyInFlightRef.current;

    if (soft) {
      setSessionRefreshing(true);
      setError(null);
    } else {
      setAdmin(null);
      setError(null);
      setSessionRefreshing(false);
      setStatus("checking");
    }

    try {
      const me = await fetchAdminMe(nextSession.access_token);
      if (requestId !== verifyInFlightRef.current) return;
      setAdmin(me);
      setError(null);
      setStatus("authorized");
      lastSuccessAtRef.current = Date.now();
      lastUserIdRef.current = userId;
    } catch (err) {
      if (requestId !== verifyInFlightRef.current) return;
      const httpStatus = err instanceof AdminApiError ? err.status : undefined;
      const message = err instanceof Error ? err.message : "Could not verify admin access.";

      if (soft && httpStatus !== 401 && httpStatus !== 403) {
        // Transient API blip during soft refresh: keep authorized UI, surface non-blocking error.
        setError(message);
        setStatus("authorized");
        return;
      }

      setAdmin(null);
      setError(message);
      if (httpStatus === 403) setStatus("denied");
      else if (httpStatus === 500) setStatus("supabase_unavailable");
      else if (!httpStatus) setStatus("api_unavailable");
      else setStatus("logged_out");
      lastUserIdRef.current = null;
      lastSuccessAtRef.current = 0;
    } finally {
      if (requestId === verifyInFlightRef.current) {
        setSessionRefreshing(false);
      }
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
      if (active) void verifySession(data.session, "hard");
    });

    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        void verifySession(null, "hard");
        return;
      }
      if (isSoftAuthEvent(event)) {
        void verifySession(nextSession, "soft");
        return;
      }
      // SIGNED_IN after password login is handled by signIn(); still soft if same user already authorized.
      const softSameUser =
        Boolean(nextSession?.user?.id) &&
        nextSession?.user?.id === lastUserIdRef.current &&
        statusRef.current === "authorized";
      void verifySession(nextSession, softSameUser ? "soft" : "hard");
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
    await verifySession(data.session, "hard");
  }, [configured, verifySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!configured) {
      throw new Error("Supabase browser config is missing.");
    }

    setStatus("checking");
    setError(null);
    setSessionRefreshing(false);
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

    await verifySession(data.session, "hard");
  }, [configured, verifySession]);

  const signOut = useCallback(async () => {
    if (configured) {
      await getSupabaseBrowserClient().auth.signOut();
    }
    setSession(null);
    setAdmin(null);
    setError(null);
    setSessionRefreshing(false);
    setStatus(configured ? "logged_out" : "not_configured");
    lastUserIdRef.current = null;
    lastSuccessAtRef.current = 0;
  }, [configured]);

  const value = useMemo(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      admin,
      error,
      configured,
      sessionRefreshing,
      signIn,
      signOut,
      refresh,
    }),
    [admin, configured, error, refresh, session, sessionRefreshing, signIn, signOut, status],
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
