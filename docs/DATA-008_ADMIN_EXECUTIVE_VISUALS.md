# DATA-008: Admin executive analytics visuals

## Purpose

Turn `/admin/analytics/business` into a decision-first command center that a founder, CEO, or investor can read without analytics terminology or operational context.

The redesign is presentation-only. API routes, event names, filters, Supabase schemas, privacy rules, and CSV data contracts remain unchanged.

## Information architecture

1. Command strip: readable period, last update, compact filters, refresh, overview export, and snapshot copy
2. Company pulse: six KPIs with previous-period direction and daily sparklines where available
3. Growth story: sessions and app opens over time, plus activity by platform
4. Engagement funnel: visual journey steps, sessions, drop-off, and the largest gap called out in plain language
5. Content performance: tabs for videos, places, routes, and profiles with top-three emphasis
6. Demand and reach: privacy-safe search quality, country-level markets, and creator momentum when attribution exists
7. Investor snapshot: a boardroom-style metric card with copy and CSV export
8. Data quality: Healthy, Needs data, and Warning states with cause and next-action copy

The admin overview at `/admin?section=overview` now leads with a product health statement, Users / Content / Pending reports, a primary Business Insights CTA, and a reduced moderation preview.

## Chart foundation

Reusable Recharts wrappers live in `src/features/admin/components/charts/`:

- `ChartCard`
- `KpiTrendCard`
- `LineTrendChart`
- `AreaTrendChart`
- `HorizontalBarChart`
- `FunnelChart`
- `DonutBreakdownChart`
- `Sparkline`
- `chartTheme`

Pages use the wrappers instead of importing Recharts directly. Tooltips use formatted values and human labels. Charts share a quiet Explore-blue palette, semantic positive/negative colors, subtle grids, and animation-free rendering.

## Display and privacy rules

- UI metric, event, platform, source, entity, filter, and warning names come from `src/lib/analyticsDisplay.ts`.
- API and filter values remain technical and unchanged.
- Search shows fingerprints only; raw query text is never rendered.
- Markets remain aggregated by country. Exact latitude and longitude are never rendered.
- Empty states explain the missing instrumentation and the next action.

## Responsive behavior

- Six KPIs collapse to three columns, then one column on narrow displays.
- Growth, demand, and funnel layouts collapse without horizontal page overflow.
- Tables retain their existing scroll container for dense data.
- The command strip is sticky on desktop and returns to normal flow on smaller screens.

## QA

1. Open `/admin/analytics/business` and scan the company pulse, growth story, funnel, content leader, search quality, top market, and data quality.
2. Change range from `7d` to `30d`; verify every section reloads.
3. Change platform, source, and content filters; verify readable option labels and unchanged technical values.
4. Hover the usage, platform, funnel, and market charts; verify formatted tooltips.
5. Confirm the funnel calls out the largest drop-off.
6. Switch through all content tabs and confirm ranked rows and top-three treatment.
7. Copy and export the investor snapshot; export overview, growth, funnel, content, search, and markets.
8. Use an empty filter combination and confirm the missing-data cause and next action are clear.
9. Open `/admin?section=overview`; confirm health status, three key KPIs, Business Insights CTA, and moderation preview.
10. Run `npm run lint`, `npm test`, and `npm run build`.

## Related

- `docs/DATA-006_BUSINESS_ANALYTICS_INSIGHTS.md`
- `docs/DATA-007_ANALYTICS_DASHBOARD_UX_REPORTING.md`
