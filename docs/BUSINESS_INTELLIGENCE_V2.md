# Explore Business Intelligence v2

## Product contract

Business Intelligence is a shared data product, not an Admin-only collection of widgets.

```text
eligible Explore events
  → canonical event taxonomy
  → daily facts + historical dimensions
  → Business Analytics Core v2
  → authorization + entitlements
  → Admin / Business Web / Business Mobile / Partner API
```

The server owns metric definitions, formulas, confidence rules, comparisons, insights, and entity-name resolution. Clients render the response and must not recreate critical analytics logic.

## Source of truth and validity

- `analytics_events` remains the immutable raw source of truth.
- `event_id` is the primary key and idempotency key. Mobile retries do not double count.
- `analytics_valid_events` is the dashboard input. It excludes Admin-generated, QA/test, automated, and explicitly ineligible traffic without deleting raw rows.
- Events that fail validation are written to `analytics_event_dead_letters`.
- The ingestion API keeps normalized identifiers (`entity_id`, `source_type`, `source_id`, `geo_id`) outside arbitrary JSON.
- `properties` is reserved for bounded event-specific fields.

The migrations `20260811150000_business_intelligence_v2.sql` and `20260811210000_business_intelligence_production_activation.sql` add the raw/validated/normalized pipeline, normalized Business/geography model, slowly changing dimensions, facts, metric definitions, taxonomy, RLS, idempotent backfill, schema verification, quality reporting, feature gating, and monitored aggregate RPCs.

## Core versions

| Contract | Version | Source |
|---|---:|---|
| Business Analytics Core | `v2` | `businessAnalyticsCore.mjs` |
| Event taxonomy | `v1` | `EVENT_TAXONOMY` + `analytics_event_taxonomy` |
| Metrics dictionary | `v1` | `METRIC_DICTIONARY` + `business_metric_definitions` |
| Explore Demand Index | `v1` | `calculateDemandIndex()` |
| Explore Opportunity Score | `v1` | `enrichCategoryIntelligence()` |
| Explore Business Score | `v1` | `buildBusinessBenchmark()` |

Definitions are available to authorized consumers at:

- `GET /api/admin/business/definitions`
- `GET /api/business/v1/definitions`

## Canonical commercial-intent model

| Stage | Events |
|---|---|
| Discovery | `place_impression`, `route_impression`, `content_impression`, `search_performed` |
| Engagement | `place_view`, `route_view`, `content_view`, saves, shares, ratings |
| Navigation | `route_start`, `route_stop_view`, `route_complete` |
| High intent/action | `place_get_directions`, `place_call`, `place_website_click`, `place_map_open` |

`commercial_actions` is the sum of directions, calls, website clicks, and map opens. `intent_rate` is commercial actions divided by place views. The metric tooltip text comes from the canonical dictionary.

## Demand Index v1

The index uses eight period-over-period signals when available:

- active travelers
- sessions
- searches
- place views
- route views
- saves
- route starts
- commercial actions

Each reliable signal is normalized as:

```text
signal_score = clamp(50 + 25 × log2((current + 1) / (previous + 1)), 0, 100)
demand_index = equal-weight mean(signal_score)
```

This has interpretable anchors: unchanged = 50, approximately doubled = 75, approximately halved = 25. A prior-period baseline below 8 is excluded, so `1 → 2` is never presented as a major trend. At least three reliable components are required; otherwise the index is `null` with `status=insufficient_data`.

## Opportunity Score v1

For categories with at least 10 demand observations, the score is the equal-weight mean of available cohort percentiles:

- demand
- demand growth
- search activity
- intent rate
- save/conversion rate
- inverse observed supply
- inverse competition (observed supply percentile)

At least four components are required. The score indicates a supply-demand pattern worth investigating. It is never a profitability prediction.

## Business Score v1 and benchmarks

Business Score is separate from Opportunity Score. It compares a place with an aggregated category cohort using:

- discovery
- engagement
- intent
- growth
- reputation

At least 10 place views, three available components, and four cohort members are required. The API also returns the business value, category average, and top quartile for view-to-save, view-to-directions, and growth. It does not expose a named competitor comparison.

## Automated insights

Insights are deterministic and contain:

```json
{
  "evidence": "150 current vs 100 comparison-period events",
  "confidence": "high",
  "sample_size": 150,
  "period": { "start": "...", "end": "..." },
  "comparison_period": { "start": "...", "end": "..." },
  "metric": "place_views",
  "anchor": "market-pulse"
}
```

Confidence is `high` from 100 comparison observations, `medium` from 30, otherwise `low`. Trend claims require the minimum baseline and a material change. Low-sample opportunities are suppressed. Recommendations are phrased as considerations and always link to evidence.

## Common query contract

All shared endpoints accept the same filter vocabulary:

```text
from / to                       custom current period
compare_from / compare_to       custom comparison period
range                           7d | 30d | 90d | 12m
compare                         previous | previous_year | none
geo_id
country / region / city / neighborhood
business_id / location_id
category_id / category
platform / source
granularity                     daily | weekly | monthly
map_metric                      demand | users | views | intent | searches | growth | supply | opportunity
compare_market                  repeat up to five times
```

Every analytics response includes `data_as_of` when data exists. The dashboard uses one snapshot so all sections are mutually consistent.

## Business authorization

Authorization is enforced in `businessAccess.mjs`, never only in UI.

- Admins: global scope.
- Business members: must have an active account and membership role (`owner`, `admin`, `analyst`, or `viewer`).
- Own-business endpoints: restricted to `business_locations.place_id` values.
- Market endpoints: require `VIEW_MARKET_ANALYTICS` and a matching active row in `business_market_access`; own location geographies are included automatically.
- Additional capabilities use rows in `business_entitlements`; application code does not branch on plan names.

Plans seed entitlements through `business_plan_features`, while purchase, contract, or Admin overrides can add independent entitlement rows.

`business_intelligence_signals` is the delivery-neutral outbox for privacy-safe demand spikes/drops, ranking changes, search growth, opportunities, and traffic anomalies. Signals persist confidence, sample size, period, and evidence so future alerts and digests do not need a second scoring implementation.

## Shared API v1

The `/api/business/v1/*` surface includes overview, executive summary, mobile overview, geography, markets, comparison, demand, categories, searches, unmet demand, Place 360, Route 360, audience, time, attribution, funnel, opportunities, insights, and benchmarks.

Admin endpoints call the same `businessIntelligenceService.mjs`; they do not use a separate formula implementation.

## Geographic hierarchy

`geo_entities` uses neutral administrative levels:

```text
country → admin_level_1 → admin_level_2 → city/municipality → neighborhood/area
```

`parent_geo_id` forms the navigable hierarchy, and `timezone` supports destination-local day/hour aggregation. Legacy country/region/city event fields remain accepted during migration and are enriched from the place catalog when possible.

## Aggregates and performance

Daily analytical tables are:

- `fact_place_daily`
- `fact_route_daily`
- `fact_market_daily`
- `fact_search_daily`
- `fact_content_attribution`
- `fact_business_daily`

`aggregate_business_intelligence_for_day(date)` populates them from `analytics_valid_events`. The scheduled job runs it after `aggregate_analytics_events_for_day(date)` for UTC D-3 through D so late events are recomputed idempotently. The current API retains a raw-event fallback while the new facts are backfilled; the response warns when `analytics_valid_events` is not installed. Production rollout should backfill facts before switching high-volume markets to aggregate-only reads.

The Admin dashboard uses one initial snapshot request, stable skeletons, one lazy-loaded map, and no frontend metric recomputation. Deep endpoints allow future Business clients to lazy-load secondary analysis.

## Empty-state semantics

- `zero`: tracking exists, no qualifying activity occurred.
- `missing_tracking`: prerequisite event instrumentation is absent (for example route stop events).
- `low_sample`: data exists but cannot support a reliable insight.
- `processing`: reserved for aggregation/sync delay.
- API error: request failed and includes `request_id`.

## Privacy

- No individual traveler coordinates or histories are returned.
- Origins and audience segments are aggregated.
- Search text is visible only at the configured k-anonymity threshold (5); otherwise the UI shows a fingerprint.
- Behavioral segments use Explore activity, not sensitive personal attributes.
- Named competitor comparisons are avoided; benchmarks use category average/top quartile cohorts.

## Deployment order

1. Apply the v2 migration.
2. Backfill taxonomy/dimensions and daily facts.
3. Schedule `aggregate_business_intelligence_for_day` after the existing aggregation job.
4. Create Business accounts, memberships, locations, entitlements, and explicit market grants.
5. Deploy API and Admin UI.
6. Verify `/api/admin/business/health`, definitions, Admin dashboard, and an external Business account with restricted locations.

The production procedure, rollback, real-data QA gates, and incident response are defined in `BUSINESS_INTELLIGENCE_PRODUCTION_RUNBOOK.md`. The frozen Mobile/Web payload contract is defined in `BUSINESS_API_V1.md`.

## Verification

```bash
npm run lint
npm test
npm run build:api
npm run openapi:lint
npm run build
```

Core tests cover common filters, score formulas, low-sample suppression, benchmark cohort requirements, evidence-backed insights, and Business location scoping.
