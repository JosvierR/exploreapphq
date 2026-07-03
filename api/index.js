import { adaptHandler } from "../server/api-lib/http/vercelAdapter.mjs";
import { dispatchApi } from "../server/api-lib/router.mjs";

export default adaptHandler(dispatchApi);
