import { waitUntil } from "@vercel/functions";
import { flushPendingLokiLogs, runWithObservabilityContext } from "../observability/lokiLogger.mjs";

/**
 * Bridge Vercel Node handlers (req, res) ↔ fetch handlers (Request → Response).
 * Keeps Loki pushes alive after the HTTP response via waitUntil.
 */
export function adaptHandler(fetchHandler) {
  return async (req, res) => {
    await runWithObservabilityContext(async () => {
      try {
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
        const url = `${protocol}://${host}${req.url || "/"}`;

        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (value == null) continue;
          if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v));
          } else {
            headers.set(key, value);
          }
        }

        let body;
        if (req.method !== "GET" && req.method !== "HEAD") {
          if (req.body == null) {
            body = undefined;
          } else if (typeof req.body === "string" || Buffer.isBuffer(req.body)) {
            body = req.body;
          } else {
            body = JSON.stringify(req.body);
            if (!headers.has("content-type")) {
              headers.set("content-type", "application/json");
            }
          }
        }

        const request = new Request(url, { method: req.method, headers, body });
        const response = await fetchHandler(request);

        res.status(response.status);
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() === "transfer-encoding") return;
          res.setHeader(key, value);
        });

        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length) res.send(buffer);
        else res.end();
      } catch (err) {
        console.error("[api]", err);
        if (!res.headersSent) {
          res.status(500).json({
            error: err instanceof Error ? err.message : "Internal server error",
          });
        }
      } finally {
        // Critical for production: without waitUntil, Loki pushes are dropped when the
        // serverless isolate freezes after the response.
        waitUntil(flushPendingLokiLogs({ timeoutMs: 2500 }));
      }
    });
  };
}
