# Explore Intelligence 3.2

Production Reliability, Analytics Integrity, Revenue Integrations & Investor Reporting Validation.

This release candidate centralizes the analytics producer/server contract, corrects ingestion-health mathematics, adds actionable freshness and alert diagnostics, attaches confidence metadata to investor reporting, implements a server-only read-only AdMob adapter, and validates the reporting system across its full option matrix.

No deployment, migration, dead-letter replay, financial API call, or production write was performed. Production checks were read-only.

## Release decision

**Overall: NO-GO for external production/investor release on 2026-10-14.** The code candidate is ready for a controlled deployment, but 3.2 is not deployed, the 7-day window remains historically affected by a 34.43% operational rejection-coverage proxy, durable production alert delivery is not configured, and financial providers are disconnected. See [FINAL_RELEASE_REPORT.md](FINAL_RELEASE_REPORT.md).

| Readiness layer | Classification | Evidence |
|---|---|---|
| Code ready | Ready | 73 unit/integration tests, build, OpenAPI, secret audit, 168-PDF matrix |
| Integration ready | Partial | Analytics/Supabase verified; AdMob adapter code-ready but credentials absent |
| Data ready | Under investigation | 196 accepted / 0 rejected after the live correction; historical windows remain affected |
| Deployment ready | Conditional | No migration required; rollback and canary plan documented; 3.2 not live |
| Production verified | Pending | Current production is commit `0427d1d`; sustained 3.2 post-deploy window not observed |
| Investor reporting approved | Internal fixtures only | PDF mechanics pass; production-data external distribution remains blocked |

## Evidence map

- [Production readiness audit](PRODUCTION_READINESS_AUDIT.md)
- [Ingestion root cause](INGESTION_ROOT_CAUSE.md) and [fix validation](INGESTION_FIX_VALIDATION.md)
- [Event contract matrix](EVENT_CONTRACT_MATRIX.md) and [analytics observability](ANALYTICS_OBSERVABILITY.md)
- [KPI reconciliation](KPI_RECONCILIATION.md) and [metric coverage matrix](METRIC_COVERAGE_MATRIX.md)
- [Revenue integrations](REVENUE_INTEGRATIONS.md) and [AdMob integration](ADMOB_INTEGRATION.md)
- [Investor report validation](INVESTOR_REPORT_VALIDATION.md) and [PDF quality](PDF_QUALITY_REPORT.md)
- [Security](SECURITY_REVIEW.md), [performance](PERFORMANCE_REPORT.md), and [QA](QA_REPORT.md)
- [Deployment](DEPLOYMENT_PLAN.md), [rollback](ROLLBACK_PLAN.md), and [historical recovery](HISTORICAL_EVENT_RECOVERY_PLAN.md)

Machine-readable evidence is under [`reports/`](reports/); the 87-image visual matrix is under [`screenshots/`](screenshots/).
