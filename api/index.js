import { adaptHandler } from "../server/api-lib/http/vercelAdapter.mjs";
import { dispatchApi } from "../server/api-lib/router.mjs";

// Ensure Vercel NFT packs swagger2openapi into the serverless function.
import { createRequire } from "node:module";
createRequire(import.meta.url)("swagger2openapi");

export default adaptHandler(dispatchApi);
