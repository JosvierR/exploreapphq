# Admin 2.0 frontend architecture

## Composition

```text
router.tsx
  -> lazy AdminLayout
      -> ModerationAdminProvider / AdminAuthGate
      -> lazy route page
          -> domain section / shared primitives / chart wrappers
          -> typed API client
              -> consolidated /api router
                  -> server authorization
                  -> analytics/moderation/business service
```

Admin pages are lazy at the route boundary. API Docs and the tourism map retain deeper lazy boundaries because Scalar and Leaflet are independently heavy.

## Responsibilities

- `AdminLayout`: information architecture, responsive/collapsed navigation, topbar context, environment label, health status, global refresh, account/sign-out.
- `ModerationAdminProvider`: Supabase session lifecycle and `/api/admin/me` authorization state. In-flight verification IDs prevent stale responses from replacing current auth state.
- `AdminDashboardPage`: existing section router for operational deep links.
- `features/admin/dashboard/ExecutiveOverview`: executive data composition, period selection, partial API failure handling, growth/funnel/markets, and operations alerts.
- `AdminBusinessInsightsPage`: product analytics. Shared filters are reflected in the URL; every request receives an `AbortSignal`.
- `AdminTourismBusinessPage`: Business Intelligence Core v2 snapshot and drill-down. Filters/tabs are reflected in the URL and the map remains lazy.
- `AdminAnalyticsPage`: operational event explorer, health, dead letters, and explicit aggregation actions.

## Data fetching policy

- Use typed helpers in `adminAnalyticsApi.ts` and `moderationAdminApi.ts`.
- Attach the active Supabase access token; never pass server keys to the browser.
- Use `AbortController` for range/filter changes.
- Prefer partial rendering when independent executive requests fail; show a blocking error only when all executive analytics calls fail.
- Preserve backend `request_id`, range, comparison, warnings, and `data_as_of` fields.
- No React-side demand, opportunity, or business score formula is allowed.
- No new query library was added: the current abortable helper model remains simpler for this codebase.

## Navigation compatibility

Canonical routes:

- `/admin/analytics` — analytics operations.
- `/admin/analytics/data` — product analytics.
- `/admin/analytics/business` — tourism intelligence.

Operational areas continue to use `/admin?section=...`. The sidebar supplies clearer labels without changing the underlying route contract. Tabs add `?tab=growth` and `?tab=demand` aliases.

## Security boundaries

- Frontend auth gates improve UX but do not authorize data.
- Backend identity is validated with Supabase `auth.getUser()`.
- Admin role is resolved from `admin_users`, with a configured server-side email fallback after identity validation.
- Business access is separately resolved by membership, account state, entitlements, location scope, and market grants.
- Cache identity includes the authorized business/location/place/market scope.
- Legacy deterministic credentials and locally minted admin JWTs were removed.

## CSS ownership

- `admin-apple.css`: tokens, shell, shared visual normalization, executive layout, responsive behavior.
- `admin-moderation.css`: moderation, operations, analytics feature layouts.
- `admin-waitlist.css`, `admin-auth.css`, `admin-api-docs.css`: isolated feature surfaces.

Migration remains incremental. Removing the duplicated late shell theme establishes one token authority without attempting a risky wholesale selector rewrite.
