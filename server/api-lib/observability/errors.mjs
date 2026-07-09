import { requestIdFromRequest } from "../http/requestContext.mjs";
import { jsonResponse } from "../http/responses.mjs";
import { errorSummary, logger, requestLogMeta } from "./logger.mjs";
import { recordSupabaseError } from "./metrics.mjs";

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function safeClientError(error, status) {
  if (status === 401) return "Authentication required.";
  if (status === 403) return "Access denied.";
  if (status === 404) return "Not found.";
  if (status === 405) return "Method not allowed.";
  if (status >= 500) return "Internal server error.";
  return error instanceof Error ? error.message : "Request failed.";
}

export function handleApiError(error, request, { route = "unknown", domain = "api" } = {}) {
  const status = error instanceof HttpError ? error.status : Number(error?.status) || 500;
  const meta = request ? requestLogMeta(request, route) : { route, domain };

  if (status >= 500) {
    recordSupabaseError(route);
    logger.error(`${domain} API error`, {
      ...meta,
      status,
      error: errorSummary(error),
    });
  } else {
    logger.warn(`${domain} API rejected request`, {
      ...meta,
      status,
      error: errorSummary(error),
    });
  }

  return jsonResponse(status, {
    ok: false,
    error: safeClientError(error, status),
    code: error instanceof HttpError ? error.code : undefined,
    request_id: request ? requestIdFromRequest(request) : undefined,
  });
}
