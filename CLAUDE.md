# Explore agent notes

## OpenAPI (EXPLORE-325)

Hand-authored Admin HTTP contract:

- Spec: `server/api-lib/docs/openapi.admin.yaml`
- Served at `GET /api/admin/openapi/admin` (admin auth)
- Anti-drift: `server/api-lib/docs/openapi.admin.antiDrift.test.mjs` (runs in `npm test`)
- Lint: `npm run openapi:lint` (Redocly)

Scripts:

```bash
npm run openapi:lint
npm run openapi:preview
```

Convention: every route dispatched by `server/api-lib/router.mjs` must appear in
`openapi.admin.yaml`. Local Express (`server/index.ts`) must mount the same shared
`/api/*` paths (allowlist `EXPRESS_ONLY_API_PATHS` for local-only helpers).

PostgREST live docs remain a separate Scalar source (`/api/admin/openapi/postgrest`).
