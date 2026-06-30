import { adaptHandler } from "./lib/vercelAdapter.mjs";
import { handleReports } from "./lib/supabaseModeration.mjs";

export default adaptHandler(handleReports);
