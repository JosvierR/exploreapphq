import { listWaitlistFromBlobs } from "./waitlistBlobs.mjs";
import { listWaitlistFromFirestore } from "./waitlistFirestore.mjs";

export async function listWaitlistMerged() {
  const sources = [];
  let firestoreRows = [];

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const firestore = await listWaitlistFromFirestore();
      firestoreRows = firestore.rows.map((r) => ({ ...r, storage: "firestore" }));
      sources.push("firestore");
    } catch (err) {
      console.error("[waitlist] Firestore:", err);
      if (!process.env.NETLIFY) throw err;
    }
  }

  const blobRows = await listWaitlistFromBlobs();
  if (blobRows.length) sources.push("netlify-blobs");

  const byEmail = new Map();

  for (const row of firestoreRows) {
    byEmail.set(row.email.toLowerCase(), row);
  }

  for (const row of blobRows) {
    const key = row.email.toLowerCase();
    if (!byEmail.has(key)) {
      byEmail.set(key, row);
    } else {
      const existing = byEmail.get(key);
      if (!existing.createdAt && row.createdAt) {
        existing.createdAt = row.createdAt;
      }
      existing.storage = "firestore+blobs";
    }
  }

  const rows = [...byEmail.values()].sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || ""),
  );

  const total = rows.length;
  const notified = rows.filter((r) => r.launchNotifiedAt).length;

  return {
    stats: { total, pendingLaunch: total - notified, notified },
    rows,
    source: sources.length ? sources.join(" + ") : "none",
  };
}

export async function listPendingLaunchEmailsMerged() {
  const { rows } = await listWaitlistMerged();
  return rows.filter((r) => !r.launchNotifiedAt).map((r) => r.email);
}
