import { adaptHandler } from "../lib/vercelAdapter.mjs";
import handler from "../../netlify/functions/admin-broadcast.mjs";

export default adaptHandler(handler);
