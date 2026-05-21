import { listWaitlistFromFirestoreAsync, type WaitlistFirestoreRow } from "./waitlistFirestore.js";

export async function listWaitlistMergedAsync() {
  const sources: string[] = [];
  let rows: (WaitlistFirestoreRow & { storage?: string })[] = [];

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const firestore = await listWaitlistFromFirestoreAsync();
    rows = firestore.rows.map((r) => ({ ...r, storage: "firestore" }));
    sources.push("firestore");
  }

  const total = rows.length;
  const notified = rows.filter((r) => r.launchNotifiedAt).length;

  return {
    stats: { total, pendingLaunch: total - notified, notified },
    rows,
    source: sources.join(" + ") || "local-json-only",
  };
}

export async function listPendingLaunchEmailsMergedAsync(): Promise<string[]> {
  const { rows } = await listWaitlistMergedAsync();
  return rows.filter((r) => !r.launchNotifiedAt).map((r) => r.email);
}
