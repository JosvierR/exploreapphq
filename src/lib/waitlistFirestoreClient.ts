import { collection, doc, getDocs, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { getFirestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import type { WaitlistRow, WaitlistStats } from "@/lib/adminApi";

function toIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return null;
}

/** Read waitlist in Firebase Console — same data, via admin login in /team */
export async function fetchWaitlistFromFirestoreClient(): Promise<{
  stats: WaitlistStats;
  rows: WaitlistRow[];
}> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured.");
  }

  const snap = await getDocs(collection(getFirestoreDb(), "waitlist"));
  const rows: WaitlistRow[] = snap.docs.map((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;
    return {
      id,
      phone: (data.phone as string) || "",
      email: (data.email as string) || (id.includes("@") ? id : ""),
      createdAt: toIso(data.createdAt),
      launchNotifiedAt: toIso(data.launchNotifiedAt),
      seqStep: typeof data.seqStep === "number" ? data.seqStep : 0,
      storage: "firestore",
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

export async function listPendingEmailsFromClient(): Promise<string[]> {
  const { rows } = await fetchWaitlistFromFirestoreClient();
  return rows.filter((r) => !r.launchNotifiedAt && r.email).map((r) => r.email);
}

export async function markLaunchNotifiedClient(email: string) {
  const ref = doc(getFirestoreDb(), "waitlist", email);
  await setDoc(ref, { launchNotifiedAt: serverTimestamp() }, { merge: true });
}
