import { adaptHandler } from "../lib/vercelAdapter.mjs";
import { handleAdminMe } from "../lib/supabaseModeration.mjs";

export default adaptHandler(handleAdminMe);
