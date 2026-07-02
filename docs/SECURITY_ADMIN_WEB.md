# Admin Web Security

## Server-Only Variables

These must never be exposed to frontend code or prefixed with `VITE_`:

- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `METRICS_TOKEN`
- `GRAFANA_LOKI_TOKEN`
- `GRAFANA_LOKI_USERNAME`
- `GRAFANA_LOKI_URL`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- SMTP, Twilio, Resend, and other provider secrets.

## Frontend-Safe Variables

These may be used by Vite when they are public by design:

- `VITE_SITE_URL`
- `VITE_EXPLORE_WEB_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- Firebase web client config.

Never put a Supabase service role key in `VITE_SUPABASE_*`.

## Admin Auth Expectations

Admin API routes require a valid Supabase user token and server-side admin authorization. Authorization is checked through `admin_users` and optional `EXPLORE_ADMIN_ALLOWED_EMAILS` fallback.

The UI must not show:

- Access tokens.
- Refresh tokens.
- Raw Supabase auth payloads.
- Cookies.
- Service role keys.
- Grafana tokens.

## Metrics Protection

Preferred metrics route:

- `GET /api/admin/system/metrics`

This is admin-only.

Optional scraper route:

- `GET /api/metrics`

This requires `METRICS_TOKEN`. If the token is missing from the environment, `/api/metrics` returns 404.

## Logging Redaction

Structured logs redact common sensitive keys and bearer-like tokens. Do not add full request bodies to logs for auth, admin, or moderation actions.

Safe logging fields:

- `request_id`
- `route`
- `method`
- `status`
- `duration_ms`
- `admin_user_id`
- `admin_email`
- `action_type`
- `target_type`
- `target_id`
- `report_id`
- previous/next moderation state.

Unsafe logging fields:

- Passwords.
- Authorization headers.
- Cookies.
- Access tokens.
- Refresh tokens.
- Full auth payloads.
- Service role keys.
- Grafana tokens.

## Safe Debugging

When a user reports an admin issue, ask for the visible request id or debug id. Use that id to search server logs. Do not ask users to paste tokens, cookies, or raw auth payloads.
