import { adaptHandler } from "./lib/vercelAdapter.mjs";
import { dispatchModerationApi } from "./lib/moderationRouter.mjs";

export default adaptHandler(dispatchModerationApi);
