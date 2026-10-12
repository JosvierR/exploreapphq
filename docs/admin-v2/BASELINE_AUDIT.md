# Explore Admin 2.0 — Baseline audit

Audit date: 2026-10-12

Baseline commit: `3a9303b26238ca8fb037d2214f4e23c7de2ac89d` (`main`)

Implementation branch: `feat/admin-dashboard-v2`

## Executive findings

| Classification | Finding | Evidence / disposition |
|---|---|---|
| `KEEP` | Consolidated Vercel API | `api/index.js` → `server/api-lib/router.mjs`; no additional serverless entrypoints added. |
| `KEEP` | Supabase admin verification | Active analytics, moderation, system, docs, and Business routes validate the bearer token with `auth.getUser()` and authorize through `admin_users`. |
| `KEEP` | Business isolation | `businessAccess.mjs` validates account state, membership, entitlements, locations, and market grants. Cache keys include actor, account, location/place/market scope, route, and filters. |
| `KEEP` | Canonical analytics pipeline | UI reads existing admin/business APIs. No formula, historical event, or migration change is part of this redesign. |
| `REFACTOR` | Admin route loading | All primary admin pages were eagerly imported into the public bundle. They are now route-lazy; the tourism map remains component-lazy. |
| `REFACTOR` | Executive overview | The former overview was operations-first and lacked a growth story. It now composes canonical business overview/growth/funnel/locations with operations data. |
| `REFACTOR` | Large page modules | Dashboard, Product Analytics, Tourism Intelligence, Reports, and System pages still contain multiple responsibilities. `ExecutiveOverview` is the first extracted domain section; further extraction should be incremental. |
| `MERGE` | Admin visual tokens | `admin-moderation.css` and `admin-apple.css` both declared late shell themes. The duplicate 2026 override was removed from moderation CSS; `admin-apple.css` is the current token authority. |
| `REMOVE AFTER VERIFICATION` | Legacy Firebase admin React context | `AuthProvider`, `ProtectedRoute`, and `firebaseAdminSignIn` had no consumers in the router. They were removed after repository-wide reference checks. Firebase waitlist integrations remain. |
| `REMOVE AFTER VERIFICATION` | Legacy JWT package | `jsonwebtoken` and its direct type package were used only by the deprecated Express email/password admin flow. Direct dependencies were removed after the flow was deleted. |
| `REMOVE AFTER VERIFICATION` | Hardcoded admin bypass | `admin@example.com` / `Admin` and `hc_*` tokens were reachable in browser, Express, and Netlify waitlist paths. All bypass code was removed and a rejection regression test was added. |
| `BLOCKED` | Browser screenshot matrix | No browser-control capability is available in this environment. Build, type, API, OpenAPI, secret, migration, and source-level security evidence are recorded; visual screenshots remain a release gate. |

## Route map and ownership

| Route | UI owner | Purpose | Primary data |
|---|---|---|---|
| `/admin` | `AdminDashboardPage` + `ExecutiveOverview` | Executive health, growth, engagement, markets, and operations | business overview/growth/funnel/locations; ops summary; pending reports |
| `/admin?section=users` | `AdminDashboardPage` | User directory/search | `/api/admin/users`, analytics overview |
| `/admin?section=content` | `AdminDashboardPage` | Videos, places, routes | `/api/admin/ops/summary` |
| `/admin?section=moderation` | `AdminDashboardPage` | Moderation summary | ops summary, reports |
| `/admin?section=insights` | `AdminDashboardPage` | Compact operating insights | ops summary |
| `/admin?section=system` | `AdminSystemPage` | Health, configuration, metrics, observability | public health, admin system health/metrics |
| `/admin?section=admins` | `AdminDashboardPage` | Admin roster and role management | `/api/admin/admins` |
| `/admin/analytics` | `AdminAnalyticsPage` | Analytics operations, explorer, dead letters, aggregation | `/api/admin/analytics/*` |
| `/admin/analytics/data` | `AdminBusinessInsightsPage` | Product analytics, exports, investor snapshot, data quality | `/api/admin/analytics/business/*` |
| `/admin/analytics/business` | `AdminTourismBusinessPage` | Tourism Business Intelligence Core v2 | `/api/admin/business/dashboard` |
| `/admin/reports` | `ReportsAdminPage` | Moderation queue, details, actions, history | reports/detail/action APIs |
| `/admin/waitlist` | `WaitlistAdminPage` | Waitlist and broadcast operations | waitlist/notify/broadcast APIs |
| `/admin/lab` | `AdminExploreLabPage` | Explore Lab admin surface | current Lab contracts |
| `/admin/api-docs` | `ApiDocsPage` | Protected Scalar API reference | protected OpenAPI routes |

All existing route paths and `?section=` deep links are preserved. New `?tab=` links select Growth & Engagement and Markets & Demand without introducing duplicate endpoints.

## Endpoint inventory by surface

### Shell and identity

- `GET /api/health` — public readiness used by the topbar.
- `GET /api/admin/me` — authenticated Supabase identity and admin role.
- `GET /api/admin/system/health`
- `GET /api/admin/system/metrics?format=json`

### Operations and moderation

- `GET /api/admin/ops/summary`
- `GET /api/admin/users`
- `GET|POST|PATCH|DELETE /api/admin/admins`
- `GET /api/admin/reports`
- `GET /api/admin/reports/:reportId`
- `POST /api/admin/moderation/action`
- `GET /api/admin/moderation/summary`

### Analytics operations

- `GET /api/admin/analytics/overview`
- `GET /api/admin/analytics/timeseries`
- `GET /api/admin/analytics/top-content`
- `GET /api/admin/analytics/search`
- `GET /api/admin/analytics/events`
- `GET /api/admin/analytics/events/:eventId`
- `GET /api/admin/analytics/health`
- `GET /api/admin/analytics/dead-letters`
- `POST /api/admin/analytics/aggregate`

### Product analytics

- `GET /api/admin/analytics/business/overview`
- `GET /api/admin/analytics/business/growth`
- `GET /api/admin/analytics/business/funnel`
- `GET /api/admin/analytics/business/content`
- `GET /api/admin/analytics/business/search`
- `GET /api/admin/analytics/business/creators`
- `GET /api/admin/analytics/business/locations`
- `GET /api/admin/analytics/business/investor-snapshot`

### Tourism intelligence

- Initial dashboard: `GET /api/admin/business/dashboard`
- Deep endpoints remain registered under `/api/admin/business/*` and reuse `businessIntelligenceService.mjs`.
- The map stays lazy-loaded through `TourismWorldMap.tsx` and has a tabular/empty-state alternative.

### Waitlist and documentation

- `GET /api/admin/waitlist`
- `POST /api/admin/waitlist/notify-launch`
- `POST /api/admin/broadcast`
- `GET /api/admin/openapi/postgrest|edge|admin`

## Reusable components retained

- Shell: `AdminLayout`, `AdminAuthGate`, `ModerationAdminProvider`, `AdminErrorBoundary`.
- Primitives: `AdminPageShell`, `SectionHeader`, `StatCard`, `AdminDataTable`, `StatusBadge`, `EmptyState`, `LoadingState`, `ErrorState`, `ConfirmModal`, `Drawer`, `Timeline`, `CopyButton`.
- Charts: `ChartCard`, `KpiTrendCard`, `AreaTrendChart`, `LineTrendChart`, `HorizontalBarChart`, `FunnelChart`, `DonutBreakdownChart`, `Sparkline`, `chartTheme`.
- Data/display: `adminAnalyticsApi.ts`, `moderationAdminApi.ts`, `analyticsDisplay.ts`, `csvExport.ts`.

## Direct and indirect dependencies

- React 19 + React Router own composition and navigation.
- Supabase browser auth supplies the user access token; backend verification and authorization remain mandatory.
- Recharts is the sole dashboard chart library.
- Leaflet/react-leaflet is isolated behind the lazy tourism map.
- Scalar is isolated behind the lazy API docs route.
- Firebase remains for specific waitlist/server compatibility paths, not as the primary admin login.
- Vercel owns the consolidated production serverless entrypoint.

No new runtime dependency was introduced.

## Verified duplication and obsolete code

- Duplicate late shell theme in `admin-moderation.css`: removed; tokens consolidated in `admin-apple.css`.
- Hardcoded browser/server admin token: removed from every active path.
- Unused legacy Firebase admin React context and protected route: removed after `rg` reference audit.
- Direct `jsonwebtoken` dependency: removed after deleting the last direct imports.
- Historical folders `legacy/`, `assets/`, and `netlify/` were not broadly deleted. Netlify handlers are still called by the consolidated router and are therefore active.

## Security risks

### Confirmed and remediated

- A deterministic credential and bearer token granted admin access to legacy waitlist paths. Removed in browser, Express, and Netlify code.
- Express `/api/access` minted a seven-day admin JWT from default credentials. Admin behavior was removed; the route now remains a waitlist flow.
- Express `/api/me` now uses the real admin middleware instead of locally verifying legacy JWTs.

### Preserved controls

- Server-side `auth.getUser()` validates Supabase identity.
- `admin_users` is the primary role authority; configured email fallback follows a validated identity.
- Business membership and entitlements are enforced server-side.
- Service/secret keys remain server-only and the browser bundle audit checks them.
- Search text, precise coordinates, raw tokens, and unrestricted event payloads remain excluded.

## Regression risks and mitigations

- Lazy named exports: covered by TypeScript and production build.
- URL filter synchronization: existing query keys are preserved and requests still use `AbortSignal`.
- Null metric rendering: shared formatters now render an em dash instead of fabricating zero; explicit numeric zero remains `0`.
- CSS precedence: only the duplicate late theme was removed; feature-specific moderation, reports, waitlist, auth, and docs selectors remain.
- Auth removal: a source test and functional legacy-token rejection test protect against reintroduction.

## Baseline quality and bundle

| Check | Baseline result |
|---|---|
| `npm run lint` | PASS, 47.6 s (TypeScript build with `--noEmit`) |
| `npm test` | Environment-blocked before first test: repository requests Node 20, machine has Node 24.19.0; `tsx` failed in `uv_os_get_passwd` with `ENOMEM`. |
| `npm run build` | PASS outside restricted sandbox, 112.8 s |
| `npm run build:api` | PASS, 15.7 s |
| `npm run openapi:lint` | PASS, 17.4 s |
| `npm run verify:browser-secrets` | PASS; 93 artifacts scanned, no secret match |
| `npm run verify:shared-migration-history` | PASS; baseline 76, 11 forward migrations, 0 duplicate timestamps, 0 hash mismatches |

Baseline production bundle:

- Main JS: 2,156.98 kB / 593.41 kB gzip.
- API docs JS: 2,946.82 kB / 903.21 kB gzip.
- Main CSS: 292.97 kB / 55.53 kB gzip.
- API docs CSS: 253.76 kB / 39.89 kB gzip.

The main bundle warning directly supported route-level admin code splitting. Final measurements are in `CLEANUP_REPORT.md`.

## Preserve checklist

- [x] Existing admin routes and query deep links remain addressable.
- [x] Supabase session states and backend role checks remain.
- [x] Operations, users, content, moderation, reports, waitlist, Lab, system, and API docs remain.
- [x] Event explorer, dead letters, aggregation action, request IDs, and diagnostics remain.
- [x] Product analytics filters, CSV exports, snapshot copy, and quality states remain.
- [x] Tourism dashboard, lazy map, drill-down drawers, score definitions, sample size, confidence, and evidence remain.
- [x] Business account/location/market/entitlement isolation remains server-side.
- [x] Consolidated Vercel function and OpenAPI parity remain.
- [x] No migration or production data mutation was performed.
