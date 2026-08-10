#!/usr/bin/env node
/**
 * Sync Explore-V2 Edge OpenAPI into this admin repo, pinned to an exact commit.
 *
 * Usage:
 *   node scripts/sync-edge-openapi.mjs --commit <sha>
 *   node scripts/sync-edge-openapi.mjs --commit <sha> --repo AngRodSt/Explore-V2
 *   node scripts/sync-edge-openapi.mjs --commit <sha> --path supabase/functions/openapi.edge.yaml
 *
 * Auth (private repo): GH_TOKEN, GITHUB_TOKEN, or `gh auth token`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const DEFAULT_REPO = "AngRodSt/Explore-V2";
const DEFAULT_PATH = "supabase/functions/openapi.edge.yaml";
const OUT_YAML = join(repoRoot, "server/api-lib/docs/openapi.edge.yaml");
const OUT_PIN = join(repoRoot, "server/api-lib/docs/edgeOpenApi.pin.json");

function parseArgs(argv) {
  /** @type {{ commit: string, repo: string, path: string }} */
  const out = { commit: "", repo: DEFAULT_REPO, path: DEFAULT_PATH };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--commit") out.commit = String(argv[++i] || "").trim();
    else if (arg === "--repo") out.repo = String(argv[++i] || "").trim();
    else if (arg === "--path") out.path = String(argv[++i] || "").trim();
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/sync-edge-openapi.mjs --commit <sha> [--repo owner/name] [--path path/in/repo]`);
      process.exit(0);
    }
  }
  return out;
}

function resolveGithubToken() {
  const fromEnv = (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "").trim();
  if (fromEnv) return fromEnv;
  try {
    return execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

/**
 * @param {{ repo: string, path: string, commit: string, token: string }} opts
 */
async function fetchYamlFromGithub({ repo, path, commit, token }) {
  const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${encodeURIComponent(commit)}`;
  /** @type {Record<string, string>} */
  const headers = {
    Accept: "application/vnd.github.raw+json",
    "User-Agent": "exploreapphq-sync-edge-openapi",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `GitHub fetch failed (${response.status}) for ${repo}@${commit}:${path}. ${body.slice(0, 240)}`,
    );
  }
  return await response.text();
}

/**
 * @param {string} yamlText
 * @param {{ repo: string, path: string, commit: string }} meta
 */
function stampSourceMetadata(yamlText, meta) {
  const stamp = [
    `# Synced into exploreapphq — do not edit by hand.`,
    `# Source: https://github.com/${meta.repo}/blob/${meta.commit}/${meta.path}`,
    `# Pin: ${meta.commit}`,
    `# Synced-At: ${new Date().toISOString()}`,
    "",
  ].join("\n");

  if (yamlText.startsWith("# Synced into exploreapphq")) {
    const rest = yamlText.replace(/^# Synced into exploreapphq[\s\S]*?\n\n/, "");
    return stamp + rest;
  }
  return stamp + yamlText;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!/^[0-9a-f]{7,40}$/i.test(args.commit)) {
    console.error("Missing/invalid --commit <sha> (full or abbreviated git SHA).");
    process.exit(1);
  }

  const token = resolveGithubToken();
  if (!token) {
    console.warn("No GitHub token found; private repos will 404. Set GH_TOKEN or run `gh auth login`.");
  }

  const yaml = await fetchYamlFromGithub({
    repo: args.repo,
    path: args.path,
    commit: args.commit,
    token,
  });

  if (!yaml.includes("openapi:") || !yaml.includes("generate-upload-url")) {
    throw new Error("Downloaded file does not look like Explore Edge OpenAPI (missing openapi/generate-upload-url).");
  }

  const stamped = stampSourceMetadata(yaml, args);
  mkdirSync(dirname(OUT_YAML), { recursive: true });
  writeFileSync(OUT_YAML, stamped.endsWith("\n") ? stamped : `${stamped}\n`, "utf8");

  const pin = {
    repo: args.repo,
    path: args.path,
    commit: args.commit.toLowerCase(),
    commit_short: args.commit.slice(0, 7).toLowerCase(),
    source_url: `https://github.com/${args.repo}/blob/${args.commit}/${args.path}`,
    raw_api_url: `https://api.github.com/repos/${args.repo}/contents/${args.path}?ref=${args.commit}`,
    synced_at: new Date().toISOString(),
  };
  writeFileSync(OUT_PIN, `${JSON.stringify(pin, null, 2)}\n`, "utf8");

  console.log(`Synced Edge OpenAPI → ${OUT_YAML}`);
  console.log(`Pin → ${OUT_PIN}`);
  console.log(`Commit ${pin.commit_short} (${pin.commit})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
