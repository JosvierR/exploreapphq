import { saveFeedback } from "./lib/saveFeedback.mjs";
import { sendEmailViaResend } from "./lib/resendSend.mjs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CATEGORIES = new Set(["idea", "bug", "love", "other"]);

function esc(s = "") {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
}

async function notifyAdmin(entry, id) {
  const to = (process.env.FEEDBACK_NOTIFY_TO || process.env.VITE_ADMIN_EMAILS || "")
    .split(",")[0]
    ?.trim();
  if (!to || !process.env.SMTP_PASS) return;

  const subject = `New Explore feedback: ${entry.category}`;
  const html = `
    <div style="font-family:Arial,sans-serif;color:#0b0f14">
      <h2 style="margin:0 0 12px">New feedback (${esc(entry.category)})</h2>
      <p style="white-space:pre-wrap;font-size:15px;line-height:1.5">${esc(entry.message)}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
      <p style="font-size:13px;color:#6b7280">
        From: ${esc(entry.name || "Anonymous")} ${entry.email ? `&lt;${esc(entry.email)}&gt;` : ""}<br/>
        ID: ${esc(id)}
      </p>
    </div>`;
  const text = `New feedback (${entry.category})\n\n${entry.message}\n\nFrom: ${entry.name || "Anonymous"} ${entry.email || ""}\nID: ${id}`;

  try {
    await sendEmailViaResend({ to, subject, html, text, allowSandbox: true });
  } catch (err) {
    console.error("[feedback] admin notify failed:", err);
  }
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (message.length < 3) {
    return Response.json(
      { error: "Tell us a little more — at least a few words." },
      { status: 400, headers: cors },
    );
  }
  if (message.length > 4000) {
    return Response.json({ error: "That's a bit long. Keep it under 4000 characters." }, {
      status: 400,
      headers: cors,
    });
  }

  const emailRaw = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const email = emailRaw && EMAIL_RE.test(emailRaw) ? emailRaw : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  const category = CATEGORIES.has(body?.category) ? body.category : "idea";

  try {
    const entry = { message, email, name, category, source: "web" };
    const { id } = await saveFeedback(entry);
    await notifyAdmin(entry, id);
    return Response.json(
      {
        ok: true,
        id,
        message: "Thanks! We read every note and it shapes what we build next.",
      },
      { status: 200, headers: cors },
    );
  } catch (err) {
    console.error("[feedback]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Something went wrong." },
      { status: 500, headers: cors },
    );
  }
};
