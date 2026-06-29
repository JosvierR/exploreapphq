import { adaptHandler } from "../lib/vercelAdapter.mjs";
import handler from "../../netlify/functions/waitlist-signup.mjs";

export default adaptHandler(handler);
