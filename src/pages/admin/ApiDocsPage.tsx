import { useEffect, useMemo, useState } from "react";
import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { AdminAuthGate } from "@/features/admin/components/AdminAuthGate";
import { useModerationAdmin } from "@/features/admin/ModerationAdminProvider";
import "@/styles/admin-api-docs.css";

type SpecSource = {
  title: string;
  slug: string;
  content: Record<string, unknown>;
};

const SOURCE_META = [
  { title: "PostgREST", slug: "postgrest", path: "/api/admin/openapi/postgrest" },
  { title: "Edge Functions", slug: "edge", path: "/api/admin/openapi/edge" },
  { title: "Admin HTTP API", slug: "admin", path: "/api/admin/openapi/admin" },
] as const;

export default function ApiDocsPage() {
  return (
    <AdminAuthGate>
      <ApiDocsContent />
    </AdminAuthGate>
  );
}

function ApiDocsContent() {
  const { session } = useModerationAdmin();
  const accessToken = session?.access_token ?? "";
  const [sources, setSources] = useState<SpecSource[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      setError("Missing admin session token.");
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setWarnings([]);
      try {
        const settled = await Promise.allSettled(
          SOURCE_META.map(async (meta) => {
            const headers: Record<string, string> = {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            };
            const response = await fetch(meta.path, { headers });
            const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
            if (!response.ok) {
              const message =
                data && typeof data.error === "string"
                  ? data.error
                  : `Failed to load ${meta.title} (${response.status})`;
              const code = data && typeof data.code === "string" ? ` [${data.code}]` : "";
              throw new Error(`${meta.title}: ${message}${code}`);
            }
            if (!data || typeof data !== "object" || data.ok === false) {
              throw new Error(
                data && typeof data.error === "string"
                  ? `${meta.title}: ${data.error}`
                  : `${meta.title} returned an invalid OpenAPI document`,
              );
            }
            return {
              title: meta.title,
              slug: meta.slug,
              content: data,
            } satisfies SpecSource;
          }),
        );

        const nextSources: SpecSource[] = [];
        const nextWarnings: string[] = [];
        for (const result of settled) {
          if (result.status === "fulfilled") nextSources.push(result.value);
          else nextWarnings.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
        }

        if (!cancelled) {
          setSources(nextSources.length ? nextSources : null);
          setWarnings(nextWarnings);
          setError(nextSources.length ? null : nextWarnings[0] || "Failed to load OpenAPI documents.");
        }
      } catch (err) {
        if (!cancelled) {
          setSources(null);
          setError(err instanceof Error ? err.message : "Failed to load OpenAPI documents.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const edgePin = useMemo(() => {
    const edge = sources?.find((source) => source.slug === "edge");
    const info = edge?.content?.info;
    if (!info || typeof info !== "object") return null;
    const record = info as Record<string, unknown>;
    const short = typeof record["x-explore-source-commit-short"] === "string"
      ? record["x-explore-source-commit-short"]
      : "";
    const full = typeof record["x-explore-source-commit"] === "string" ? record["x-explore-source-commit"] : "";
    const url = typeof record["x-explore-source-url"] === "string" ? record["x-explore-source-url"] : "";
    if (!short && !full) return null;
    return { short: short || full.slice(0, 7), full, url };
  }, [sources]);

  const configuration = useMemo(() => {
    if (!sources?.length) return null;
    return {
      sources: sources.map((source) => ({
        title: source.title,
        slug: source.slug,
        content: source.content,
      })),
      hideModels: true,
      hideClientButton: true,
    };
  }, [sources]);

  return (
    <div className="admin-api-docs">
      <div className="admin-api-docs__intro">
        <p className="admin-muted">
          PostgREST loads live from Supabase. Admin HTTP uses{" "}
          <code>openapi.admin.yaml</code>. Edge Functions use the synced Explore-V2
          contract (<code>openapi.edge.yaml</code>). Specs are admin-only.
        </p>
        {edgePin && (
          <p className="admin-muted">
            Edge OpenAPI pin:{" "}
            {edgePin.url ? (
              <a href={edgePin.url} target="_blank" rel="noreferrer">
                <code>{edgePin.short}</code>
              </a>
            ) : (
              <code>{edgePin.short}</code>
            )}
            {edgePin.full && edgePin.full !== edgePin.short ? (
              <>
                {" "}
                (<code>{edgePin.full}</code>)
              </>
            ) : null}
          </p>
        )}
      </div>

      {loading && (
        <div className="admin-api-docs__status" aria-busy="true">
          Loading OpenAPI documents…
        </div>
      )}

      {!loading && error && !configuration && (
        <div className="admin-api-docs__status admin-api-docs__status--error" role="alert">
          <strong>Could not load API docs.</strong>
          <p>{error}</p>
          <p className="admin-muted">
            PostgREST needs <code>SUPABASE_URL</code> + <code>SUPABASE_SECRET_KEY</code>{" "}
            (same server secret as admin analytics). Save in Vercel Production and Redeploy.
          </p>
        </div>
      )}

      {!loading && warnings.length > 0 && configuration && (
        <div className="admin-api-docs__status admin-api-docs__status--error" role="status">
          <strong>Some surfaces failed to load.</strong>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {!loading && configuration && (
        <div className="admin-api-docs__scalar">
          <ApiReferenceReact configuration={configuration} />
        </div>
      )}
    </div>
  );
}
