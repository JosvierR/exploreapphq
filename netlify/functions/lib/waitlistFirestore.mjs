import { FieldValue } from "firebase-admin/firestore";
import { getFirestoreAdmin } from "./firebaseAdmin.mjs";

export async function listWaitlistFromFirestore() {
  const db = getFirestoreAdmin();
  const snap = await db.collection("waitlist").get();

  const rows = snap.docs.map((doc) => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.()
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || null;
    const launchNotifiedAt = data.launchNotifiedAt?.toDate?.()
      ? data.launchNotifiedAt.toDate().toISOString()
      : data.launchNotifiedAt || null;
    return {
      id: doc.id,
      email: data.email || doc.id,
      createdAt,
      launchNotifiedAt,
    };
  });

  rows.sort((a, b) => {
    const ta = a.createdAt || "";
    const tb = b.createdAt || "";
    return tb.localeCompare(ta);
  });

  const total = rows.length;
  const notified = rows.filter((r) => r.launchNotifiedAt).length;
  const pendingLaunch = total - notified;

  return { stats: { total, pendingLaunch, notified }, rows };
}

export async function listPendingLaunchEmails() {
  const { rows } = await listWaitlistFromFirestore();
  return rows.filter((r) => !r.launchNotifiedAt).map((r) => r.email);
}

export async function markLaunchNotified(email) {
  const db = getFirestoreAdmin();
  await db.collection("waitlist").doc(email).set(
    { launchNotifiedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}
