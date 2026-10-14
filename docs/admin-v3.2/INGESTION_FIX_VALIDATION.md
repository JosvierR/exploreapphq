# Ingestion Fix Validation

Live deployment creation: `2026-10-13T23:12:40.724Z`. Latest historical rejection: `2026-10-13T22:28:08.538269Z`, 44 minutes before deployment.

Read-only audit at `2026-10-14T02:14:45.209Z`:

| Window | Accepted | Rejected | Operational rejection proxy |
|---|---:|---:|---:|
| Since live cutoff | 196 | 0 | 0% |
| 1 hour | 0 | 0 | 0% / no traffic |
| 6 hours | 251 | 50 | 16.61% (contains pre-deploy history) |
| 24 hours | 592 | 217 | 26.82% |
| 7 days | 2,381 | 1,250 | 34.43% |
| 30 days | 10,962 | 4,895 | 30.87% |

The evidence strongly supports that the live narrow correction stopped the observed contract rejects prospectively. It does not make historical windows complete, and the 2h39 observation span at the first audit is too short for final production approval.

Acceptance criteria for 3.2 post-deploy:

1. `analytics-ingestion-v2` appears in the authenticated health response.
2. At least 100 observed post-deploy attempts and 24 hours elapse.
3. Rejection proxy stays below 1%; no known legitimate event is rejected.
4. Authentication failures remain below alert threshold.
5. Latest accepted-event lag is within 15 minutes during expected-traffic periods.
6. No aggregation failure and KPI invariants continue to match.

Evidence: [`reports/production-ingestion-audit.json`](reports/production-ingestion-audit.json).
