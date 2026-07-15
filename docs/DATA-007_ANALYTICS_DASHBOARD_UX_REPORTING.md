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

## Display Labels

Analytics admin display names are centralized in `src/lib/analyticsDisplay.ts`.
The catalog contains labels for metrics, event names, entity/content types,
platforms, sources, event properties, warning codes, rejected-event reasons,
filters, and auth states.

Rules:

- Keep API, Supabase, and mobile identifiers unchanged.
- Use explicit maps for known analytics keys from the event allowlist and
  business insights service.
- Use `humanizeKey()` only as a fallback; it title-cases snake_case and
  preserves acronyms such as `iOS`, `ID`, `CTR`, `API`, and `URL`.
- Event detail views should render readable field/value tables through
  `formatAnalyticsJson()` instead of raw JSON.
- CSV exports should use human-readable headers through the same catalog.

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
10. Open an event detail in `/admin/analytics` and confirm properties/context render as readable tables
11. Confirm primary dashboards do not show raw `screen_view`, `screen_time`, `active_users_estimate`, `ios`, or `no_result_rate`
12. Confirm exported CSV headers are human-readable
13. Confirm no new files under `/api`

## Related

- `docs/DATA-006_BUSINESS_ANALYTICS_INSIGHTS.md`
- `docs/DATA-008_ADMIN_EXECUTIVE_VISUALS.md`
