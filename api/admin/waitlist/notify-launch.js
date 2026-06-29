import { adaptHandler } from "../../lib/vercelAdapter.mjs";
import handler from "../../../netlify/functions/admin-notify-launch.mjs";

export default adaptHandler(handler);
