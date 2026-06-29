import { getHardcodedAdminSession, hardcodedAdminToken } from "@/lib/hardcodedAdmin";
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
  phone?: string;
  email: string;
  createdAt: string | null;
  launchNotifiedAt?: string | null;
  seqStep?: number;
  created_at?: string;
  launch_notified_at?: string | null;
  storage?: string;
};

export type EmailStatus = {
  ready: boolean;
  from: string;
  mailDomain?: string;
  reason?: string;
};

export type SmsStatus = {
  ready: boolean;
  from?: string;
  reason?: string;
};

const NOTIFY_LAUNCH_PATH = "/api/admin/waitlist/notify-launch";
const WAITLIST_PATH = "/api/admin/waitlist";
const BROADCAST_PATH = "/api/admin/broadcast";

async function getAdminToken(): Promise<string> {
  if (getHardcodedAdminSession()) {
    return hardcodedAdminToken();
  }
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
  warnings?: string[];
  message?: string;
  emailStatus?: EmailStatus;
  smsStatus?: SmsStatus;
};

function waitlistApiPaths(): readonly string[] {
  return [WAITLIST_PATH];
}

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

/** POST notify-launch */
async function adminPostNotify(dryRun: boolean): Promise<AdminJson> {
  const token = await getAdminToken();
  const body = JSON.stringify(dryRun ? { dryRun: true } : {});
  const url = dryRun ? `${NOTIFY_LAUNCH_PATH}?dryRun=1` : NOTIFY_LAUNCH_PATH;

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

  throw new Error(
    data.error ??
      `Could not reach launch email service. Add FIREBASE_SERVICE_ACCOUNT_JSON and redeploy.`,
  );
}

async function fetchStatusesFromApi(): Promise<{
  emailStatus?: EmailStatus;
  smsStatus?: SmsStatus;
}> {
  for (const path of waitlistApiPaths()) {
    try {
      const data = await adminFetch(path);
      if (data.emailStatus || data.smsStatus) {
        return { emailStatus: data.emailStatus, smsStatus: data.smsStatus };
      }
    } catch {
      /* try next */
    }
  }
  return {};
}

function normalizeRow(row: WaitlistRow) {
  return {
    id: row.id,
    phone: row.phone ?? "",
    email: row.email ?? "",
    createdAt: row.createdAt ?? row.created_at ?? null,
    launchNotifiedAt: row.launchNotifiedAt ?? row.launch_notified_at ?? null,
    seqStep: row.seqStep ?? 0,
    storage: row.storage,
  };
}

export async function fetchAdminWaitlist() {
  if (isFirebaseConfigured() && getFirebaseAuth().currentUser) {
    try {
      const direct = await fetchWaitlistFromFirestoreClient();
      if (direct.rows.length > 0) {
        const statuses = await fetchStatusesFromApi();
        return { ...direct, ...statuses, source: "firestore (admin login)" };
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

  for (const path of waitlistApiPaths()) {
    try {
      const data = await adminFetch(path);
      const rows = (data.rows ?? []).map(normalizeRow);
      return {
        stats: data.stats ?? { total: rows.length, pendingLaunch: 0, notified: 0 },
        rows,
        emailStatus: data.emailStatus,
        smsStatus: data.smsStatus,
        source: (data as { source?: string }).source ?? "api",
      };
    } catch (err) {
      if ((err as Error & { status?: number }).status === 503) throw err;
    }
  }

  if (isFirebaseConfigured() && getFirebaseAuth().currentUser) {
    const direct = await fetchWaitlistFromFirestoreClient();
    const statuses = await fetchStatusesFromApi();
    return { ...direct, ...statuses, source: "firestore (fallback)" };
  }

  throw new Error("Could not load waitlist from API or Firestore.");
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

export type BroadcastPayload = {
  smsBody?: string;
  emailSubject?: string;
  emailBody?: string;
  dryRun?: boolean;
};

export type BroadcastResult = {
  dryRun?: boolean;
  smsRecipients?: number;
  emailRecipients?: number;
  smsSent?: number;
  emailSent?: number;
  smsFailed?: { to: string; error: string }[];
  emailFailed?: { to: string; error: string }[];
  smsError?: string;
  emailError?: string;
  message?: string;
  error?: string;
};

const broadcastPaths = (): readonly string[] => [BROADCAST_PATH];

export async function previewBroadcast(payload: BroadcastPayload): Promise<BroadcastResult> {
  return adminPostBroadcast({ ...payload, dryRun: true });
}

export async function sendBroadcast(payload: BroadcastPayload): Promise<BroadcastResult> {
  return adminPostBroadcast({ ...payload, dryRun: false });
}

async function adminPostBroadcast(payload: BroadcastPayload): Promise<BroadcastResult> {
  const token = await getAdminToken();
  let lastError = "Could not reach broadcast service.";

  for (const path of broadcastPaths()) {
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as BroadcastResult;
      if (res.ok) return data;
      lastError = data.error ?? lastError;
      if (res.status !== 404) throw new Error(lastError);
    } catch (err) {
      if (err instanceof Error && err.message !== lastError) throw err;
    }
  }
  throw new Error(lastError);
}
