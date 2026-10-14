# Canonical Investor Metric Catalog

Registry version: `investor-metrics-v1`. Report contract: `explore-intelligence-report-v1`.

| Metric | Exact definition | Formula | Source | Unit | Availability | Comparison | Privacy | Investor export |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Active users | Distinct observed identities active in the selected period. Authenticated identity takes precedence per event; anonymous-to-account linkage is not inferred. | `count(distinct user_id when present, otherwise anonymous_id)` | `analytics_normalized_events` via Business Analytics Core | users | Canonical source readable | Yes | Aggregate; cohorts below five suppressed | Yes |
| Sessions | Distinct valid emitted session identifiers in the selected period. No reconstructed timeout sessions are mixed in. | `count(distinct session_id)` | `analytics_normalized_events` via Business Analytics Core | sessions | Session contract present | Yes | Aggregate | Yes |
| Route starts | Validated route-start observations, not distinct routes or users. | `count(*) where event_name = route_start` | Canonical route taxonomy | events | Canonical source readable | Yes | Aggregate | Yes |
| Commercial actions | Observed directions, call, website, and map-open actions. This represents intent, not sales or revenue. | `directions + calls + website clicks + map opens` | Canonical commercial-action taxonomy | events | Canonical source readable | Yes | Aggregate | Yes, with disclaimer |
| Demand index | Versioned composite of observed demand, growth, intent, supply, and momentum. Suppressed when reliable components or samples are insufficient. | Business Analytics Core Demand Index v1 | Derived from canonical aggregates | 0–100 index | Minimum reliable components/sample | Yes | Aggregate | Yes |
| Verified revenue | Recognized or measured monetary value from an authorized revenue-system integration. | Source-system recognized revenue after refunds/adjustments for the selected period | No authorized source currently connected | currency | Unavailable until reconciled source exists | No | Financial aggregate | Yes only when verified; currently explicit unavailable |

## Shared semantics

- Reporting boundaries use UTC. Destination-local time is used only in local-time analysis where the canonical core has a reliable timezone.
- `data_as_of` is the latest canonical source timestamp, not the report-generation time.
- Comparison uses an exact previous period, previous year, or no comparison as selected.
- Zero is a measured result only after a complete readable source returns zero observations. Missing, disconnected, or unreconciled sources return `null` and an unavailable reason.
- Dashboard and PDF values come from the same snapshot; the PDF renderer never recomputes business metrics.
- Search text, event payloads, user identifiers, anonymous identifiers, and operator emails are not part of the investor projection.

The executable registry lives in `server/api-lib/intelligence/investorMetricCatalog.mjs`.
