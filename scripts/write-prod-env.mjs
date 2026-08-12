import fs from "node:fs";

/**
 * Materialize local .env / .env.local from Vercel Production.
 * Run via: npm run env:from-prod
 * (Must run in your own terminal — Vercel redacts Sensitive values in agent/non-interactive pulls.)
 */

const keys = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "EXPLORE_ADMIN_ALLOWED_EMAILS",
  "SITE_URL",
  "VITE_SITE_URL",
  "VITE_ADMIN_EMAILS",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "ANALYTICS_CRON_SECRET",
  "ADMIN_BOOTSTRAP_SECRET",
  "ADMIN_PASSWORD",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM",
  "APP_STORE_URL",
  "PLAY_STORE_URL",
  "VITE_CANNY_BOARD_TOKEN",
  "VITE_CANNY_PORTAL_URL",
  "VITE_FEEDBACK_URL",
];

function esc(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[\r\n#"\\ ]/.test(s) || s.includes("=")) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r")}"`;
  }
  return s;
}

function usable(v) {
  return Boolean(v) && v !== "[SENSITIVE]";
}

const lines = [
  "# Local development → Supabase PRODUCTION",
  "# Generated via: npm run env:from-prod",
  "# Do not commit. Used by Vite and `tsx --env-file=.env`.",
  "",
  "PORT=3001",
  "APP_URL=http://localhost:5173",
  "APP_ENV=local",
  "APP_VERSION=local-dev",
  "VITE_EXPLORE_WEB_URL=https://www.exploreapphq.com",
];

let wroteSensitive = 0;
for (const key of keys) {
  const value = process.env[key];
  if (usable(value)) {
    lines.push(`${key}=${esc(value)}`);
    wroteSensitive += 1;
  }
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
if (usable(url)) {
  lines.push(`SUPABASE_URL=${esc(url)}`);
}

try {
  const previous = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
  const match = previous.match(/^AI_GATEWAY_API_KEY=(.*)$/m);
  if (match && usable(match[1].trim().replace(/^"|"$/g, ""))) {
    lines.push(`AI_GATEWAY_API_KEY=${match[1].trim()}`);
  }
} catch {
  // ignore
}

if (wroteSensitive < 4) {
  console.error(
    JSON.stringify({
      ok: false,
      error:
        "Vercel did not decrypt Sensitive production secrets in this session. Run `npm run env:from-prod` in your own terminal (outside the agent). Never paste production secrets into chat.",
      wrote_keys: wroteSensitive,
    }),
  );
  process.exit(1);
}

const body = `${lines.join("\n")}\n`;
fs.writeFileSync(".env", body, "utf8");
fs.writeFileSync(".env.local", body, "utf8");

console.log(
  JSON.stringify({
    ok: true,
    wrote: [".env", ".env.local"],
    supabase_url: Boolean(usable(url) && url.startsWith("https://")),
    publishable: usable(process.env.VITE_SUPABASE_PUBLISHABLE_KEY),
    anon: usable(process.env.SUPABASE_ANON_KEY),
    secret: usable(process.env.SUPABASE_SECRET_KEY),
    keys: wroteSensitive,
  }),
);
