# Metric Readiness

3.3 introduces one server-owned readiness contract used by snapshots, narratives, and exports. Every metric reports availability, confidence, investor eligibility, comparison eligibility, source, unit, freshness, instrumentation start, privacy class, coverage gaps, and interpretation.

## Policy

| State | Headline use | Detail use | Required treatment |
| --- | --- | --- | --- |
| Verified | Allowed | Allowed | Show source, period, and comparison basis. |
| Partial | Conditional | Allowed | Prominent limitation; no conclusion beyond covered data. |
| Under investigation | No unqualified claim | Diagnostic only | Warning or omission. |
| Unavailable | No | Explain only | Never substitute zero. |

Percentage changes require a nonzero comparison denominator. Small baselines remain visible as absolute current/previous counts and are not promoted as durable growth. Financial eligibility additionally requires an authorized reconciled source and recognition policy.

## Quality dimensions

- **Pipeline operational readiness:** whether ingestion/aggregation is functioning.
- **Data completeness:** whether expected sources and coverage are present.
- **Metric correctness:** whether formulas and canonical invariants reconcile.
- **Reporting confidence:** whether a metric may support the selected audience and conclusion.
- **Historical coverage:** whether the requested comparison window is represented.

These states are deliberately independent. A running pipeline does not make incomplete data investor-ready.

## Current production classification

Canonical KPI formulas reconcile, but reporting confidence remains under investigation because the seven-day rejection proxy is 34.38%. Geography is partial at 50.4% destination-event coverage. Verified revenue and content attribution are unavailable. The report engine dynamically omits or qualifies affected sections.

Contract implementations: `investorMetricCatalog.mjs`, `dataReadiness.mjs`, `reportNarrative.mjs`, and `reportSnapshotService.mjs`. Automated tests cover partial/unavailable states, dynamic revenue omission, privacy, comparison validity, and classification-aware output.
