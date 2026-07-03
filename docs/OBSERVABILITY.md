# Explore Web/Admin Observability

## Request IDs

Every `/api/*` request receives an `x-request-id`.

Behavior:

- Incoming `x-request-id` is reused when safe.
- Otherwise the API generates a UUID.
- The response includes `x-request-id`.
- JSON error responses include `request_id`.
- Admin UI errors display request ids when available.

## Structured Logs

Server logs are JSON and compatible with Vercel stdout and Loki ingestion.

Core fields:

- `level`
- `message`
- `service`
- `environment`
- `version`
- `timestamp`
- `request_id`
- `route`
- `method`
- `status`
- `duration_ms`
- `admin_user_id`
- `admin_email`

Sensitive values are redacted. Do not log access tokens, refresh tokens, cookies, service role keys, Grafana tokens, or full auth payloads.

## Health Endpoints

Public:

- `GET /api/health`

Safe response only. It reports configured true/false flags and never returns secret values.

Admin-only:

- `GET /api/admin/system/health`

Requires admin auth and reports:

- API status.
- Admin auth status.
- Supabase connection status.
- Reachability of moderation tables.
- Metrics and Loki/Grafana configured status.
- Server time, environment, version, request id, and safe warnings.

## Metrics

Admin-only:

- `GET /api/admin/system/metrics`
- `GET /api/admin/system/metrics?format=json`

Optional token endpoint:

- `GET /api/metrics`

`/api/metrics` requires `METRICS_TOKEN` and `Authorization: Bearer <token>`. If `METRICS_TOKEN` is not configured it returns 404.

Metrics are in-memory per serverless instance. They reset when Vercel recycles an instance and are not a long-term analytics store.

Tracked metrics include:

- `explore_api_requests_total`
- `explore_api_errors_total`
- `explore_api_request_duration_ms`
- `explore_admin_actions_total`
- `explore_moderation_actions_total`
- `explore_reports_list_requests_total`
- `explore_report_detail_requests_total`
- `explore_video_moderation_actions_total`
- `explore_health_check_total`
- `explore_auth_failures_total`
- `explore_supabase_errors_total`

## Optional Loki Integration

Server-only variables:

- `GRAFANA_LOGS_ENABLED`
- `GRAFANA_LOKI_URL`
- `GRAFANA_LOKI_USERNAME`
- `GRAFANA_LOKI_TOKEN`

If not configured, logs go to stdout only. If Loki push fails, the user request still succeeds and the failure is logged as a warning.

Local Loki (Docker) does not require a token when `GRAFANA_LOKI_URL` points at `localhost` / `127.0.0.1`.

## Local OSS stack (free)

Code lives under `observability/`:

- Prometheus scrapes `http://host.docker.internal:3001/api/metrics`
- Grafana provisions Prometheus + Loki datasources and an Explore API dashboard
- Loki receives structured JSON logs from the API

```bash
# .env
METRICS_TOKEN=local-dev-metrics-token
GRAFANA_LOGS_ENABLED=true
GRAFANA_LOKI_URL=http://localhost:3100/loki/api/v1/push

npm run obs:up
npm run dev:api
```

| Tool | URL |
|------|-----|
| Grafana | http://localhost:3000 (`admin` / `admin`) |
| Prometheus | http://localhost:9090 |
| Loki | http://localhost:3100 |

Implementation modules:

- `server/api-lib/observability/logger.mjs`
- `server/api-lib/observability/metrics.mjs`
- `server/api-lib/observability/lokiLogger.mjs`

