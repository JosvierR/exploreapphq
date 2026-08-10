# Explore agent notes

## OpenAPI (EXPLORE-325 / EXPLORE-326)

### Admin HTTP

- Spec: `server/api-lib/docs/openapi.admin.yaml`
- Served at `GET /api/admin/openapi/admin` (admin auth)
- Anti-drift: `server/api-lib/docs/openapi.admin.antiDrift.test.mjs` (runs in `npm test`)
- Lint: `npm run openapi:lint` (Redocly)

### Edge Functions (cross-repo)

- Source of truth: `AngRodSt/Explore-V2` → `supabase/functions/openapi.edge.yaml`
- Sync (pin to commit, never a branch tip):

```bash
npm run openapi:sync-edge -- --commit <sha>
```

- Vendored copy + pin: `server/api-lib/docs/openapi.edge.yaml` + `edgeOpenApi.pin.json`
- Served at `GET /api/admin/openapi/edge` (admin auth); commit pin is in
  `info.x-explore-source-commit*` and response headers `X-Explore-Edge-OpenAPI-Commit*`

### Scripts

```bash
npm run openapi:lint
npm run openapi:preview
npm run openapi:sync-edge -- --commit <sha>
```

Convention: every route dispatched by `server/api-lib/router.mjs` must appear in
`openapi.admin.yaml`. Local Express (`server/index.ts`) must mount the same shared
`/api/*` paths (allowlist `EXPRESS_ONLY_API_PATHS` for local-only helpers).

PostgREST live docs remain a separate Scalar source (`/api/admin/openapi/postgrest`).
