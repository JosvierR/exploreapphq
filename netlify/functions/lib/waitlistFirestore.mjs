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
      phone: data.phone || "",
      email: data.email || (String(doc.id).includes("@") ? doc.id : ""),
      createdAt,
      launchNotifiedAt,
      seqStep: typeof data.seqStep === "number" ? data.seqStep : 0,
      consentSms: data.consentSms !== false,
      unsubscribed: data.unsubscribed === true,
      storage: "firestore",
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
  return rows
    .filter((r) => !r.launchNotifiedAt && r.email && r.email.includes("@"))
    .map((r) => r.email);
}

export async function markLaunchNotified(email) {
  const db = getFirestoreAdmin();
  // Old data is keyed by email; new data by phone-digits. Try by id first, then query.
  const ref = db.collection("waitlist").doc(email);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.set({ launchNotifiedAt: FieldValue.serverTimestamp() }, { merge: true });
    return;
  }
  const q = await db.collection("waitlist").where("email", "==", email).limit(1).get();
  if (!q.empty) {
    await q.docs[0].ref.set({ launchNotifiedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
}

/** All contacts with the fields needed to drive the nurture sequence. */
export async function listSequenceContacts() {
  const db = getFirestoreAdmin();
  const snap = await db.collection("waitlist").get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    const createdAt = d.createdAt?.toDate?.() ? d.createdAt.toDate() : d.createdAt ? new Date(d.createdAt) : null;
    return {
      id: doc.id,
      phone: d.phone || "",
      email: d.email || "",
      createdAt,
      seqStep: typeof d.seqStep === "number" ? d.seqStep : 0,
      consentSms: d.consentSms !== false,
      unsubscribed: d.unsubscribed === true,
    };
  });
}

/** Record that a sequence step was delivered to a contact. */
export async function advanceSeqStep(id, stepIndex) {
  const db = getFirestoreAdmin();
  await db.collection("waitlist").doc(id).set(
    {
      seqStep: stepIndex,
      lastSeqAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}
