/**
 * Bridge Vercel Node handlers (req, res) ↔ Netlify-style fetch handlers (Request → Response).
 */
export function adaptHandler(fetchHandler) {
  return async (req, res) => {
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
    }
  };
}
