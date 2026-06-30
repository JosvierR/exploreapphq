import { adaptHandler } from "../lib/vercelAdapter.mjs";
import { handleAdminReports } from "../lib/supabaseModeration.mjs";

export default adaptHandler(handleAdminReports);
