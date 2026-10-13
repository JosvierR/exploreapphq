# Explore Admin 3.0 — repository audit and implementation plan

Audit date: 2026-10-13
Baseline: `main` at `bd1012d`

## Repository audit

| Area | Verified implementation |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, React Router 7; admin routes are lazy-loaded. |
| UI foundation | Canonical admin tokens and shared shell styles live in `src/styles/admin-apple.css`; feature styles remain isolated. |
| Charts | Recharts is the sole analytics chart library. Leaflet is lazy and limited to tourism geography. |
| Fetching | Typed fetch helpers attach the active Supabase access token. Filter effects use `AbortController`; no extra global state/query dependency is required. |
| Navigation | `AdminLayout` owns the responsive sidebar, route metadata, collapse persistence, system health, account controls, and global refresh. |
| Analytics | Canonical executive/tourism data comes from `/api/admin/business/dashboard`, backed by normalized eligible events and Business Analytics Core definitions. Operational telemetry comes from `/api/admin/analytics/health`. |
| Supabase sources | `analytics_events`, `analytics_event_dead_letters`, `analytics_normalized_events`, daily fact tables, `business_intelligence_quality_report()`, and destination-quality functions. |
| Authentication | Browser uses Supabase Auth. Every admin API validates the bearer identity server-side and authorizes through `admin_users` or reviewed server-only configuration. |
| Business authorization | Membership, account state, entitlement, location, and market scope are enforced server-side; cache keys include actor and authorized scope. |
| Tests | Node contract/unit tests, TypeScript build, API build, OpenAPI checks, secret scan, migration-history verification, Playwright workflows, visual snapshots, axe, and a performance scenario. |
| Deployment | Consolidated Vercel function with Netlify compatibility. No deployment or production mutation is part of Admin 3.0. |

## Baseline gaps confirmed

1. The prior overview used six KPIs and a large decorative hero instead of the requested four-metric executive hierarchy.
2. System health occupied three permanent header pills; account and sign-out controls also consumed excessive header width.
3. Executive filters were component-local and were not persisted in the URL; custom dates and comparison control were absent.
4. Executive metrics came from a legacy 5,000-row sampled contract, so sufficiently active periods could be partial even though they looked exact.
5. The primary chart had no metric selector or accessible table equivalent.
6. Retention language was not clearly separated from estimates based only on activity inside the selected window.
7. Dark-mode tokens were absent from the admin token authority.
8. Live ingestion rejection reconciliation had not been completed.

## Controlled implementation sequence

1. Trace the repository, metric contracts, security boundary, and live read-only ingestion quality.
2. Correct forward ingestion contract mismatches without schema changes or historical replay.
3. Consolidate executive metrics on the canonical normalized analytics response.
4. Implement URL-owned period/comparison controls, four KPI cards, product activity, secondary insight panels, and compact operational exceptions.
5. Compact the topbar into system/profile popovers and add persisted light/dark tokens.
6. Add accessibility tables, responsive behavior, targeted tests, screenshots, and release evidence.

No production data was modified, deleted, or reprocessed.
