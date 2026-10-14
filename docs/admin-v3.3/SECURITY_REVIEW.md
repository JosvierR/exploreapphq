# Security Review

## Authorization and delivery

Report creation remains behind the existing server-side admin gate. Classification is parsed and enforced on the backend; the UI is not the trust boundary. PDFs are streamed through the authorized response path with sanitized filenames rather than published to a predictable public artifact URL.

Snapshot output contains aggregate business data, a role/opaque actor reference for audit, and lineage metadata. It excludes emails, raw user IDs, anonymous/session identifiers, tokens, authentication metadata, raw searches, raw payloads, personal histories, and credentials. Small-cohort and ranking rules remain in the data service before the PDF renderer sees rows.

## Verification

- Browser-secret audit: pass; 123 built artifacts scanned and no server secret exposed.
- PDF scan: pass across 58 pages; no sensitive-string matches.
- Schema verification: pass; required business relations have RLS and direct anonymous/authenticated access is denied for facts, snapshots, aggregation, and geo-resolution operations.
- OpenAPI surfaces: Admin, Edge, and generated PostgREST specifications pass validation.
- Authentication/authorization E2E: invalid credentials, non-admin denial, interrupted verification recovery, expired session, and sign-out are covered.

## Differencing and exports

The report does not export raw identities or arbitrary drill-down payloads. Related tables use the same aggregate snapshot, and unavailable/small data is omitted or qualified. This reduces, but does not mathematically eliminate, all differencing risk across separately generated reports; future filters must retain minimum cohorts and authorization checks.

## Production actions

No deployment, migration, provider connection, historical replay, production write, or secret mutation occurred. Production audits were read-only. The nonproduction PDF artifacts are labeled and must not be confused with production evidence.
