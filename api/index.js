import { createRequire } from "node:module";
import { adaptHandler } from "../server/api-lib/http/vercelAdapter.mjs";
import { dispatchApi } from "../server/api-lib/router.mjs";

// Best-effort: help Vercel NFT see swagger2openapi without crashing cold start.
try {
  createRequire(import.meta.url)("swagger2openapi");
} catch {
  // Lite converter covers production if the package is absent from the bundle.
}

export default adaptHandler(dispatchApi);