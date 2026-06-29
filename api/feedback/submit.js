import { adaptHandler } from "../lib/vercelAdapter.mjs";
import handler from "../../netlify/functions/feedback-submit.mjs";

export default adaptHandler(handler);
