import { adaptHandler } from "./lib/vercelAdapter.mjs";
import { dispatchApi } from "./lib/apiRouter.mjs";

export default adaptHandler(dispatchApi);
