import { FieldValue } from "firebase-admin/firestore";
import { getStore } from "@netlify/blobs";
import { getFirestoreAdmin } from "./firebaseAdmin.mjs";

/**
 * Persist a phone-first signup to Firestore (primary) and Netlify Blobs (backup).
 * @param {{ id: string, phone: string, email: string }} contact
 * @returns {{ created: boolean, addedEmail: boolean }}
 */
export async function saveWaitlistEntry(contact) {
  const { id, phone, email } = contact;
  let created = false;
  let addedEmail = false;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const db = getFirestoreAdmin();
      const ref = db.collection("waitlist").doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        await ref.set({
          phone: phone || "",
          email: email || "",
          createdAt: FieldValue.serverTimestamp(),
          source: "web",
          consentSms: Boolean(phone),
          seqStep: 0,
        });
        created = true;
      } else {
        // Returning visitor: backfill a newly-provided email so sequences can reach them.
        const data = snap.data() || {};
        if (email && !data.email) {
          await ref.set({ email }, { merge: true });
          addedEmail = true;
        }
      }
    } catch (err) {
      console.error("[waitlist] Firestore save failed:", err);
      throw new Error("Could not save to waitlist database.");
    }
  } else {
    console.warn("[waitlist] FIREBASE_SERVICE_ACCOUNT_JSON missing — Firestore not updated");
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
      if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) created = true;
    } else if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      created = false;
    }
  } catch (err) {
    console.warn("[waitlist] Blobs save:", err?.message ?? err);
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !created) {
      throw new Error("Waitlist storage is not configured.");
    }
  }

  return { created, addedEmail };
}
