import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import {
  fetchWaitlistFromFirestoreClient,
  listPendingEmailsFromClient,
} from "@/lib/waitlistFirestoreClient";

export type WaitlistStats = {
  total: number;
  pendingLaunch: number;
  notified: number;
};

export type WaitlistRow = {
  id?: string | number;
  email: string;
  createdAt: string | null;
  launchNotifiedAt?: string | null;
  created_at?: string;
  launch_notified_at?: string | null;
  storage?: string;
};

const NOTIFY_ENDPOINTS = [
  "/.netlify/functions/admin-notify-launch",
  "/api/admin/waitlist/notify-launch",
] as const;

async function getAdminToken(): Promise<string> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured.");
  }
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error("Sign in at /team first.");
  }
  return user.getIdToken();
}

type AdminJson = {
  error?: string;
  configMissing?: boolean;
  stats?: WaitlistStats;
  rows?: WaitlistRow[];
  dryRun?: boolean;
  count?: number;
  emails?: string[];
  sent?: string[];
  failed?: { email: string; error: string }[];
  message?: string;
};

async function adminFetch(path: string, init?: RequestInit): Promise<AdminJson> {
  const token = await getAdminToken();

  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers as Record<string, string>),
    },
  });

  const data = (await res.json().catch(() => ({}))) as AdminJson;

  if (!res.ok) {
    const err = new Error(data.error ?? `Request failed (${res.status}).`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  return data;
}

/** POST notify-launch — tries Netlify function URL first (avoids 404 from SPA redirects). */
async function adminPostNotify(dryRun: boolean): Promise<AdminJson> {
  const token = await getAdminToken();
  const body = JSON.stringify(dryRun ? { dryRun: true } : {});
  let lastError = "Could not reach launch email service.";

  for (const path of NOTIFY_ENDPOINTS) {
    const url = dryRun ? `${path}?dryRun=1` : path;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body,
      });

      const data = (await res.json().catch(() => ({}))) as AdminJson;

      if (res.ok) {
        return data;
      }

      lastError = data.error ?? `Request failed (${res.status}).`;
      if (res.status !== 404 && res.status !== 405) {
        throw new Error(lastError);
      }
    } catch (err) {
      if (err instanceof Error && err.message !== lastError) {
        lastError = err.message;
      }
    }
  }

  throw new Error(
    `${lastError} Add FIREBASE_SERVICE_ACCOUNT_JSON on Netlify and redeploy, or check Functions → admin-notify-launch.`,
  );
}

function normalizeRow(row: WaitlistRow) {
  return {
    email: row.email,
    createdAt: row.createdAt ?? row.created_at ?? null,
    launchNotifiedAt: row.launchNotifiedAt ?? row.launch_notified_at ?? null,
    storage: row.storage,
  };
}

export async function fetchAdminWaitlist() {
  if (isFirebaseConfigured() && getFirebaseAuth().currentUser) {
    try {
      const direct = await fetchWaitlistFromFirestoreClient();
      if (direct.rows.length > 0) {
        return { ...direct, source: "firestore (admin login)" };
      }
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "permission-denied") {
        throw new Error(
          "Firestore blocked read. Deploy firestore.rules and sign in again at /team.",
        );
      }
      console.warn("[waitlist] Direct Firestore read failed:", err);
    }
  }

  try {
    const data = await adminFetch("/api/admin/waitlist");
    const rows = (data.rows ?? []).map(normalizeRow);
    return {
      stats: data.stats ?? { total: rows.length, pendingLaunch: 0, notified: 0 },
      rows,
      source: (data as { source?: string }).source ?? "api",
    };
  } catch (err) {
    if (isFirebaseConfigured() && getFirebaseAuth().currentUser) {
      const direct = await fetchWaitlistFromFirestoreClient();
      return { ...direct, source: "firestore (fallback)" };
    }
    throw err;
  }
}

export async function previewLaunchNotify() {
  try {
    return await adminPostNotify(true);
  } catch {
    const emails = await listPendingEmailsFromClient();
    return { dryRun: true, count: emails.length, emails };
  }
}

export async function sendLaunchNotify() {
  return adminPostNotify(false);
}
