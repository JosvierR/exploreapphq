import { FieldValue } from "firebase-admin/firestore";
import { getFirestoreAdmin } from "./firebaseAdmin.js";

export type WaitlistFirestoreRow = {
  id: string;
  email: string;
  createdAt: string | null;
  launchNotifiedAt: string | null;
};

export async function listWaitlistFromFirestoreAsync() {
  const db = getFirestoreAdmin();
  const snap = await db.collection("waitlist").get();

  const rows: WaitlistFirestoreRow[] = snap.docs.map((doc) => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.()
      ? data.createdAt.toDate().toISOString()
      : (data.createdAt as string) || null;
    const launchNotifiedAt = data.launchNotifiedAt?.toDate?.()
      ? data.launchNotifiedAt.toDate().toISOString()
      : (data.launchNotifiedAt as string) || null;
    return {
      id: doc.id,
      email: (data.email as string) || doc.id,
      createdAt,
      launchNotifiedAt,
    };
  });

  rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const total = rows.length;
  const notified = rows.filter((r) => r.launchNotifiedAt).length;

  return {
    stats: { total, pendingLaunch: total - notified, notified },
    rows,
  };
}

export async function listPendingLaunchEmailsAsync(): Promise<string[]> {
  const { rows } = await listWaitlistFromFirestoreAsync();
  return rows.filter((r) => !r.launchNotifiedAt).map((r) => r.email);
}

export async function markLaunchNotifiedFirestore(email: string) {
  const db = getFirestoreAdmin();
  await db.collection("waitlist").doc(email).set(
    { launchNotifiedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}
