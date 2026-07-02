# DATA-002 Analytics Events Ingestion API

## Endpoint

`POST /api/events`

Mobile clients send analytics batches to the web backend. Mobile must not insert analytics events directly into Supabase.

The backend validates, enriches, redacts, rate limits, optionally authenticates, and inserts into `public.analytics_events` with server-side Supabase credentials.

## Schema Setup (required once)

Apply the migration before calling `POST /api/events` in production:

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/ookbeuiavzjhvezvamfu/sql/new) for the Explore project.
2. Paste and run `supabase/migrations/20260701120000_analytics_events.sql`.
3. Paste and run `supabase/migrations/20260702120000_analytics_events_data001_compat.sql`.

Without these tables, ingestion returns `503` with `"Analytics schema not installed."`.
Other Supabase readiness problems return a safe error code, for example
`analytics_column_mismatch`, while the server log records the full safe
Supabase error fields under the same `request_id`.

Tables created:

- `public.analytics_events` — validated event rows (deduped by `event_id`)
- `public.analytics_event_dead_letters` — rejected events for debugging

Inserts use the Vercel `SUPABASE_SECRET_KEY` service role. Mobile clients must not write to these tables directly.

## DATA-001 Insert Contract

`POST /api/events` only inserts the DATA-001 analytics event columns:

- `event_id`
- `user_id`
- `anonymous_id`
- `session_id`
- `event_name`
- `event_version`
- `entity_type`
- `entity_id`
- `source`
- `platform`
- `app_version`
- `build_number`
- `device_os`
- `locale`
- `timezone`
- `country`
- `region`
- `city`
- `properties`
- `context`
- `occurred_at`

The ingestion API does not insert `id`, `received_at`, `created_at`, `batch_id`,
or `request_id` into `analytics_events`.

Dead-letter inserts use only:

- `event_id`
- `user_id`
- `anonymous_id`
- `reason`
- `payload`
- `source`

Dead-letter `payload` is sanitized before storage. Authorization headers, service
keys, tokens, email, raw `user_id` fields inside payloads, and exact GPS fields
are removed.

## Source Normalization

`source` is optional for clients. The backend derives a safe value before insert:

- missing `source` with `platform: "web"` becomes `source: "web"`
- missing `source` with `platform: "ios"` or `platform: "android"` becomes `source: "mobile"`
- missing `source` without a platform becomes `source: "mobile"`

Accepted explicit source values:

- `mobile`
- `web`
- `backend`
- `admin`

Mobile apps should normally omit `source` or send `mobile`. Web clients can send
`web`, but can also omit it when `platform` is `web`. Invalid explicit source
values are rejected before database insert with reason `invalid_source`; they do
not fail the whole batch.

## Required Environment Variables

Production ingestion requires:

- `SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

The service key must be a Supabase service-role JWT. The API logs only booleans
for `service_role_configured` and `service_key_looks_like_jwt`; it never logs the
key value.

## Auth Behavior

`Authorization: Bearer <supabase-user-token>` is optional.

- If a bearer token is present, the backend validates it with Supabase and derives `user_id` server-side.
- If no bearer token is present, the event is accepted as anonymous and `anonymous_id` is required.
- Any `user_id` sent by the client is ignored and removed from `properties` / `context`.

Invalid bearer tokens return `401`.

## Request Shape

```json
{
  "batch_id": "batch-uuid",
  "sent_at": "2026-07-02T10:00:00.000Z",
  "events": [
    {
      "event_id": "event-uuid",
      "event_name": "video_view_start",
      "event_version": 1,
      "anonymous_id": "stable-anonymous-id",
      "session_id": "session-id",
      "entity_type": "video",
      "entity_id": "video-id",
      "occurred_at": "2026-07-02T09:59:58.000Z",
      "platform": "ios",
      "app_version": "1.0.0",
      "build_number": "100",
      "locale": "es-DO",
      "timezone": "America/Santo_Domingo",
      "country": "DO",
      "region": null,
      "city": null,
      "properties": {},
      "context": {}
    }
  ]
}
```

## Validation

- Max 50 events per batch.
- Max request payload size: 256 KB.
- `event_id`, `event_name`, `session_id`, and `occurred_at` are required.
- `anonymous_id` is required when no authenticated user token is sent.
- `properties` and `context` must be JSON objects at the root.
- Huge nested payloads are rejected.
- Unknown event names are rejected with partial success behavior.

## Event Allowlist

Session/app:

- `app_open`
- `session_start`
- `session_end`
- `screen_view`

Search:

- `search_submitted`
- `search_result_clicked`
- `search_no_results`

Video:

- `video_impression`
- `video_view_start`
- `video_view_3s`
- `video_view_25`
- `video_view_50`
- `video_view_75`
- `video_view_complete`
- `video_skip_fast`
- `video_like`
- `video_unlike`
- `video_comment`
- `video_share`
- `video_open_places_routes`

Place:

- `place_impression`
- `place_click`
- `place_save`
- `place_unsave`
- `place_open_map`
- `place_get_directions`
- `place_share`
- `place_call`
- `place_website_click`

Route:

- `route_impression`
- `route_click`
- `route_save`
- `route_unsave`
- `route_start`
- `route_step_view`
- `route_complete`
- `route_share`

User/profile:

- `profile_view`
- `follow_user`
- `unfollow_user`

Moderation/user safety:

- `report_submitted`
- `content_hidden`
- `content_unhidden`
- `block_user`
- `unblock_user`

System:

- `push_notification_open`
- `deep_link_open`
- `error_boundary_shown`

## Privacy Redaction

Before insert, `properties` and `context` remove keys containing:

- `token`
- `secret`
- `password`
- `authorization`
- `refresh_token`
- `access_token`
- `service_role`
- `api_key`
- `email`
- `user_id`

Exact GPS fields are removed:

- `lat`
- `lng`
- `latitude`
- `longitude`
- `coordinates`

Allowed coarse location fields:

- `country`
- `region`
- `city`
- geohash only if coarse and sent under an allowed non-sensitive key.

## Response Shape

```json
{
  "ok": true,
  "request_id": "request-id",
  "accepted": 10,
  "duplicates": 2,
  "rejected": 1,
  "warnings": []
}
```

`request_id` is also returned in the `x-request-id` response header.

Safe error response for Supabase readiness failures:

```json
{
  "ok": false,
  "error": "Analytics ingestion is not ready.",
  "code": "analytics_column_mismatch",
  "request_id": "request-id"
}
```

`"Analytics schema not installed."` is used only for
`analytics_schema_missing`.

## Duplicate Behavior

The backend checks existing `event_id` values before insert. Duplicate `event_id` records do not crash the batch and are returned in `duplicates`.

Invalid events are best-effort inserted into `analytics_event_dead_letters` if the table exists. Dead-letter failures are logged safely and do not break the request.

## Rate Limits

In-memory rate limits are applied per IP plus anonymous id:

- 30 batches per minute.
- 900 events per minute.

These are lightweight serverless-instance limits for abuse protection and may reset when Vercel recycles an instance.

## Admin Preview

`GET /api/admin/analytics/overview`

Admin-only. Returns basic ingestion health and counts if `analytics_events` exists. If the schema is not installed, it returns:

```json
{
  "ok": true,
  "overview": null,
  "diagnostics": {
    "analytics_events_exists": false,
    "analytics_dead_letters_exists": null,
    "analytics_events_selectable": false,
    "analytics_dead_letters_selectable": null,
    "analytics_events_columns": [],
    "analytics_dead_letter_columns": [],
    "supabase_project_ref": "ookbeuiavzjhvezvamfu",
    "service_role_configured": true,
    "service_key_looks_like_jwt": true,
    "warnings": ["analytics_events: analytics_schema_missing"]
  },
  "warnings": ["analytics schema not installed"]
}
```

Diagnostics are admin-only and safe to show in the admin console. They do not
include secrets, bearer tokens, or raw event payload values.

## Troubleshooting `503` from `POST /api/events`

1. Copy the response `request_id` or the `x-request-id` response header.
2. Search Vercel logs for that `request_id`.
3. Check the structured log fields:
   - `operation`
   - `table`
   - `error_code`
   - `error_message`
   - `error_details`
   - `error_hint`
   - `classified_code`
   - `project_ref`
   - `service_role_configured`
   - `service_key_looks_like_jwt`
4. Open `GET /api/admin/analytics/overview` as an admin and inspect
   `diagnostics`.

The previous `[object Object]` log issue was caused by stringifying plain
Supabase/PostgREST error objects with `String(error)`. The router now serializes
known Supabase fields directly: `name`, `message`, `code`, `status`, `details`,
and `hint`.

### Error Code Meanings

- `analytics_schema_missing`: table or relation is missing.
- `analytics_column_mismatch`: the table exists, but an inserted or selected
  column is not available through PostgREST.
- `analytics_permission_denied`: service role is not allowed to select/insert.
- `analytics_schema_cache_stale`: PostgREST schema cache likely needs reload.
- `analytics_constraint_failed`: row failed a database constraint.
- `analytics_duplicate_conflict`: duplicate `event_id` conflict after retry.
- `analytics_service_role_missing`: server Supabase credentials are missing.
- `analytics_unknown_supabase_error`: Supabase returned an unclassified error;
  use the request log fields above.

### Verify Schema with SQL

Run in Supabase SQL Editor:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'analytics_events'
order by ordinal_position;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'analytics_event_dead_letters'
order by ordinal_position;
```

Verify the event insert columns listed in this document exist. If the columns
were added recently and PostgREST still returns `PGRST204` or mentions schema
cache, reload the Supabase API schema cache from the Supabase dashboard.

## Local Testing

Anonymous valid event:

```bash
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{"batch_id":"local-batch","sent_at":"2026-07-02T10:00:00.000Z","events":[{"event_id":"local-event-1","event_name":"app_open","session_id":"session-1","anonymous_id":"anon-1","occurred_at":"2026-07-02T10:00:00.000Z","platform":"ios","properties":{},"context":{}}]}'
```

Invalid event:

```bash
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{"events":[{"event_id":"bad-1","event_name":"unknown_event","session_id":"session-1","anonymous_id":"anon-1","occurred_at":"2026-07-02T10:00:00.000Z","properties":{},"context":{}}]}'
```

Admin overview without auth should return `401`:

```bash
curl http://localhost:3001/api/admin/analytics/overview
```
