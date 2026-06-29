import { adaptHandler } from "../lib/vercelAdapter.mjs";
import handler from "../../netlify/functions/admin-waitlist.mjs";

export default adaptHandler(handler);
