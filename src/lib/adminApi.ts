import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

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

async function adminFetch(path: string, init?: RequestInit) {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured.");
  }
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error("Sign in at /team first.");
  }
  const token = await user.getIdToken();

  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers as Record<string, string>),
    },
  });

  const data = (await res.json().catch(() => ({}))) as {
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

  if (!res.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data;
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
  const data = await adminFetch("/api/admin/waitlist");
  const rows = (data.rows ?? []).map(normalizeRow);
  return {
    stats: data.stats ?? { total: rows.length, pendingLaunch: 0, notified: 0 },
    rows,
    source: (data as { source?: string }).source,
  };
}

export async function previewLaunchNotify() {
  return adminFetch("/api/admin/waitlist/notify-launch?dryRun=1", {
    method: "POST",
    body: JSON.stringify({ dryRun: true }),
  });
}

export async function sendLaunchNotify() {
  return adminFetch("/api/admin/waitlist/notify-launch", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
