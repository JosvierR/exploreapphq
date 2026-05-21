/**
 * Preview launch email in Mailpit (local).
 * Usage: docker compose up -d && npm run email:launch:test
 */
import { config } from "../config.js";
import { sendAppLaunchEmail } from "../mail.js";

const to = process.argv[2] ?? "test@example.com";

async function main() {
  console.log(`SMTP ${config.smtp.host}:${config.smtp.port}`);
  console.log(`To: ${to}`);
  await sendAppLaunchEmail(to);
  console.log("Launch email sent. Open http://localhost:8025 (Mailpit)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
