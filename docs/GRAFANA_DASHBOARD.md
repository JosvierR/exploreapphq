# Grafana Dashboard Guide

## Required Setup

Logs:

- `GRAFANA_LOGS_ENABLED=true`
- `GRAFANA_LOKI_URL=<loki push url>`
- `GRAFANA_LOKI_USERNAME=<instance id if required>`
- `GRAFANA_LOKI_TOKEN=<sensitive token>`

Metrics:

- Prefer `GET /api/admin/system/metrics` while signed in as admin.
- Use `GET /api/metrics` only when `METRICS_TOKEN` is configured and the scraper sends `Authorization: Bearer <token>`.

Do not put Grafana or metrics tokens in `VITE_` variables.

## Suggested Panels

1. API requests per minute.
2. API error rate.
3. P95 request duration.
4. Admin actions over time.
5. Video moderation actions over time.
6. Report queue size.
7. Pending reports.
8. Hidden/removed content count.
9. Supabase error count.
10. Auth failure count.
11. Health check status.
12. Recent error logs.
13. Top failing routes.
14. Moderation action breakdown.

## Example LogQL

Recent errors:

```logql
{service="explore-web-admin", level="error"}
```

Route-specific logs:

```logql
{service="explore-web-admin", route="/api/admin/reports"}
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
{service="explore-web-admin", route=~"/api/admin/.*"} |= "Access denied"
```

## Metrics Notes

The current metrics layer is in-memory per serverless instance. It is useful for live diagnostics and scrape/push integration, but it is not a durable data warehouse.

Do not use these metrics for product analytics such as DAU, WAU, retention, CTR, impressions, clicks, or route starts. Those require an analytics foundation.
