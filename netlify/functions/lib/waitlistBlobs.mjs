import { getStore } from "@netlify/blobs";

/** Emails saved by waitlist-signup when Netlify Blobs is available */
export async function listWaitlistFromBlobs() {
  try {
    const store = getStore("waitlist");
    const listed = await store.list();
    const blobs = Array.isArray(listed) ? listed : listed?.blobs ?? [];
    const rows = [];

    for (const blob of blobs) {
      const key = blob.key ?? blob.pathname ?? blob.name;
      if (!key || key.includes("/")) continue;
      let createdAt = blob.uploadedAt ?? null;
      let phone = "";
      let email = "";
      try {
        const data = await store.get(key, { type: "json" });
        if (data?.createdAt) createdAt = data.createdAt;
        phone = data?.phone ?? "";
        email = data?.email ?? "";
      } catch {
        /* use uploadedAt */
      }
      // Legacy blobs were keyed by email; new ones by phone-digits.
      if (!email && key.includes("@")) email = key;
      rows.push({
        id: key,
        phone,
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
