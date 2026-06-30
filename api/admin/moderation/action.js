import { adaptHandler } from "../../lib/vercelAdapter.mjs";
import { handleAdminModerationAction } from "../../lib/supabaseModeration.mjs";

export default adaptHandler(handleAdminModerationAction);
