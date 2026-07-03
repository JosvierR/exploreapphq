# Explore Web / Admin

Marketing site and admin console for **Explore** — geospatial social discovery.

## Stack

- Vite + React + TypeScript
- React Router
- Express (local API) + Vercel Serverless (production API)
- Supabase (admin auth, moderation, analytics)
- Firebase (waitlist / legacy)
- Prometheus + Grafana + Loki (observability)

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

```
api/index.js                 # only Vercel function entrypoint
server/api-lib/
  http/                      # request IDs, responses, adapters
  observability/             # logs, metrics, Loki
  moderation/                # reports + admin ops
  analytics/                 # events ingest + insights
  system/                    # health / metrics / bootstrap
  router.mjs                 # /api/* dispatcher
src/pages/admin/             # admin UI
observability/               # local Prometheus/Grafana/Loki
```

## Local development

```bash
npm install

# Optional: mail + observability
docker compose up -d
npm run obs:up

# Web + API
npm run dev:all
```

| Service | URL |
|---------|-----|
| Web | http://localhost:5173 |
| API | http://localhost:3001 |
| Mailpit | http://localhost:8025 |
| Grafana | http://localhost:3000 (`admin` / `admin`) |
| Prometheus | http://localhost:9090 |

Copy `.env.example` → `.env` and fill secrets.

For local metrics/logs:

```env
METRICS_TOKEN=local-dev-metrics-token
GRAFANA_LOGS_ENABLED=true
GRAFANA_LOKI_URL=http://localhost:3100/loki/api/v1/push
```

## Commands

```bash
npm run dev          # frontend
npm run dev:api      # API
npm run dev:all      # both
npm run build        # production web build
npm run lint
npm test
npm run obs:up       # Prometheus + Grafana + Loki
npm run obs:down
```

## Admin

| Route | Purpose |
|-------|---------|
| `/admin` | Dashboard / ops sections |
| `/admin/analytics` | Product + ingestion insights |
| `/admin/reports` | Moderation queue |
| `/admin/waitlist` | Waitlist + broadcast |

Auth: Supabase admin accounts (`admin_users` table).

## Production

- Host: **Vercel** (`docs/VERCEL_SETUP.md`)
- Single serverless function: `api/index.js`
- Metrics: `GET /api/metrics` with `Authorization: Bearer $METRICS_TOKEN`
- Optional Grafana Cloud Loki via `GRAFANA_*` env vars

## Docs

| Doc | Topic |
|-----|-------|
| `docs/ARCHITECTURE.md` | System map |
| `docs/ADMIN_PLATFORM.md` | Admin product surface |
| `docs/OBSERVABILITY.md` | Logs + metrics |
| `docs/GRAFANA_DASHBOARD.md` | Grafana panels |
| `docs/SECURITY_ADMIN_WEB.md` | Secrets / redaction |
| `docs/SUPABASE_MODERATION.md` | Moderation API |
| `docs/ANALYTICS_EVENTS_API.md` | Events ingestion |
| `docs/DATA-004_ADMIN_INSIGHTS_DASHBOARD.md` | Analytics dashboard |
| `docs/VERCEL_SETUP.md` | Deploy |
