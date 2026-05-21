import { getStore } from "@netlify/blobs";

/** Emails saved by waitlist-signup when Netlify Blobs is available */
export async function listWaitlistFromBlobs() {
  try {
    const store = getStore("waitlist");
    const { blobs } = await store.list();
    const rows = [];

    for (const blob of blobs) {
      const email = blob.key;
      let createdAt = blob.uploadedAt ?? null;
      try {
        const data = await store.get(email, { type: "json" });
        if (data?.createdAt) createdAt = data.createdAt;
      } catch {
        /* use uploadedAt */
      }
      rows.push({
        id: email,
        email,
        createdAt,
        launchNotifiedAt: null,
        storage: "netlify-blobs",
      });
    }

    return rows;
  } catch (err) {
    console.warn("[waitlist] Blobs list failed:", err?.message ?? err);
    return [];
  }
}
