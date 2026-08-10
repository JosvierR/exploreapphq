# Explore Web/Admin Architecture

## Runtime map

```
Browser (Vite React SPA)
  └─ /            → Pioneers landing (`src/features/pioneers/`)
  └─ /explorar    → Consumer home
  └─ /team        → Redirect to `/admin` (hidden operator entry; no public nav link)
  └─ /admin/*     → AdminAuthGate (`src/features/admin/components/AdminAuthGate.tsx`)
  └─ /admin/api-docs → Lazy Scalar OpenAPI UI (`src/pages/admin/ApiDocsPage.tsx`)
  └─ /api/*       → Vercel single function: api/index.js
                    └─ server/api-lib/router.mjs
                         ├─ moderation/   reports, ops, admin auth
                         ├─ analytics/    events ingest + insights
                         ├─ system/       health, metrics, bootstrap
                         ├─ docs/         admin OpenAPI skeletons (Scalar)
                         └─ netlify/functions/* (waitlist/feedback handlers)
```

Local Express (`server/index.ts`) mounts the same handlers for development.

**Constraint:** only `api/index.js` is a Vercel Serverless Function. Shared logic lives under `server/api-lib/` and is bundled via `includeFiles`.

## Backend domains (`server/api-lib/`)

| Folder | Responsibility |
|--------|----------------|
| `http/` | Request IDs, Vercel adapter, route resolution, JSON responses |
| `observability/` | Structured logs, Prometheus metrics, Loki push, shared `HttpError` / `handleApiError` |
| `pioneers/` | Public pioneers landing API |
| `moderation/` | Reports, admin users, ops summary, moderation actions |
| `analytics/` | `POST /api/events` + admin insights APIs |
| `system/` | Health, metrics endpoints, board admin bootstrap |
| `docs/` | Admin-only OpenAPI docs (live PostgREST + `openapi.admin.yaml` + synced Edge OpenAPI) for Scalar (`/api/admin/openapi/*`) |
| `router.mjs` | Single dispatcher for all `/api/*` routes |

Learn a domain by reading its folder top-down. Prefer importing from domain folders, not from unrelated modules.

## Frontend domains (`src/`)

| Path | Responsibility |
|------|----------------|
| `src/features/pioneers/` | Pioneros landing pages, sections, API client, styles |
| `src/pages/admin/` | Admin route pages (dashboard, reports, analytics, waitlist, api-docs) |
| `src/features/admin/` | Auth gate, primitives, system page, observability hooks |
| `src/lib/` | Typed API clients (`moderationAdminApi`, `adminAnalyticsApi`) |
| `src/components/layout/` | `AdminLayout` nav/shell |
| `src/styles/` | Admin design system CSS |

## Observability (free OSS)

| Tool | Role | Local URL |
|------|------|-----------|
| Prometheus | Scrapes `/api/metrics` | http://localhost:9090 |
| Grafana | Dashboards + explore | http://localhost:3002 (`admin` / `admin`) |
| Loki | Log aggregation | http://localhost:3100 |

Start:

```bash
# .env
METRICS_TOKEN=local-dev-metrics-token
GRAFANA_LOGS_ENABLED=true
GRAFANA_LOKI_URL=http://localhost:3100/loki/api/v1/push

npm run obs:ready
npm run dev:api
```

Production:

- Logs: JSON to stdout (Vercel) + optional Grafana Cloud Loki (`GRAFANA_*` env)
- Metrics: `GET /api/metrics` with `Authorization: Bearer $METRICS_TOKEN`
- Admin UI: `/admin?section=system` (operators can also open `/team` — not linked in public header)

Local Grafana: http://localhost:3002 (`admin` / `admin`).

## Auth model

1. Browser signs in with Supabase Auth.
2. Admin pages call APIs with `Authorization: Bearer <access_token>`.
3. Server validates token via service role, then checks `admin_users` (or email allowlist fallback).

Never put `SUPABASE_SECRET_KEY` or `METRICS_TOKEN` in `VITE_*` variables.

## C4 level 2 — Edge Functions (Explore-V2)

Mobile / Stream integrations live in the separate repo `AngRodSt/Explore-V2`
(`supabase/functions`). The admin console documents a **commit-pinned** sync of
`openapi.edge.yaml` (see `npm run openapi:sync-edge`).

| Function | Method | Auth | Responsibility |
|----------|--------|------|----------------|
| `generate-upload-url` | `POST` | Supabase user JWT (+ verified email) | Create Cloudflare Stream direct-upload URL and `videos` row (`processing`) |
| `cloudflare-stream-webhook` | `POST` | Cloudflare `Webhook-Signature` HMAC | Publish or delete video after Stream transcoding |
| `cleanup-soft-deleted` | cron/internal | service role | Purge soft-deleted videos / Stream assets |
| `finalize-account-deletion` | internal | service role | Finish account deletion cleanup |

Admin viewer: `/admin/api-docs` → **Edge Functions** tab (`GET /api/admin/openapi/edge`).

## Docs map

| Doc | Use when |
|-----|----------|
| `docs/ARCHITECTURE.md` | This file — system map |
| `docs/ADMIN_PLATFORM.md` | Admin routes and product boundaries |
| `docs/OBSERVABILITY.md` | Metrics/logs operations |
| `docs/GRAFANA_DASHBOARD.md` | Grafana Cloud / panels |
| `docs/VERCEL_SETUP.md` | Deploy + env vars |
| `docs/SECURITY_ADMIN_WEB.md` | Secrets and redaction |
| `docs/SUPABASE_MODERATION.md` | Moderation API contract |
| `docs/ANALYTICS_EVENTS_API.md` | Events ingestion |
| `docs/DATA-004_ADMIN_INSIGHTS_DASHBOARD.md` | Admin analytics UI/API |

**Reviewed:** 2026-08-10

## Adding a new API route

1. Put handler code in the correct domain folder under `server/api-lib/`.
2. Wire it in `server/api-lib/router.mjs`.
3. Mirror the route in `server/index.ts` for local Express.
4. Document the path in `server/api-lib/docs/openapi.admin.yaml` and keep anti-drift green (`npm test` + `npm run openapi:lint`).
5. Do **not** add new files under `api/` (Hobby function limit).
6. Add admin-only auth with `requireAdmin` when the route is admin.
7. Emit metrics/logs with `recordApiRequest` (automatic via router) and domain-specific counters when useful.
