# Admin 2.0 cleanup report

Date: 2026-10-12

Baseline: `3a9303b26238ca8fb037d2214f4e23c7de2ac89d`

## Outcome

The redesign keeps the existing React/Vite/Supabase architecture and consolidated API. It removes one confirmed authentication bypass, one unused frontend auth stack, one direct JWT dependency, and a duplicated late CSS theme. No production data, migrations, analytics formulas, or API paths were changed.

## Bundle before and after

Production builds were measured with the same `npm run build` command.

| Artifact | Baseline raw / gzip | Final raw / gzip | Change |
|---|---:|---:|---:|
| Main JavaScript | 2,156.98 / 593.41 kB | 992.42 / 294.75 kB | -54.0% raw / -50.3% gzip |
| Main CSS | 292.97 / 55.53 kB | 150.57 / 33.00 kB | -48.6% raw / -40.6% gzip |
| API Docs JavaScript | 2,946.82 / 903.21 kB | 2,947.28 / 903.22 kB | Effectively unchanged; still isolated |
| API Docs CSS | 253.76 / 39.89 kB | 253.76 / 39.89 kB | Unchanged; still isolated |

Admin code now loads on demand. Representative final chunks:

- Admin shell: 13.10 kB / 4.10 kB gzip.
- Executive/operations dashboard: 56.87 kB / 15.58 kB gzip.
- Product Analytics: 33.62 kB / 9.76 kB gzip.
- Tourism Intelligence: 50.41 kB / 11.80 kB gzip.
- Analytics Operations: 21.78 kB / 5.34 kB gzip.
- Tourism map: 4.48 kB / 2.20 kB gzip, lazy-loaded independently.

The remaining size warnings are the public application vendor entry and the intentionally isolated Scalar API reference. They are follow-up optimization candidates, not regressions introduced by Admin 2.0.

## Files removed

| File | Evidence |
|---|---|
| `src/lib/hardcodedAdmin.ts` | Only supplied deterministic browser credentials/token; all imports were removed and a regression test rejects the old token. |
| `src/features/auth/AuthProvider.tsx` | No active router/provider consumer after repository-wide reference search. |
| `src/features/auth/ProtectedRoute.tsx` | No active route consumer; Admin uses `AdminAuthGate`. |
| `src/features/auth/firebaseAuth.ts` | Used only by the removed legacy provider. Firebase waitlist/server integrations remain. |
| `src/lib/admin.ts` | Unreferenced legacy helper after auth consolidation. |

## Dependency changes

- Removed direct `jsonwebtoken` and `@types/jsonwebtoken` dependencies.
- Kept Firebase because active waitlist/server compatibility code still uses it.
- Kept Recharts and Leaflet; the redesign reuses their existing wrappers and lazy map.
- Added no runtime dependency.

Transitive JWT packages required by retained dependencies are not treated as unused direct packages.

## CSS consolidation

- `admin-apple.css` is the Explore Command Center token/shell authority.
- Removed the duplicated late 2026 shell override from `admin-moderation.css`.
- Preserved feature selectors for moderation, reports, waitlist, auth, API docs, and less-obvious operational states.
- Added responsive executive layouts, local table overflow, focus rings, reduced-motion behavior, and semantic status styling.

A wholesale CSS purge was intentionally avoided without browser visual regression coverage.

## Functional refactors

- Extracted `ExecutiveOverview` from the large dashboard page.
- Made the admin shell and all admin route pages lazy.
- Made Product and Tourism filters URL-owned, shareable, and compatible with browser navigation without remounting the page.
- Retained abortable requests so stale filter responses cannot overwrite current data.
- Standardized missing numeric values as `—`; an explicit backend zero remains zero.
- Added focus trapping/restoration to shared dialogs and drawers and keyboard-focusable table regions.

## Security cleanup

- Removed deterministic `admin@example.com` / `Admin` and `hc_*` authentication paths.
- Removed Express password-to-seven-day-JWT issuance.
- Express `/api/me` now uses the same real admin middleware.
- Active backend authorization continues to validate Supabase identity with `auth.getUser()` and authorize through `admin_users` or a configured allowlist after identity validation.
- Functional regression tests cover missing token (401), the old token (401), and a valid non-admin Supabase identity (403).
