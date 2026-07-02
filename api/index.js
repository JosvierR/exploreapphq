import { adaptHandler } from "../server/api-lib/vercelAdapter.mjs";
import { dispatchApi } from "../server/api-lib/apiRouter.mjs";

export default adaptHandler(dispatchApi);
