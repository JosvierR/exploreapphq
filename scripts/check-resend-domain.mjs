/**
 * Comprueba dominios en Resend (usa SMTP_PASS del entorno o netlify.env).
 * Uso: node scripts/check-resend-domain.mjs
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, "netlify.env");

function loadEnvFile() {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile();

const apiKey = process.env.SMTP_PASS;
if (!apiKey?.startsWith("re_")) {
  console.error("Falta SMTP_PASS (re_...) en netlify.env o entorno.");
  process.exit(1);
}

const res = await fetch("https://api.resend.com/domains", {
  headers: { Authorization: `Bearer ${apiKey}` },
});
const data = await res.json().catch(() => ({}));

if (!res.ok) {
  const msg = data?.message ?? String(res.status);
  if (msg.includes("only send emails")) {
    console.log("API key solo envio (ok). Verifica dominio en https://resend.com/domains");
    process.exit(2);
  }
  console.error("Resend API error:", msg);
  process.exit(1);
}

const expectedHost = (() => {
  try {
    const u = process.env.SITE_URL || "";
    return new URL(u.startsWith("http") ? u : `https://${u}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
})();

const list = data?.data ?? data ?? [];
if (!Array.isArray(list) || list.length === 0) {
  console.log("Sin dominios en Resend. Anade tu dominio en https://resend.com/domains");
  process.exit(2);
}

for (const d of list) {
  console.log(`${d.name}: ${d.status}`);
}

const target = expectedHost || list[0]?.name;
const ok = target && list.some((d) => d.name === target && d.status === "verified");
if (!ok && expectedHost) {
  console.log(`SITE_URL usa ${expectedHost} — debe estar Verified en Resend.`);
}
process.exit(ok ? 0 : 2);
