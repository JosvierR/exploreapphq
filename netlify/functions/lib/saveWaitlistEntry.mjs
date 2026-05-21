import { FieldValue } from "firebase-admin/firestore";
import { getStore } from "@netlify/blobs";
import { getFirestoreAdmin } from "./firebaseAdmin.mjs";

/** Persist signup to Firestore (primary) and Netlify Blobs (backup). */
export async function saveWaitlistEntry(email) {
  let created = false;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const db = getFirestoreAdmin();
      const ref = db.collection("waitlist").doc(email);
      const snap = await ref.get();
      if (!snap.exists) {
        await ref.set({
          email,
          createdAt: FieldValue.serverTimestamp(),
        });
        created = true;
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
    const existing = await store.get(email, { type: "json" });
    if (!existing) {
      await store.setJSON(email, { email, createdAt: new Date().toISOString() });
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

  return { created };
}
