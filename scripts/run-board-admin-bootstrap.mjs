/**
 * Call production bootstrap endpoint to create 6 directiva admin accounts.
 *
 * 1. Set ADMIN_BOOTSTRAP_SECRET in Vercel Production and redeploy.
 * 2. Run:
 *    ADMIN_BOOTSTRAP_SECRET=your-secret node scripts/run-board-admin-bootstrap.mjs
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CREDENTIALS_PATH = resolve(ROOT, "SETUP_CREDENTIALS.local.md");

const BOOTSTRAP_URL =
  (process.env.ADMIN_BOOTSTRAP_URL || "https://www.exploreapphq.com/api/admin/system/bootstrap-board").trim();

async function main() {
  const secret = String(process.env.ADMIN_BOOTSTRAP_SECRET || "").trim();
  if (!secret) {
    const generated = randomBytes(24).toString("hex");
    console.error("Missing ADMIN_BOOTSTRAP_SECRET.");
    console.error("");
    console.error("1. Add this to Vercel Production env and redeploy:");
    console.error(`   ADMIN_BOOTSTRAP_SECRET=${generated}`);
    console.error("2. Re-run:");
    console.error(`   $env:ADMIN_BOOTSTRAP_SECRET="${generated}"; node scripts/run-board-admin-bootstrap.mjs`);
    process.exit(1);
  }

  const response = await fetch(BOOTSTRAP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Bootstrap-Secret": secret,
    },
    body: "{}",
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) {
    if (response.status === 404 && body.error === "Not found.") {
      throw new Error(
        [
          "Bootstrap endpoint is not enabled in production.",
          "Set ADMIN_BOOTSTRAP_SECRET in Vercel → Production → Environment Variables, redeploy, then re-run:",
          '  $env:ADMIN_BOOTSTRAP_SECRET="same-secret-as-vercel"',
          "  npm run admin:bootstrap",
        ].join("\n"),
      );
    }
    if (response.status === 403) {
      throw new Error(
        "Bootstrap secret rejected. Use the exact same ADMIN_BOOTSTRAP_SECRET value configured in Vercel Production.",
      );
    }
    throw new Error(body.error || `Bootstrap failed (${response.status})`);
  }

  const lines = [
    "# Explore Web Admin — Directiva (CONFIDENTIAL)",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Login URL",
    "",
    body.login_url || "https://www.exploreapphq.com/admin",
    "",
    "## Accounts",
    "",
    "| Slot | Label | Email | Password |",
    "| --- | --- | --- | --- |",
  ];

  for (const account of body.accounts || []) {
    lines.push(`| ${account.slot} | ${account.label} | \`${account.email}\` | \`${account.password}\` |`);
  }

  lines.push(
    "",
    "## Vercel env",
    "",
    "```env",
    `EXPLORE_ADMIN_ALLOWED_EMAILS=${body.explore_admin_allowed_emails || ""}`,
    "```",
    "",
    body.warning || "",
    "",
  );

  writeFileSync(CREDENTIALS_PATH, lines.join("\n"), "utf8");

  console.log(`[bootstrap] ${body.accounts?.length || 0} accounts ready.`);
  console.log(`[bootstrap] Credentials: ${CREDENTIALS_PATH}`);
  console.log("");
  console.log("Set in Vercel Production, then remove ADMIN_BOOTSTRAP_SECRET and redeploy:");
  console.log(`EXPLORE_ADMIN_ALLOWED_EMAILS=${body.explore_admin_allowed_emails}`);
}

main().catch((error) => {
  console.error("[bootstrap] Failed:", error.message || error);
  process.exit(1);
});
