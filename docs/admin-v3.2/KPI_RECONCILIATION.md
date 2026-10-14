# KPI Reconciliation

The read-only seven-day reconciliation used `analytics_normalized_events` and the same `calculateCanonicalKpis` module as the dashboards. It evaluated 17 metrics and compared current/previous UTC windows.

## Current canonical window

| Metric | Value | Comparison note |
|---|---:|---|
| Active users | 59 | +55.3% vs prior; identity = authenticated user, else anonymous ID |
| Sessions | 108 | +9.1% |
| Place views | 34 | Normalized entity resolution |
| Route views | 14 | Normalized entity resolution |
| Route starts / completions | 10 / 1 | 10% completion |
| Commercial actions | 1 | Intent only, not revenue |
| Searches | 18 | −25% |
| Total valid events | 2,381 | +135.3% |

All direct canonical invariants match raw accepted rows: actors, sessions, route starts/completions, saves, shares, commercial actions, searches, and total events. Place/route view differences are expected because the normalized view resolves generic view events into canonical entity dimensions; raw rows are not the source of truth for those metrics.

The same window contains 1,250 dead letters and a 34.43% operational rejection-coverage proxy. Therefore behavioral KPIs are classified `under_investigation` for investor use even though the canonical computation is internally consistent. Small-sample deltas remain explicitly unreliable.

Evidence: [`reports/production-kpi-reconciliation.json`](reports/production-kpi-reconciliation.json).
