# DATA-007: Analytics dashboard UX, readable metrics, exports, and reporting

## Purpose

Make `/admin/analytics/business` easy to read, useful with incomplete data, exportable, and presentation-ready.

Operations remain at `/admin/analytics`.

## Dashboard sections

1. Executive Summary
2. Growth & Usage
3. Engagement Funnel
4. Content Performance
5. Search Intelligence
6. Creator Insights
7. Market Insights
8. Investor Snapshot
9. Data Quality

## Filters

- Range: `24h`, `7d`, `30d`, `90d`
- Platform: `all`, `ios`, `android`, `web`
- Source: `all`, `mobile`, `web`, `backend`, `admin`
- Content type: `all`, `video`, `place`, `route`, `profile`
- Comparison: previous period deltas on executive summary cards

## Exports

CSV exports (client-side):

- Executive overview
- Growth series
- Funnel
- Content performance
- Search fingerprints
- Market insights
- Investor snapshot

Copy:

- Investor snapshot text

## Privacy

- No raw search queries (search fingerprints only)
- No precise lat/lng
- No service/cron secrets
- No raw properties/context

## Known limitations while DATA-003 is pending

- Mobile events may be missing
- Creator metadata may be missing
- Location metadata may be sparse
- Content rankings need `entity_type` + `entity_id`

Empty states explain what to do next instead of showing only "No data".

## QA checklist

1. Open `/admin/analytics/business`
2. Confirm section titles and subtitles
3. Change range/platform/source/content filters
4. Confirm executive cards show trends when previous data exists
5. Export at least one CSV
6. Copy investor snapshot
7. Confirm search table has fingerprints only
8. Confirm locations never show lat/lng
9. Confirm `/admin/analytics` still works
10. Confirm no new files under `/api`

## Related

- `docs/DATA-006_BUSINESS_ANALYTICS_INSIGHTS.md`
