# DATA-002 Analytics Events Ingestion API

## Endpoint

`POST /api/events`

Mobile clients send analytics batches to the web backend. Mobile must not insert analytics events directly into Supabase.

The backend validates, enriches, redacts, rate limits, optionally authenticates, and inserts into `public.analytics_events` with server-side Supabase credentials.

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
  "warnings": ["analytics schema not installed"]
}
```

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
