# Local observability (free OSS)

Prometheus + Grafana + Loki for the Explore API.

## Start

```bash
# In project .env (already documented in .env.example)
METRICS_TOKEN=local-dev-metrics-token
GRAFANA_LOGS_ENABLED=true
GRAFANA_LOKI_URL=http://localhost:3100/loki/api/v1/push

npm run obs:ready   # starts stack + waits until healthy
npm run dev:api     # API must load .env (uses --env-file=.env)
```

Optional one-shot check after API is up:

```bash
npm run obs:smoke
```

| Service | URL |
|---------|-----|
| Grafana | http://localhost:3002 (`admin` / `admin`) |
| Prometheus | http://localhost:9090 |
| Loki ready | http://localhost:3100/loki/ready |
| Loki push | http://localhost:3100/loki/api/v1/push |

## What you get

- Prometheus scrapes `GET /api/metrics` on the local API (`Bearer local-dev-metrics-token`)
- Grafana dashboard **Explore API Overview** under folder Explore
- Structured API JSON logs in Loki (`{service="explore-web-admin"}`)
- Local Express records the same request metrics as the Vercel `dispatchApi` router

## Stop

```bash
npm run obs:down
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `/api/metrics` → 404 | Set `METRICS_TOKEN` in `.env` and restart `dev:api` |
| `/api/metrics` → 403 | Token in `.env` must match `observability/prometheus/prometheus.yml` |
| Grafana logs empty | Confirm `GRAFANA_LOGS_ENABLED=true` and Loki URL; hit any `/api/*` route |
| Grafana port busy | Stack binds Grafana to **3002** (not 3000) to avoid Vite/other apps |
| Prometheus empty | Keep `npm run dev:api` running so scrape target `host.docker.internal:3001` is reachable |

Production uses Vercel stdout + optional Grafana Cloud Loki (`GRAFANA_*` env vars). See `docs/OBSERVABILITY.md`.
