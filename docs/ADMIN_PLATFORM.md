# Explore Admin Platform

## Overview

The web/admin console is a production operations surface for Explore moderation, content, users, system health, and observability.

Current frontend entry points:

- `src/components/layout/AdminLayout.tsx` owns the admin shell, sidebar, topbar, refresh action, and system status pills.
- `src/pages/admin/AdminDashboardPage.tsx` owns overview, users, content, moderation, insights, and analytics-foundation sections.
- `src/pages/admin/ReportsAdminPage.tsx` owns the moderation report queue and video moderation workspace.
- `src/pages/admin/ApiDocsPage.tsx` owns the lazy-loaded Scalar OpenAPI browser (`/admin/api-docs`).
- `src/features/admin/components/` contains reusable admin UI primitives and the admin error boundary.
- `src/features/admin/observability/` contains System/Observability API and formatting helpers.
- `src/features/admin/pages/AdminSystemPage.tsx` owns the System/Observability page.

## Admin Routes

- `/admin` - admin overview and section-driven operations console.
- `/admin?section=users` - user operations.
- `/admin?section=content` - content inventory.
- `/admin?section=moderation` - moderation overview.
- `/admin?section=insights` - operational insights.
- `/admin?section=analytics` - analytics foundation status.
- `/admin?section=system` - System/Observability.
- `/admin/reports` - moderation reports and video moderation lifecycle.
- `/admin/waitlist` - waitlist operations.
- `/admin/api-docs` - Scalar UI over admin OpenAPI (live PostgREST, Admin HTTP contract, Edge skeleton).

## Admin OpenAPI (docs)

Admin-authenticated read-only specs:

| Method | Path | Surface |
|--------|------|---------|
| `GET` | `/api/admin/openapi/postgrest` | Live PostgREST (Swagger 2/OpenAPI → 3.1, short cache) |
| `GET` | `/api/admin/openapi/edge` | Synced Explore-V2 Edge OpenAPI (`openapi.edge.yaml`, commit-pinned) |
| `GET` | `/api/admin/openapi/admin` | Hand-authored Admin HTTP API (`openapi.admin.yaml`) |

Handlers live in `server/api-lib/docs/` and are wired through `server/api-lib/router.mjs` (mirrored in `server/index.ts`). Each route uses `requireAdmin`.

PostgREST live docs fetch `${SUPABASE_URL}/rest/v1/` with the same `SUPABASE_SECRET_KEY` used by admin analytics/moderation. Supabase rejects publishable/anon keys for that OpenAPI root (`Secret API key required`).

Admin HTTP contract (`server/api-lib/docs/openapi.admin.yaml`) is linted with Redocly (`npm run openapi:lint`) and guarded by an anti-drift test that requires 100% coverage of `router.mjs` plus parity with Express mounts (except explicit local-only paths).

Edge OpenAPI is authored in Explore-V2 and synced with `npm run openapi:sync-edge -- --commit <sha>` (never a floating branch). The pin is stored in `edgeOpenApi.pin.json` and surfaced in `/admin/api-docs`.

**Reviewed:** 2026-08-10

## Backend Routing

Vercel keeps one consolidated function:

- `api/index.js`
- `server/api-lib/http/vercelAdapter.mjs`
- `server/api-lib/router.mjs`
- `server/api-lib/moderation/moderationRouter.mjs`
- `server/api-lib/moderation/supabaseModeration.mjs`
- `server/api-lib/system/systemRouter.mjs`
- `server/api-lib/docs/docsRouter.mjs`

`vercel.json` rewrites `/api/(.*)` to `/api/index.js`, preserving the single serverless function pattern.

## Admin Auth

The moderation admin console uses Supabase browser auth on the frontend and server-side Supabase verification on API routes. Admin authorization is checked through `admin_users` with an optional email fallback from `EXPLORE_ADMIN_ALLOWED_EMAILS`.

The UI handles:

- Loading admin session.
- Not logged in.
- Logged in but not authorized.
- Authorized admin.
- API unavailable.
- Supabase unavailable.

## Analytics Boundaries

Product analytics (DAU, WAU, impressions, content CTR, route starts) are computed from
`public.analytics_events` via `GET /api/admin/analytics/overview` → `product_metrics`.

Preferred source: Supabase RPC `admin_product_analytics_snapshot()`
(`supabase/migrations/20260810120000_admin_product_analytics_snapshot.sql`).
If the RPC is missing, the API falls back to exact event-name counts plus sampled actor uniqueness.

The console must not invent these metrics from operational tables (profiles, videos, reports).
Until the foundation is selectable and receiving events, UI shows an explicit foundation status
(`schema_missing`, `not_selectable`, `empty`) instead of fabricated numbers.

Retention cohorts and recommendation preference models still require longer history / affinity
scoring and remain separately gated.

Infrastructure metrics remain available through request logs, request ids, health endpoints, and
in-memory instance metrics.

**Reviewed:** 2026-08-10
