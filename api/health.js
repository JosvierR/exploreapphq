import { adaptHandler } from "./lib/vercelAdapter.mjs";
import { handleHealth } from "./lib/supabaseModeration.mjs";

export default adaptHandler(handleHealth);
