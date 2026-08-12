import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(repoRoot, "supabase", "migrations");
const manifestPath = join(repoRoot, "supabase", "migration-baseline.json");
const inventoryPath = join(
  repoRoot,
  "docs",
  "migration-reconciliation",
  "migration-inventory.json",
);

function normalizedSha256(buffer) {
  const normalized = buffer.toString("utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function migrationVersion(filename) {
  const match = /^([^_]+)_.+\.sql$/.exec(filename);
  return match?.[1] ?? null;
}

function migrationFiles() {
  return readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
}

function writeManifest() {
  const sourceInventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  const canonical = sourceInventory.inventory.filter((entry) => entry.remote);

  if (canonical.length !== 76) {
    throw new Error(`Expected 76 production migrations in the forensic inventory; found ${canonical.length}.`);
  }

  const migrations = canonical.map((entry) => {
    const filename = entry.canonical_remote_filename;
    const localPath = join(migrationsDir, filename);
    if (!existsSync(localPath)) {
      throw new Error(`Cannot build manifest: missing ${filename}.`);
    }

    const recoveredFromStatements = entry.repository === "UNKNOWN_ORIGINAL_REPO";
    const exactCommitKnown = /^[0-9a-f]{40}$/.test(entry.commit ?? "");
    const result = {
      version: entry.version,
      filename,
      sha256: normalizedSha256(readFileSync(localPath)),
      source: recoveredFromStatements ? "schema_migrations.statements" : entry.repository,
      production_applied: true,
    };

    if (exactCommitKnown) result.source_commit = entry.commit;
    else if (!recoveredFromStatements) {
      result.source_ref = "origin/main tip recovered at exploreapphq checkpoint f5543fd";
    }

    if (recoveredFromStatements) {
      result.original_git_file = "unknown";
      result.statements_sha256 = entry.canonical_remote_sql_hash;
    }

    return result;
  });

  const manifest = {
    schema_version: 1,
    production_project: "ookbeuiavzjhvezvamfu",
    hash_mode: "sha256 of UTF-8 SQL with CRLF normalized to LF",
    canonical_remote_total: 76,
    canonical_migrations: migrations,
    intentional_forward_migrations: [
      "20260810120000_admin_product_analytics_snapshot.sql",
      "20260811150000_business_intelligence_v2.sql",
      "20260811210000_business_intelligence_production_activation.sql",
      "20260812140000_business_metric_dictionary_expand.sql",
      "20260812150000_fix_backfill_dimensions_canonical_ambiguity.sql",
      "20260812160000_fix_aggregate_affinity_safe_deletes.sql",
      "20260812170000_map_place_route_click_to_views.sql",
      "20260812210000_business_destination_geography_enrichment.sql",
      "20260812213000_preserve_enriched_geography_on_dimension_backfill.sql",
      "20260812220000_require_explicit_destination_geo_semantics.sql",
    ],
  };

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Wrote ${manifestPath} with ${migrations.length} canonical migrations.`);
}

function verify() {
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing canonical migration manifest: ${manifestPath}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const files = migrationFiles();
  const filesByVersion = new Map();
  const errors = [];

  for (const filename of files) {
    const version = migrationVersion(filename);
    if (!version) {
      errors.push(`Invalid migration filename: ${filename}`);
      continue;
    }
    const matching = filesByVersion.get(version) ?? [];
    matching.push(filename);
    filesByVersion.set(version, matching);
  }

  for (const [version, matching] of filesByVersion) {
    if (matching.length > 1) {
      errors.push(
        [
          "Duplicate migration timestamp detected.",
          `Version: ${version}`,
          `Files: ${matching.join(", ")}`,
        ].join("\n"),
      );
    }
  }

  const canonical = manifest.canonical_migrations ?? [];
  if (canonical.length !== manifest.canonical_remote_total || canonical.length !== 76) {
    errors.push(
      `Canonical baseline count mismatch: expected 76, manifest declares ${manifest.canonical_remote_total}, and contains ${canonical.length}.`,
    );
  }

  const manifestVersions = new Set();
  for (const entry of canonical) {
    if (manifestVersions.has(entry.version)) {
      errors.push(`Manifest contains duplicate version ${entry.version}.`);
      continue;
    }
    manifestVersions.add(entry.version);

    if (entry.production_applied !== true) {
      errors.push(`Canonical migration ${entry.version} is not marked production_applied=true.`);
    }

    const matching = filesByVersion.get(entry.version) ?? [];
    if (matching.length === 0) {
      errors.push(`Missing canonical baseline file: ${entry.filename}`);
      continue;
    }
    if (matching.length !== 1) continue;

    const actualFilename = matching[0];
    const actualHash = normalizedSha256(readFileSync(join(migrationsDir, actualFilename)));
    if (actualFilename !== entry.filename || actualHash !== entry.sha256) {
      errors.push(
        [
          "Migration history collision detected.",
          "",
          `Version: ${entry.version}`,
          "",
          `Expected canonical file: ${entry.filename}`,
          `Actual local file: ${actualFilename}`,
          "",
          `Expected canonical hash: ${entry.sha256}`,
          `Actual local hash: ${actualHash}`,
          "",
          "Refusing production migration workflow.",
        ].join("\n"),
      );
    }
  }

  const forwardFiles = new Set(manifest.intentional_forward_migrations ?? []);
  const allowedFiles = new Set([...canonical.map((entry) => entry.filename), ...forwardFiles]);
  for (const filename of files) {
    if (!allowedFiles.has(filename)) {
      errors.push(`Unexpected migration outside the canonical baseline and intentional forward set: ${filename}`);
    }
  }
  for (const filename of forwardFiles) {
    if (!files.includes(filename)) errors.push(`Missing intentional forward migration: ${filename}`);
  }

  if (errors.length > 0) {
    console.error(errors.join("\n\n"));
    process.exitCode = 1;
    return;
  }

  console.log("Shared migration history verified.");
  console.log(`Canonical production baseline: ${canonical.length}`);
  console.log(`Intentional forward migrations: ${forwardFiles.size}`);
  console.log("Duplicate timestamps: 0");
  console.log("Canonical hash mismatches: 0");
}

if (process.argv.includes("--write-manifest")) writeManifest();
else verify();
