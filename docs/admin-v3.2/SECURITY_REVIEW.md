# Security Review

## Ingestion and data

- Event ingestion retains bounded batches/payloads, strict vocabularies, auth verification, rate limiting, JSON depth/size limits, redaction, and accepted-event idempotency.
- Dead-letter payloads are sanitized; analytics properties/context cannot retain tokens, secrets, authorization values, precise coordinate keys, emails, or raw user IDs.
- Reviewed analytical relations and maintenance RPCs remain private to service/admin paths; production schema verification passed all RLS/permission checks.

## Revenue

- AdMob OAuth occurs server-side and uses read-only scope.
- Refresh/client/access tokens never enter adapter return values or logs; browser-secret audit passed across 123 built artifacts.
- Missing credentials result in disconnected state without a network call.
- Estimated earnings are not mislabeled as final revenue.

## Reports

- Report endpoint requires admin authentication.
- Input enums/sections/title/note/body size are allowlisted/bounded.
- PDFs are returned `private, no-store`; no upload/public URL path exists.
- Aggregated investor output suppresses cohorts below five and excludes search text/user identifiers.
- Capacity guard rejects a third concurrent generation request with HTTP 429 semantics.

## Residual risk

Production metrics are process-local, external financial credentials are unverified, mobile producer source is outside this repository, and historical dead letters contain repeated IDs. These conditions block unqualified external reporting but do not require a new production write or schema change.
