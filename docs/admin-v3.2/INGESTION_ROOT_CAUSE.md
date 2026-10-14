# Ingestion Root Cause

## Finding

The production rejection history is genuine, not a dashboard arithmetic artifact. Mobile producers emitted legitimate session lifecycle and route-authoring events whose names/entity vocabulary were temporarily absent from the server allowlist. The database already permitted `session`; the failure occurred at server validation before accepted-row insertion.

Historical dead letters contain only two reasons:

| Reason | Rows | Dominant events |
|---|---:|---|
| `entity_type is invalid` | 6,493 | `session_start`, `session_end`, `app_open` lifecycle payloads |
| `event_name is not allowed` | 2,792 | `app_background`, `app_foreground`, route publish/record/correction events |

All 9,285 rejected rows identify source `mobile`; 9,163 use the `session` entity and 122 use `route`. There are 586 repeated dead-letter event IDs spanning 1,320 rows, proving retry behavior and making dead-letter rows unsuitable as a unique-attempt denominator.

## Rate correction

The old health calculation divided rejected rows by accepted rows. The corrected formula is:

`rejection rate = rejected / (accepted + rejected)`

The production audit uses this as an **operational coverage proxy**, not a unique-client-attempt rate, because accepted events are unique by `event_id` while dead letters retain retries.

## Authentication

Bearer failures occur before payload validation and therefore do not enter the dead-letter table. The retained Vercel sample contained four `/api/events` requests, all HTTP 200, and no 401/403; only six request-log rows were available, so this cannot establish historical absence. 3.2 adds an authentication-failure Prometheus rule, while durable production log retention remains a release condition.

## Producer limitation

This repository does not include the React Native/Expo producer implementation, so direct client-source verification is impossible here. The versioned server manifest and contract tests are authoritative repository evidence; mobile release/version correlation must be completed in the mobile repository before broadening the contract again.
