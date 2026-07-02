import { pushLokiLog } from "./lokiLogger.mjs";
import { requestIdFromRequest } from "./requestContext.mjs";

const SERVICE = "explore-web-admin";
const REDACTED = "[redacted]";
const SENSITIVE_KEY_RE =
  /(authorization|access[_-]?token|refresh[_-]?token|service[_-]?role|secret|password|cookie|api[_-]?key|grafana.*token|loki.*token)/i;
const SAFE_DIAGNOSTIC_KEYS = new Set(["service_role_configured", "service_key_looks_like_jwt"]);

export function appEnvironment() {
  const raw = (process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || "").toLowerCase();
  if (raw.includes("preview") || raw.includes("staging")) return "staging";
  if (raw.includes("development") || raw.includes("local") || raw === "test") return raw || "local";
  return "production";
}

export function appVersion() {
  return (
    process.env.APP_VERSION ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.npm_package_version ||
    "unknown"
  );
}

function redactString(value) {
  if (!value) return value;
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, REDACTED)
    .replace(/(service[_-]?role|secret|token|password|api[_-]?key)=([^&\s]+)/gi, `$1=${REDACTED}`);
}

export function redact(value, seen = new WeakSet()) {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      code: value.code,
      status: value.status,
      stack: process.env.NODE_ENV === "production" ? undefined : redactString(value.stack || ""),
    };
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, seen));
  if (typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    seen.add(value);

    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (SAFE_DIAGNOSTIC_KEYS.has(key) && typeof item === "boolean") {
        out[key] = item;
        continue;
      }
      out[key] = SENSITIVE_KEY_RE.test(key) ? REDACTED : redact(item, seen);
    }
    return out;
  }
  return String(value);
}

function normalizeEntry(level, message, meta = {}) {
  return redact({
    level,
    message,
    service: SERVICE,
    environment: appEnvironment(),
    version: appVersion(),
    timestamp: new Date().toISOString(),
    ...meta,
  });
}

function write(level, message, meta) {
  const entry = normalizeEntry(level, message, meta);
  const line = JSON.stringify(entry);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  void pushLokiLog(entry);
  return entry;
}

export const logger = {
  debug(message, meta = {}) {
    if (process.env.LOG_LEVEL !== "debug" && process.env.NODE_ENV === "production") return null;
    return write("debug", message, meta);
  },
  info(message, meta = {}) {
    return write("info", message, meta);
  },
  warn(message, meta = {}) {
    return write("warn", message, meta);
  },
  error(message, meta = {}) {
    return write("error", message, meta);
  },
};

export function requestLogMeta(request, route) {
  const url = new URL(request.url);
  return {
    request_id: requestIdFromRequest(request),
    route: route ? `/api/${route}` : url.pathname,
    method: request.method,
  };
}

export function errorSummary(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
      details: error.details,
      hint: error.hint,
    };
  }
  if (error && typeof error === "object") {
    return redact({
      name: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }
  return { message: String(error) };
}
