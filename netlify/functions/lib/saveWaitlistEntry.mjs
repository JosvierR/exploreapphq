import { FieldValue } from "firebase-admin/firestore";
import { getStore } from "@netlify/blobs";
import { getFirestoreAdmin } from "./firebaseAdmin.mjs";

/**
 * Persist a phone-first signup to Firestore (primary) and Netlify Blobs (backup).
 * @param {{ id: string, phone: string, email: string }} contact
 * @returns {{ created: boolean, addedEmail: boolean, needsWelcomeSms: boolean, shouldSendWelcomeEmail: boolean, docRef?: import('firebase-admin/firestore').DocumentReference }}
 */
export async function saveWaitlistEntry(contact) {
  const { id, phone, email } = contact;
  let created = false;
  let addedEmail = false;
  let needsWelcomeSms = false;
  let shouldSendWelcomeEmail = false;
  /** @type {import('firebase-admin/firestore').DocumentReference | undefined} */
  let docRef;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const db = getFirestoreAdmin();
      docRef = db.collection("waitlist").doc(id);
      const snap = await docRef.get();
      if (!snap.exists) {
        await docRef.set({
          phone: phone || "",
          email: email || "",
          createdAt: FieldValue.serverTimestamp(),
          source: "web",
          consentSms: Boolean(phone),
          seqStep: 0,
        });
        created = true;
        needsWelcomeSms = Boolean(phone);
        shouldSendWelcomeEmail = Boolean(email);
      } else {
        const data = snap.data() || {};
        const prevEmail = (data.email || "").trim().toLowerCase();
        const nextEmail = (email || "").trim().toLowerCase();
        if (nextEmail && nextEmail !== prevEmail) {
          await docRef.set({ email: nextEmail }, { merge: true });
          addedEmail = true;
        }
        // Browser may have written first — still send welcome SMS once.
        needsWelcomeSms = Boolean(phone) && !data.welcomeSmsAt;
        // Welcome email: first time with email, new email, or retry if never marked sent.
        shouldSendWelcomeEmail =
          Boolean(nextEmail) && (addedEmail || !data.welcomeEmailAt);
      }
    } catch (err) {
      console.error("[waitlist] Firestore save failed:", err);
      throw new Error("Could not save to waitlist database.");
    }
  } else {
    console.warn("[waitlist] FIREBASE_SERVICE_ACCOUNT_JSON missing — Firestore not updated");
    needsWelcomeSms = Boolean(phone);
    shouldSendWelcomeEmail = Boolean(email);
  }

  try {
    const store = getStore("waitlist");
    const existing = await store.get(id, { type: "json" });
    if (!existing) {
      await store.setJSON(id, {
        phone: phone || "",
        email: email || "",
        createdAt: new Date().toISOString(),
      });
      if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        created = true;
        needsWelcomeSms = Boolean(phone);
      }
    } else if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      created = false;
      needsWelcomeSms = Boolean(phone) && !existing.welcomeSmsAt;
    }
  } catch (err) {
    console.warn("[waitlist] Blobs save:", err?.message ?? err);
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !created) {
      throw new Error("Waitlist storage is not configured.");
    }
  }

  return { created, addedEmail, needsWelcomeSms, shouldSendWelcomeEmail, docRef };
}

/** Mark welcome email as delivered so we don't resend on retry. */
export async function markWelcomeEmailSent(docRef) {
  if (!docRef) return;
  await docRef.set({ welcomeEmailAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function getWelcomeEmailStatus(docRef) {
  if (!docRef) return { hasWelcomeEmailAt: false };
  const snap = await docRef.get();
  const data = snap.data() || {};
  return { hasWelcomeEmailAt: Boolean(data.welcomeEmailAt) };
}

/** Mark welcome SMS as delivered so we don't resend on retry. */
export async function markWelcomeSmsSent(docRef) {
  if (!docRef) return;
  await docRef.set({ welcomeSmsAt: FieldValue.serverTimestamp() }, { merge: true });
}
