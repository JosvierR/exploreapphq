# Local observability (free OSS)

Prometheus + Grafana + Loki for the Explore API.

## Start

```bash
# In project .env
METRICS_TOKEN=local-dev-metrics-token
GRAFANA_LOGS_ENABLED=true
GRAFANA_LOKI_URL=http://localhost:3100/loki/api/v1/push

npm run obs:up
npm run dev:api
```

| Service | URL |
|---------|-----|
| Grafana | http://localhost:3000 (`admin` / `admin`) |
| Prometheus | http://localhost:9090 |
| Loki push | http://localhost:3100/loki/api/v1/push |

## What you get

- Prometheus scrapes `GET /api/metrics` on the local API
- Grafana dashboard **Explore API Overview**
- Structured API logs in Loki (`{service="explore-web-admin"}`)

## Stop

```bash
npm run obs:down
```

Production uses Vercel stdout + optional Grafana Cloud Loki (`GRAFANA_*` env vars). See `docs/OBSERVABILITY.md`.
