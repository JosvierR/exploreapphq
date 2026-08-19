import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  convertSwaggerToOpenApi31,
  withPostgrestServer,
} from "../server/api-lib/docs/postgrestOpenApi.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const OPENAPI_STATIC_SURFACES = [
  { name: "Admin HTTP", path: "server/api-lib/docs/openapi.admin.yaml" },
  { name: "Edge Functions", path: "server/api-lib/docs/openapi.edge.yaml" },
];

const POSTGREST_SWAGGER_FIXTURE = {
  swagger: "2.0",
  info: {
    title: "Explore PostgREST API (deterministic CI fixture)",
    version: "1.0.0",
  },
  host: "ci.supabase.invalid",
  basePath: "/rest/v1",
  schemes: ["https"],
  securityDefinitions: {
    JWT: {
      type: "apiKey",
      name: "Authorization",
      in: "header",
    },
  },
  security: [{ JWT: [] }],
  paths: {
    "/places": {
      get: {
        summary: "List places",
        operationId: "getPlaces",
        produces: ["application/json"],
        responses: { 200: { description: "OK" } },
      },
    },
  },
};

export async function buildPostgrestLintSpec() {
  const { spec } = await convertSwaggerToOpenApi31(POSTGREST_SWAGGER_FIXTURE);
  return withPostgrestServer(spec, "https://ci.supabase.invalid");
}

export function redoclyArguments(postgrestPath, format = "codeframe") {
  return [
    "lint",
    ...OPENAPI_STATIC_SURFACES.map((surface) => resolve(root, surface.path)),
    postgrestPath,
    `--format=${format}`,
  ];
}

export async function lintOpenApiSurfaces(options = {}) {
  const temp = mkdtempSync(join(tmpdir(), "explore-openapi-lint-"));
  const postgrestPath = join(temp, "openapi.postgrest.generated.json");
  const redoclyBin = resolve(root, "node_modules", ".bin", process.platform === "win32" ? "redocly.cmd" : "redocly");
  const format = options.format || (process.env.GITHUB_ACTIONS === "true" ? "github-actions" : "codeframe");
  const run = options.run || spawnSync;

  try {
    writeFileSync(postgrestPath, `${JSON.stringify(await buildPostgrestLintSpec(), null, 2)}\n`, "utf8");
    console.info("OpenAPI surfaces: Admin HTTP, Edge Functions, generated PostgREST");
    const result = run(redoclyBin, redoclyArguments(postgrestPath, format), {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (result.error) throw result.error;
    return typeof result.status === "number" ? result.status : 1;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  process.exitCode = await lintOpenApiSurfaces();
}
