# Release Notes — Explore Intelligence 3.2

## Reliability

- Added the versioned `analytics-ingestion-v2` event manifest and event-family entity rules.
- Corrected rejection-rate denominator and added 1h/6h/24h outcome windows.
- Added source freshness, latest rejection, readable diagnostics, volume-gated alerts, and Prometheus rules.
- Expanded read-only production ingestion audit and 17-KPI reconciliation artifacts.

## Revenue

- Added a server-only AdMob OAuth/reporting adapter with read-only scope, validation, timeout, cache, row bounds, micros conversion, and sanitized failures.
- Added explicit disconnected/configured/estimated states and provider metadata.
- Kept provider earnings as non-final estimates; verified revenue remains unavailable without reconciliation.

## Investor reporting

- Bumped report/catalog contracts to v2 and added metric-confidence metadata, UTC/cutoff/window, rejection coverage, and claim categories.
- Updated PDFs to Explore Intelligence 3.2 with confidence/quality metadata.
- Added complete 168-combination tests, partial/unavailable cases, sample artifacts, rendered-page validation, and performance benchmarks.

## Experience and operations

- Enhanced Analytics Operations with outcome windows, freshness, and alert cards.
- Enhanced Revenue with an AdMob estimate boundary and verified/estimated stream columns.
- Expanded visual coverage to all five viewports in both themes.

No production deployment, migration, revenue credential activation, event replay, or data write was performed.
