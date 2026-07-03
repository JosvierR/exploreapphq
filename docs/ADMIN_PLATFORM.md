# Explore Admin Platform

## Overview

The web/admin console is a production operations surface for Explore moderation, content, users, system health, and observability.

Current frontend entry points:

- `src/components/layout/AdminLayout.tsx` owns the admin shell, sidebar, topbar, refresh action, and system status pills.
- `src/pages/admin/AdminDashboardPage.tsx` owns overview, users, content, moderation, insights, and analytics-foundation sections.
- `src/pages/admin/ReportsAdminPage.tsx` owns the moderation report queue and video moderation workspace.
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

## Backend Routing

Vercel keeps one consolidated function:

- `api/index.js`
- `server/api-lib/http/vercelAdapter.mjs`
- `server/api-lib/router.mjs`
- `server/api-lib/moderation/moderationRouter.mjs`
- `server/api-lib/moderation/supabaseModeration.mjs`
- `server/api-lib/system/systemRouter.mjs`

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

The console must not fake product analytics. Product analytics such as DAU, WAU, retention, CTR, impressions, clicks, and route starts require an analytics event foundation. Until that exists, UI must say `Analytics foundation required` or `Not available`.

Infrastructure metrics are available through request logs, request ids, health endpoints, and in-memory instance metrics.
