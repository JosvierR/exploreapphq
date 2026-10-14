# Explore Intelligence 3.3

Release-candidate evidence for investor-grade reporting, analyst workflows, data integrity, and performance. This directory is the handoff source for the 3.3 change set; it does not imply that the code is deployed.

## Outcome

The candidate adds centralized metric readiness, content-aware report narratives, five purpose-built PDF products, explicit revenue boundaries, analyst-friendly context, and a rebuilt report builder. All report artifacts use nonproduction fixture data and are visibly labeled. Production evidence was collected read-only on 2026-10-14 UTC.

External investor distribution remains **NO-GO** until ingestion coverage is corrected and a reviewed release is deployed. The latest seven-day audit observed 2,357 accepted and 1,235 rejected rows, a 34.38% operational rejection proxy. Verified revenue is unavailable, not zero.

## Evidence map

- [Reference PDF audit](PDF_REFERENCE_AUDIT.md)
- [Analyst experience](ANALYST_EXPERIENCE.md)
- [Data usefulness and readiness](DATA_USEFULNESS_AUDIT.md)
- [Metric readiness contract](METRIC_READINESS.md)
- [Report design system](REPORT_DESIGN_SYSTEM.md)
- [Templates and products](REPORT_TEMPLATES.md)
- [Investor PDF QA](INVESTOR_REPORT_QA.md)
- [Frontend performance](FRONTEND_PERFORMANCE.md)
- [Backend performance](BACKEND_PERFORMANCE.md)
- [PDF performance](PDF_PERFORMANCE.md)
- [Security review](SECURITY_REVIEW.md)
- [Data reconciliation](DATA_RECONCILIATION.md)
- [Accessibility](ACCESSIBILITY_REPORT.md)
- [QA report](QA_REPORT.md)
- [Release notes](RELEASE_NOTES.md)
- [Final release decision](FINAL_RELEASE_REPORT.md)

Actual PDFs are in `reports/`, all 58 rendered pages and contact sheets are in `reports/rendered/`, 87 responsive browser snapshots are in `screenshots/`, and reproducible measurements are in `benchmarks/`.

## Reproduction

```text
npm run lint
npm test
npm run build
npm run test:e2e
npm run test:e2e:perf
npm run reports:samples
npm run reports:benchmark
python scripts/validate-pdf-artifacts.py .tmp/pdf-render-libs --report-dir docs/admin-v3.3/reports
```

Production audit commands are read-only: `analytics:ingestion-audit`, `analytics:executive-reconcile`, `business:audit`, `business:fingerprint`, and `verify:business-schema`. No production data, schema, deployment, or historical events were changed.
