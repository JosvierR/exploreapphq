# Grafana Dashboard Guide

## Required Setup (Production / Vercel)

Set these in Vercel → Project → Settings → Environment Variables (Production + Preview):

| Variable | Production value |
|----------|------------------|
| `GRAFANA_LOGS_ENABLED` | `true` |
| `GRAFANA_LOKI_URL` | Grafana Cloud push URL, e.g. `https://logs-prod-XXX.grafana.net/loki/api/v1/push` |
| `GRAFANA_LOKI_USERNAME` | Grafana Cloud Loki **User / Instance ID** (numeric) |
| `GRAFANA_LOKI_TOKEN` | Grafana Cloud Loki **API token** (Sensitive) |
| `GRAFANA_LOGS_LEVEL` | `warn` (recommended) or `info` for more verbose Loki volume |
| `METRICS_TOKEN` | Long random token if you scrape `/api/metrics` |
| `APP_ENV` | `production` |

How to get Grafana Cloud credentials:

1. grafana.com → your stack → **Loki** → **Send logs**
2. Copy the push URL, User, and create a token with write access
3. Paste into Vercel env vars → Redeploy

Do not put Grafana or metrics tokens in `VITE_` variables.

After deploy, open `/admin?section=system` and confirm:

- Observability shows **Loki connected** (or **Loki configured**)
- Configuration flags: Loki enabled / URL / token = yes

## Metrics

- Prefer `GET /api/admin/system/metrics` while signed in as admin (shown in Admin → System).
- Use `GET /api/metrics` only when `METRICS_TOKEN` is configured and the scraper sends `Authorization: Bearer <token>`.

Metrics are in-memory per serverless instance and reset when Vercel recycles an instance. Use Loki/logs for durable production investigation; use `/api/metrics` for live instance health only.

## Suggested Panels

1. API requests per minute (from scraped metrics, if scraper is active).
2. API error rate.
3. P95 request duration.
4. Admin actions over time (LogQL / labels in JSON).
5. Video moderation actions over time.
6. Report queue size (product DB, not metrics layer).
7. Pending reports.
8. Hidden/removed content count.
9. Supabase error count.
10. Auth failure count.
11. Health check status.
12. Recent error logs.
13. Top failing routes (parse `route` from JSON).
14. Moderation action breakdown.

## Example LogQL

Stream labels are low-cardinality: `service`, `environment`, `level`, `deployment`.  
`route`, `request_id`, and message fields live in the JSON log line.

Recent errors:

```logql
{service="explore-web-admin", level="error"}
```

Route-specific logs:

```logql
{service="explore-web-admin"} | json | route="/api/admin/reports"
```

Error count over five minutes:

```logql
count_over_time({service="explore-web-admin", level="error"}[5m])
```

Admin moderation actions:

```logql
{service="explore-web-admin"} |= "Admin moderation action recorded"
```

Auth failures:

```logql
{service="explore-web-admin"} | json | status="401" or status="403"
```

Production-only:

```logql
{service="explore-web-admin", environment="production"}
```

## Metrics Notes

The current metrics layer is in-memory per serverless instance. It is useful for live diagnostics and scrape/push integration, but it is not a durable data warehouse.

Do not use these metrics for product analytics such as DAU, WAU, retention, CTR, impressions, clicks, or route starts. Those require an analytics foundation.
