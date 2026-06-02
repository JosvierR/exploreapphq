import { FieldValue } from "firebase-admin/firestore";
import { getStore } from "@netlify/blobs";
import { getFirestoreAdmin } from "./firebaseAdmin.mjs";

/**
 * Persist a feedback/idea submission to Firestore (primary) + Blobs (backup).
 * @param {{ message: string, email?: string, name?: string, category?: string, source?: string }} entry
 * @returns {{ id: string }}
 */
export async function saveFeedback(entry) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    message: entry.message,
    email: entry.email || "",
    name: entry.name || "",
    category: entry.category || "idea",
    source: entry.source || "web",
    status: "new",
  };

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const db = getFirestoreAdmin();
      await db
        .collection("feedback")
        .doc(id)
        .set({ ...record, createdAt: FieldValue.serverTimestamp() });
      return { id };
    } catch (err) {
      console.error("[feedback] Firestore save failed:", err);
    }
  }

  // Fallback / backup in Netlify Blobs.
  try {
    const store = getStore("feedback");
    await store.setJSON(id, { ...record, createdAt: new Date().toISOString() });
    return { id };
  } catch (err) {
    console.error("[feedback] Blobs save failed:", err);
    throw new Error("Could not save your feedback. Please try again.");
  }
}
