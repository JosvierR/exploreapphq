import { verifyAdminRequest, jsonResponse } from "./lib/verifyAdmin.mjs";
import { listWaitlistFromFirestore } from "./lib/waitlistFirestore.mjs";

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    });
  }

  if (request.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const auth = await verifyAdminRequest(request);
  if (!auth.ok) return jsonResponse(auth.status, { error: auth.error });

  try {
    const data = await listWaitlistFromFirestore();
    return jsonResponse(200, { ...data, source: "firestore" });
  } catch (err) {
    console.error("[admin-waitlist]", err);
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : "Could not load waitlist.",
    });
  }
};
