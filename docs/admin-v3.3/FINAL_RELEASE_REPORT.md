# Final Release Report

Decision date: 2026-10-14 UTC.

## Decision

**Code release candidate: GO. Production deployment: not performed. External investor use with current production data: NO-GO.**

3.3 materially improves the analyst workflow and report quality while preserving server authorization and aggregate-only output. Local build, 74 unit/contract tests, 16 browser tests, 87 visual comparisons, accessibility, PDF, performance, and security gates pass. The deployed environment was not changed and may not contain this candidate.

External use remains blocked by evidence, not presentation:

1. Seven-day operational rejection coverage is 34.38% (2,357 accepted / 1,235 rejected).
2. Destination-event geography coverage is 50.4%.
3. No reconciled authorized financial source supplies verified revenue.
4. Content-attribution facts contain zero rows.
5. Spanish static report chrome is localized, but canonical source prose remains in its reviewed source language when no approved translation exists.
6. PDF output is searchable and language-tagged but not fully tagged PDF/UA.

## Delivered

- Canonical readiness, comparison, eligibility, narrative, and insight contracts.
- Analyst-first dashboard context and a product-aware report builder.
- Investor Snapshot, Executive Business Report, Analyst Report, 16:9 Presentation, dashboard exports, English/Spanish examples, 58 rendered previews, and 87 UI screenshots.
- Read-only production reconciliation and schema/security verification.
- Reproducible frontend and PDF benchmarks.

## Performance result

Compared with the 3.2 lab baseline, authenticated usability improved 6.7%, product navigation 14.4%, filter response 9.6%, longest observed task 13.9%, and heap use 11.2%. Initial raw bytes are unchanged and gzip changes by only +3 bytes. Richer 3.3 PDFs cost more isolated CPU than 3.2, so no false PDF-speed claim is made; p95 remains 2–14 ms by product and the concurrency guard passes.

## Deployment plan

1. Review and deploy the exact 3.3 commit to a controlled preview/canary.
2. Verify admin authorization, report streaming, and all five products using sanitized or approved data.
3. Observe at least 24 hours and 100 attempts with the corrected producers; require <1% legitimate rejection rate.
4. Rerun ingestion, reconciliation, schema, security, browser, and report checks against the deployed revision.
5. Obtain finance approval and source reconciliation before enabling revenue headlines.
6. Approve external investor distribution only after data-quality owners sign off.

## Rollback plan

Use the hosting provider's immutable previous deployment, verify `/admin` authentication and analytics health, and invalidate any private generated downloads if necessary. This release has no schema migration or production-data mutation to reverse. If only reporting fails, disable or route away from the report endpoint while retaining existing dashboard views. Re-run the secret audit and read-only reconciliation after rollback.

## Production assurance

No deployment, migration, replay, provider activation, alert mutation, or production data write occurred during 3.3. All live evidence gathering was bounded and read-only. Exact commit identification is added at handoff after the candidate is committed.
