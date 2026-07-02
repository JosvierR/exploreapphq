/**
 * Local bootstrap using server env (requires valid SUPABASE_SECRET_KEY).
 * Prefer scripts/run-board-admin-bootstrap.mjs against production.
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CREDENTIALS_PATH = resolve(ROOT, "SETUP_CREDENTIALS.local.md");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
  }
}

async function main() {
  loadEnvFile(resolve(ROOT, "vercel.env"));
  loadEnvFile(resolve(ROOT, ".env"));

  const { provisionBoardAdminAccounts } = await import("../api/lib/boardAdminProvision.mjs");
  const result = await provisionBoardAdminAccounts();

  const lines = [
    "# Explore Web Admin — Directiva (CONFIDENTIAL)",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Login URL",
    "",
    result.login_url,
    "",
    "| Slot | Label | Email | Password |",
    "| --- | --- | --- | --- |",
  ];

  for (const account of result.accounts) {
    lines.push(`| ${account.slot} | ${account.label} | \`${account.email}\` | \`${account.password}\` |`);
  }

  lines.push("", "```env", `EXPLORE_ADMIN_ALLOWED_EMAILS=${result.explore_admin_allowed_emails}`, "```", "");
  writeFileSync(CREDENTIALS_PATH, lines.join("\n"), "utf8");

  console.log(`[provision] ${result.accounts.length} accounts ready -> ${CREDENTIALS_PATH}`);
}

main().catch((error) => {
  console.error("[provision] Failed:", error.message || error);
  process.exit(1);
});
