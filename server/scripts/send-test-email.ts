/**
 * Send one welcome email with the current HTML template (for Mailpit preview).
 * Usage: npm run email:test
 *        npm run email:test -- otro@email.com
 */
import { sendWaitlistEmail } from "../mail.js";

const to = process.argv[2] ?? "test@explore.local";

async function main() {
  console.log(`Sending welcome email to ${to} ...`);
  await sendWaitlistEmail(to);
  console.log("Done. Open http://localhost:8025 and open the NEWEST message.");
  console.log("Subject should start with: You're on the Explore list");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
