# Event Contract Matrix

Canonical version: `analytics-ingestion-v2` in `server/api-lib/analytics/analyticsEventContract.mjs`.

| Family | Events | Accepted entity types | Entity ID | Status |
|---|---|---|---|---|
| App lifecycle | `app_open` | `system`, `session`, or null | Optional | Tested |
| App lifecycle | `app_background`, `app_foreground` | `session` or `system` | Optional | Tested |
| Session lifecycle | `session_start`, `session_end` | `session` | Required | Tested |
| Route authoring | record, publish step/exit/complete, difficulty/transport correction | `route` | Required | Tested |
| Canonical product/search/content | Existing allowlist + Analytics Core taxonomy | Contract-specific | Taxonomy-specific | Regression tested |

Common required fields remain `event_id`, `session_id`, `event_name`, positive `event_version`, ISO `occurred_at`, a valid source/platform, and an identity (`user_id` from auth or `anonymous_id`). Properties/context are bounded JSON and sensitive/location keys are removed.

Contract behavior is strict:

- unknown event names are dead-lettered;
- vocabulary-valid but event-incompatible entities are rejected;
- route/session events that require identity cannot omit `entity_id`;
- accepted `event_id` values remain unique, preserving idempotency;
- test/admin/automated traffic is retained but excluded from analytical eligibility;
- the allowlist is not expanded without an observed producer contract.

The manifest is suitable for producer documentation. Generating a mobile language binding is recommended in the mobile repository; it is not fabricated here.
