/**
 * Send "app is ready" email to everyone on the waitlist who hasn't been notified yet.
 *
 * Usage:
 *   npm run waitlist:notify           # send for real
 *   npm run waitlist:notify -- --dry-run
 */
import { config } from "../config.js";
import { listWaitlistPendingLaunch, markLaunchNotified } from "../db.js";
import { sendAppLaunchBulk } from "../mail.js";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const pending = listWaitlistPendingLaunch();
  console.log(`Waitlist pending launch email: ${pending.length}`);
  console.log(`SMTP: ${config.smtp.host}:${config.smtp.port}`);
  console.log(`From: ${config.smtp.from}`);

  if (pending.length === 0) {
    console.log("Nothing to send.");
    return;
  }

  if (dryRun) {
    console.log("\nDry run — would email:");
    pending.forEach((r) => console.log(`  - ${r.email} (joined ${r.created_at})`));
    return;
  }

  const emails = pending.map((r) => r.email);
  const result = await sendAppLaunchBulk(emails, markLaunchNotified);

  console.log(`\nSent: ${result.sent.length}`);
  console.log(`Failed: ${result.failed.length}`);
  if (result.failed.length) {
    result.failed.forEach((f) => console.log(`  ✗ ${f.email}: ${f.error}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
