import { adaptHandler } from "../../lib/vercelAdapter.mjs";
import { handleAdminReportById } from "../../lib/supabaseModeration.mjs";

export default adaptHandler(handleAdminReportById);
