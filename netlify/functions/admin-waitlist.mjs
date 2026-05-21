import { verifyAdminRequest, jsonResponse } from "./lib/verifyAdmin.mjs";
import { listWaitlistMerged } from "./lib/waitlistMerged.mjs";

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

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return jsonResponse(503, {
      error:
        "Missing FIREBASE_SERVICE_ACCOUNT_JSON in Netlify. Add the Firebase service account JSON (Secret), redeploy, then refresh.",
      configMissing: true,
    });
  }

  try {
    const data = await listWaitlistMerged();
    return jsonResponse(200, data);
  } catch (err) {
    console.error("[admin-waitlist]", err);
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : "Could not load waitlist.",
    });
  }
};
