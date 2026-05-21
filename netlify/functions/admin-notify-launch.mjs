import { verifyAdminRequest, jsonResponse } from "./lib/verifyAdmin.mjs";
import { markLaunchNotified } from "./lib/waitlistFirestore.mjs";
import {
  listPendingLaunchEmailsMerged,
  listWaitlistMerged,
} from "./lib/waitlistMerged.mjs";
import { sendLaunchBulk } from "./lib/sendMail.mjs";

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const auth = await verifyAdminRequest(request);
  if (!auth.ok) return jsonResponse(auth.status, { error: auth.error });

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* empty body ok */
  }

  const dryRun = body.dryRun === true || new URL(request.url).searchParams.get("dryRun") === "1";

  try {
    const pending = await listPendingLaunchEmailsMerged();

    if (dryRun) {
      return jsonResponse(200, {
        dryRun: true,
        count: pending.length,
        emails: pending,
      });
    }

    if (pending.length === 0) {
      const { stats } = await listWaitlistMerged();
      return jsonResponse(200, {
        sent: [],
        failed: [],
        message: "No pending recipients.",
        stats,
      });
    }

    const result = await sendLaunchBulk(pending, markLaunchNotified);
    const { stats } = await listWaitlistMerged();

    return jsonResponse(200, {
      ...result,
      stats,
      message: `Sent ${result.sent.length} launch email(s).`,
    });
  } catch (err) {
    console.error("[admin-notify-launch]", err);
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : "Bulk send failed.",
    });
  }
};
