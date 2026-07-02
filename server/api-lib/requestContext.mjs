import crypto from "node:crypto";

const REQUEST_ID_HEADER = "x-request-id";

function safeIncomingRequestId(value) {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.length > 128) return "";
  return /^[a-zA-Z0-9._:-]+$/.test(trimmed) ? trimmed : "";
}

export function createRequestId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${crypto.randomBytes(12).toString("hex")}`;
}

export function requestIdFromRequest(request) {
  return safeIncomingRequestId(request.headers.get(REQUEST_ID_HEADER));
}

export function ensureRequestId(request) {
  const requestId = requestIdFromRequest(request) || createRequestId();
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  return {
    request: new Request(request, { headers }),
    requestId,
  };
}

export function responseHeadersWithRequestId(headers, requestId) {
  const nextHeaders = new Headers(headers);
  nextHeaders.set(REQUEST_ID_HEADER, requestId);

  const exposed = nextHeaders.get("Access-Control-Expose-Headers");
  const exposedValues = new Set(
    (exposed || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  exposedValues.add(REQUEST_ID_HEADER);
  nextHeaders.set("Access-Control-Expose-Headers", [...exposedValues].join(", "));

  return nextHeaders;
}

export function routePath(route) {
  if (!route) return "/api";
  if (/^admin\/reports\/[^/]+$/.test(route)) return "/api/admin/reports/:id";
  return `/api/${route}`;
}
