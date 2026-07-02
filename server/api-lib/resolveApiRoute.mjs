/**
 * Resolve the logical /api/* route from a Vercel or local request.
 * After vercel.json rewrites, the handler may be invoked as /api/index.js
 * while the original path stays in the URL or Vercel headers.
 */
export function resolveApiRoute(request) {
  const url = new URL(request.url);
  let pathname = url.pathname.replace(/\/+$/, "") || "/";

  const original =
    request.headers.get("x-vercel-original-path") ||
    request.headers.get("x-invoke-path") ||
    request.headers.get("x-matched-path");

  if (original?.startsWith("/api")) {
    pathname = original.replace(/\/+$/, "");
  }

  if (pathname === "/api/index" || pathname === "/api/index.js") {
    const nested = url.searchParams.get("path");
    if (nested) {
      pathname = `/api/${nested.replace(/^\//, "")}`;
    }
  }

  return pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean).join("/");
}
