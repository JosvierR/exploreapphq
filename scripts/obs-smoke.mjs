#!/usr/bin/env node
/**
 * Smoke-check local observability stack + optional local API metrics.
 *
 * Usage:
 *   node scripts/obs-smoke.mjs
 *   node scripts/obs-smoke.mjs --wait
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WAIT = process.argv.includes("--wait");
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

function loadEnvFile() {
  const envPath = resolve(ROOT, ".env");
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const fileEnv = loadEnvFile();
const METRICS_TOKEN = process.env.METRICS_TOKEN || fileEnv.METRICS_TOKEN || "local-dev-metrics-token";
const API_PORT = process.env.PORT || fileEnv.PORT || "3001";
const API_BASE = `http://127.0.0.1:${API_PORT}`;

const checks = [
  { name: "Prometheus ready", url: "http://127.0.0.1:9090/-/ready" },
  { name: "Loki ready", url: "http://127.0.0.1:3100/loki/ready" },
  { name: "Grafana health", url: "http://127.0.0.1:3002/api/health" },
];

async function probe(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text: text.slice(0, 200) };
  } catch (error) {
    return { ok: false, status: 0, text: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function waitFor(name, url, attempts = 30) {
  for (let i = 1; i <= attempts; i += 1) {
    const result = await probe(url);
    if (result.ok) {
      console.log(`✓ ${name}`);
      return true;
    }
    process.stdout.write(`… waiting ${name} (${i}/${attempts})\r`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log(`✗ ${name} did not become ready`);
  return false;
}

async function main() {
  console.log("Observability smoke check\n");

  let failed = 0;
  for (const check of checks) {
    if (WAIT) {
      const ok = await waitFor(check.name, check.url);
      if (!ok) failed += 1;
    } else {
      const result = await probe(check.url);
      if (result.ok) console.log(`✓ ${check.name}`);
      else {
        console.log(`✗ ${check.name} → ${result.status || "unreachable"} ${result.text}`);
        failed += 1;
      }
    }
  }

  // Optional: generate a health request then scrape metrics if API is up.
  const health = await probe(`${API_BASE}/api/health`);
  if (health.ok) {
    console.log(`✓ API health (${API_BASE})`);
    const metrics = await probe(`${API_BASE}/api/metrics`, {
      headers: { Authorization: `Bearer ${METRICS_TOKEN}` },
    });
    if (metrics.ok && metrics.text.includes("explore_api_requests_total")) {
      console.log("✓ API /api/metrics scrape (token auth + counter present)");
    } else if (metrics.status === 404) {
      console.log("✗ API /api/metrics → 404 (set METRICS_TOKEN in .env)");
      failed += 1;
    } else if (metrics.status === 403) {
      console.log("✗ API /api/metrics → 403 (METRICS_TOKEN mismatch with Prometheus scrape token)");
      failed += 1;
    } else {
      console.log(`✗ API /api/metrics → ${metrics.status} ${metrics.text}`);
      failed += 1;
    }
  } else {
    console.log(`· API not running on ${API_BASE} (start with npm run dev:api)`);
  }

  console.log("");
  if (failed > 0) {
    console.log(`Failed checks: ${failed}`);
    console.log("Fix: npm run obs:up && npm run dev:api");
    process.exit(1);
  }

  console.log("All checks passed.");
  console.log("Grafana:     http://localhost:3002  (admin / admin)");
  console.log("Prometheus:  http://localhost:9090");
  console.log("Loki:        http://localhost:3100/loki/ready");
  console.log("Dashboard:   Explore → Explore API Overview");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
