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
      throw err;
    }
  }

  const blobRows = await listWaitlistFromBlobs();
  if (blobRows.length) sources.push("netlify-blobs");

  const byId = new Map();
  const keyOf = (row) => String(row.id || row.phone || row.email || "").toLowerCase();

  for (const row of firestoreRows) {
    byId.set(keyOf(row), row);
  }

  for (const row of blobRows) {
    const key = keyOf(row);
    if (!byId.has(key)) {
      byId.set(key, row);
    } else {
      const existing = byId.get(key);
      if (!existing.createdAt && row.createdAt) existing.createdAt = row.createdAt;
      if (!existing.phone && row.phone) existing.phone = row.phone;
      if (!existing.email && row.email) existing.email = row.email;
      existing.storage = "firestore+blobs";
    }
  }

  const rows = [...byId.values()].sort((a, b) =>
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
  return rows
    .filter((r) => !r.launchNotifiedAt && r.email)
    .map((r) => r.email);
}
