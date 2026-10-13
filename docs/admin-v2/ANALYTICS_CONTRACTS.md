# Admin analytics contracts

## Route ownership

| UI | Contract |
|---|---|
| `/admin` | Executive composition over existing product analytics and operations endpoints |
| `/admin/analytics` | Ingestion/operations endpoints under `/api/admin/analytics/*` |
| `/admin/analytics/data` | Product insight endpoints under `/api/admin/analytics/business/*` |
| `/admin/analytics/business` | Tourism BI Core v2 under `/api/admin/business/*` |

The similar historical endpoint names are not permission to merge the surfaces. Router paths and backend contracts are authoritative.

## Shared response requirements

- `request_id` for support correlation.
- Explicit period/range.
- Warnings and quality state where applicable.
- Previous-period deltas only when returned by the backend.
- `data_as_of` for BI snapshots when data exists.
- `null`/missing remains unavailable; it is not normalized to zero in display code.

## Metric semantics

- Active users are distinct observed authenticated plus anonymous identifiers from analytics, not total registered profiles.
- App opens include the canonical app/session start event set defined by the backend.
- Funnel steps are presented as observed event stages. The UI explicitly avoids claiming user-level conversion when step populations may differ.
- Commercial actions are directions, calls, website clicks, and map opens from the canonical Business Analytics Core.
- Demand Index, Opportunity Score, Business Score, confidence, evidence, and sample thresholds come only from the backend dictionary/core.

## Filters and concurrency

- Product: `24h|7d|30d|90d`, platform, source, content type, tab.
- Tourism: `7d|30d|90d|12m`, comparison, granularity, map metric, category, platform, source, destination hierarchy, tab.
- Supported shared filters are serialized into the URL.
- Filter changes create a fresh `AbortController`; effect cleanup aborts the previous request.
- State updates ignore `AbortError`, preventing an older response from replacing newer filter data.

## Empty and quality states

- `—`: the value is absent or invalid.
- `zero`: the backend returned an explicit numeric zero.
- `missing_tracking`: a prerequisite event is absent.
- `low_sample`: evidence exists but is below the reporting threshold.
- `processing`: aggregation/sync is incomplete.
- API error: visible safe message and `request_id` when supplied.

## Privacy

- Product search renders fingerprints/hashes, not raw search text.
- Tourism geography is aggregated and distinguishes destination from traveler origin.
- No individual coordinates, trip histories, raw tokens, cookies, or service keys are rendered.
- Business endpoints must remain tenant-scoped in both queries and cache keys.

## Pipeline integrity

```text
analytics_events
  -> analytics_valid_events
  -> analytics_normalized_events
  -> daily facts
  -> Business Analytics Core
  -> APIs
  -> Admin UI
```

This redesign changes presentation and composition only. It does not rewrite raw events, score formulas, database schema, or aggregation history.
