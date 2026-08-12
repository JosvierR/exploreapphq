import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)));
const DIST = join(ROOT, "dist");
const SERVER_SECRET_NAMES = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ANALYTICS_CRON_SECRET",
  "CRON_SECRET",
  "ADMIN_PASSWORD",
  "ADMIN_BOOTSTRAP_SECRET",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "SMTP_PASS",
  "TWILIO_AUTH_TOKEN",
];

function readEnv(path) {
  try {
    const values = new Map();
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      values.set(match[1], match[2].replace(/^['"]|['"]$/g, ""));
    }
    return values;
  } catch {
    return new Map();
  }
}

function files(path) {
  const result = [];
  for (const entry of readdirSync(path)) {
    const candidate = join(path, entry);
    if (statSync(candidate).isDirectory()) result.push(...files(candidate));
    else if ([".html", ".js", ".css", ".json", ".map"].includes(extname(candidate))) result.push(candidate);
  }
  return result;
}

const envValues = new Map([...readEnv(join(ROOT, ".env")).entries(), ...readEnv(join(ROOT, ".env.local")).entries()]);
const sensitive = SERVER_SECRET_NAMES.map((name) => [name, String(process.env[name] || envValues.get(name) || "").trim()])
  .filter(([, value]) => value.length >= 12 && !/^\[.+\]$/.test(value));
const artifacts = files(DIST).map((path) => ({ path, text: readFileSync(path, "utf8") }));
const matches = [];
for (const [name, value] of sensitive) {
  const found = artifacts.find((artifact) => artifact.text.includes(value));
  if (found) matches.push({ name, artifact: found.path.slice(DIST.length + 1) });
}

console.log(
  JSON.stringify(
    {
      ok: matches.length === 0,
      server_secret_exposed_to_browser: matches.length > 0,
      sensitive_values_checked: sensitive.map(([name]) => name),
      matches,
      artifacts_scanned: artifacts.length,
    },
    null,
    2,
  ),
);
if (matches.length) process.exitCode = 1;
