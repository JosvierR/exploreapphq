import { useMemo } from "react";
import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { AdminAuthGate } from "@/features/admin/components/AdminAuthGate";
import { useModerationAdmin } from "@/features/admin/ModerationAdminProvider";
import "@/styles/admin-api-docs.css";

const OPENAPI_SOURCES = [
  {
    title: "PostgREST",
    slug: "postgrest",
    url: "/api/admin/openapi/postgrest",
  },
  {
    title: "Edge Functions",
    slug: "edge",
    url: "/api/admin/openapi/edge",
  },
  {
    title: "Admin HTTP API",
    slug: "admin",
    url: "/api/admin/openapi/admin",
  },
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

  const configuration = useMemo(
    () => ({
      sources: OPENAPI_SOURCES.map((source) => ({ ...source })),
      hideModels: true,
      hideClientButton: true,
      customFetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (accessToken) {
          headers.set("Authorization", `Bearer ${accessToken}`);
        }
        return fetch(input, { ...init, headers });
      },
    }),
    [accessToken],
  );

  return (
    <div className="admin-api-docs">
      <div className="admin-api-docs__intro">
        <p className="admin-muted">
          OpenAPI skeletons for PostgREST, Edge Functions, and the Admin HTTP API. Specs are
          admin-only and will be filled in later phases.
        </p>
      </div>
      <div className="admin-api-docs__scalar">
        <ApiReferenceReact configuration={configuration} />
      </div>
    </div>
  );
}
