# Explore Business API v1

## Stability contract

All Business clients use `/api/business/v1/*` and the same Business Analytics Core as Admin. Metric meaning belongs to the API, not to Web or Mobile clients.

Every successful analytics response includes:

```json
{
  "query": {
    "geo_id": null,
    "from": "2026-08-01",
    "to": "2026-08-11",
    "category": null,
    "business_id": "...",
    "location_id": null,
    "platform": null,
    "source": null
  },
  "data_as_of": "2026-08-11T20:00:00.000Z",
  "metric_version": "business-v2",
  "data_quality_grade": "high"
}
```

`query_metadata` repeats these debug fields as one stable object. `data_quality_grade` can be `high`, `limited`, or `error`. Entity identifiers remain technical fields and are never display names.

## Mobile overview

`GET /api/business/v1/mobile-overview`

One request is sufficient for the Business mobile home:

```json
{
  "business": { "business_id": "...", "location_id": "..." },
  "period": { "start": "2026-08-01", "end": "2026-08-11", "preset": "30d" },
  "summary": { "headline": "...", "narrative": "..." },
  "kpis": [
    { "metric": "place_views", "value": 2400, "delta": { "percent": 18, "reliable": true } },
    { "metric": "saves", "value": 312, "delta": { "percent": 21, "reliable": true } },
    { "metric": "directions", "value": 91, "delta": null }
  ],
  "business_score": { "score": 82, "status": "ready", "components": {}, "version": "v1" },
  "top_insights": [],
  "peak_demand": {},
  "data_as_of": "2026-08-11T20:00:00.000Z"
}
```

Additive fields may be introduced within v1. Existing fields do not change meaning or type without a new API version.

## Authorization

- Admin is a globally scoped consumer of the same calculations.
- External accounts require `bi_v2_enabled`, active membership, feature entitlement, and an authorized location or explicit `business_market_access` grant.
- The cache key includes tenant, location, authorized places, authorized markets, endpoint, and query.
- All authorization is enforced before analytics loading or cache lookup.

## Privacy and reliability

Origins, behavior, attribution, searches, and benchmarks are suppressed below their centralized thresholds. Scores use `null`/`insufficient_data` when evidence is insufficient and always remain within `0..100` when available.

