# Investor Report Security Review

## Controls implemented

| Risk | Control |
| --- | --- |
| Unauthenticated export | `POST /api/admin/business/reports` calls server-side `requireAdmin`; browser state is not trusted for authorization |
| Direct API bypass | Both Revenue and Reports live behind the same authenticated server router as canonical business intelligence |
| PII leakage | Investor projection allowlists aggregate fields; search text, payloads, user IDs, anonymous IDs, and emails are absent |
| Small-group exposure | Market/category/insight cohorts below five are suppressed |
| Operational leakage | Dead letters, raw events, health internals, and moderation data never enter the report snapshot |
| Revenue fabrication | Unreconciled sources return `null` plus an unavailable reason; commercial actions carry an intent disclaimer |
| Untrusted cover copy | Title/note control characters are removed and lengths are capped at 100/360 characters; PDF metacharacters are escaped |
| Excessive payload | Request body is capped at 32 KiB and every enum/section is allowlisted |
| Resource exhaustion | Two active report generations per server instance; fixed row limits; bounded section/page set; Vercel duration remains 30 seconds |
| Public file exposure | PDF is streamed directly with `private, no-store`, `Pragma: no-cache`, and `nosniff`; no public storage object is created |
| Ambiguous provenance | Report embeds source version, metric catalog, data-as-of, classification, actor reference, and snapshot fingerprint |
| Audit PII | Structured log stores one-way actor reference rather than email/raw user ID, plus report type/format/language/page count/fingerprint |

## Authorization behavior

- Both `admin` and `moderator` roles accepted by the existing admin guard can generate reports, consistent with current Admin API policy.
- The UI is not an authorization boundary.
- Classification options do not unlock raw operational fields. `executive_business` and `investor_safe` both pass through the same safe aggregate projection in this release.

## Delivery and retention

Generated reports are not uploaded or retained by the application. The response is a private direct download. Application logs contain generation metadata but no PDF body or underlying metric rows. If a durable compliance trail becomes necessary, add a private RLS-protected audit table with an explicit retention policy; do not store report bytes by default.

## Known constraints

- The concurrency guard is per serverless process, not a global distributed semaphore. Fixed page/row bounds and platform duration still limit an individual invocation.
- Type 1 Helvetica/Helvetica Bold with WinAnsi supports the shipped English and Spanish output. Additional scripts require embedded Unicode fonts.
- The system does not digitally sign PDFs. Snapshot fingerprints provide reconciliation, not cryptographic authorship/non-repudiation.
- Live production data quality remains degraded as documented in [Data readiness audit](data-readiness-audit.md).

## Verification evidence

- Authentication/role tests in the existing suite pass.
- Request enum, length, deterministic filename, cohort suppression, and PII exclusion tests pass.
- Generated PDFs are checked for page-tree integrity, selectable text, media boxes, EOF/xref structure, and forbidden fixture content.
- Every committed sample page was rasterized and visually inspected.
