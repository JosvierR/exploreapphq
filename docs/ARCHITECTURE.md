# Explore Web/Admin Architecture

## Runtime map

```
Browser (Vite React SPA)
  └─ /admin/*  → AdminAuthGate (Supabase session)
  └─ /api/*    → Vercel single function: api/index.js
                    └─ server/api-lib/router.mjs
                         ├─ moderation/   reports, ops, admin auth
                         ├─ analytics/    events ingest + insights
                         ├─ system/       health, metrics, bootstrap
                         └─ netlify/functions/* (waitlist/feedback handlers)
```

Local Express (`server/index.ts`) mounts the same handlers for development.

**Constraint:** only `api/index.js` is a Vercel Serverless Function. Shared logic lives under `server/api-lib/` and is bundled via `includeFiles`.

## Backend domains (`server/api-lib/`)

| Folder | Responsibility |
|--------|----------------|
| `http/` | Request IDs, Vercel adapter, route resolution, JSON responses |
| `observability/` | Structured logs, Prometheus metrics, Loki push |
| `moderation/` | Reports, admin users, ops summary, moderation actions |
| `analytics/` | `POST /api/events` + admin insights APIs |
| `system/` | Health, metrics endpoints, board admin bootstrap |
| `router.mjs` | Single dispatcher for all `/api/*` routes |

Learn a domain by reading its folder top-down. Prefer importing from domain folders, not from unrelated modules.

## Frontend domains (`src/`)

| Path | Responsibility |
|------|----------------|
| `src/pages/admin/` | Admin pages (dashboard, reports, analytics, waitlist) |
| `src/features/admin/` | Shared admin primitives, auth provider, system page |
| `src/lib/` | Typed API clients (`moderationAdminApi`, `adminAnalyticsApi`) |
| `src/components/layout/` | `AdminLayout` nav/shell |
| `src/styles/` | Admin design system CSS |

## Observability (free OSS)

| Tool | Role | Local URL |
|------|------|-----------|
| Prometheus | Scrapes `/api/metrics` | http://localhost:9090 |
| Grafana | Dashboards + explore | http://localhost:3000 (`admin` / `admin`) |
| Loki | Log aggregation | http://localhost:3100 |

Start:

```bash
# .env
METRICS_TOKEN=local-dev-metrics-token
GRAFANA_LOGS_ENABLED=true
GRAFANA_LOKI_URL=http://localhost:3100/loki/api/v1/push

npm run obs:up
npm run dev:api
```

Production:

- Logs: JSON to stdout (Vercel) + optional Grafana Cloud Loki (`GRAFANA_*` env)
- Metrics: `GET /api/metrics` with `Authorization: Bearer $METRICS_TOKEN`
- Admin UI: `/admin?section=system`

## Auth model

1. Browser signs in with Supabase Auth.
2. Admin pages call APIs with `Authorization: Bearer <access_token>`.
3. Server validates token via service role, then checks `admin_users` (or email allowlist fallback).

Never put `SUPABASE_SECRET_KEY` or `METRICS_TOKEN` in `VITE_*` variables.

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

## Adding a new API route

1. Put handler code in the correct domain folder under `server/api-lib/`.
2. Wire it in `server/api-lib/router.mjs`.
3. Mirror the route in `server/index.ts` for local Express.
4. Do **not** add new files under `api/` (Hobby function limit).
5. Add admin-only auth with `requireAdmin` when the route is admin.
6. Emit metrics/logs with `recordApiRequest` (automatic via router) and domain-specific counters when useful.
