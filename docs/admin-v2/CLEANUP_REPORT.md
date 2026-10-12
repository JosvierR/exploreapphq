# Admin 2.0 cleanup report

Date: 2026-10-12

Baseline: `3a9303b26238ca8fb037d2214f4e23c7de2ac89d`

## Outcome

The redesign keeps the existing React/Vite/Supabase architecture and consolidated API. It removes one confirmed authentication bypass, one unused frontend auth stack, one direct JWT dependency, and a duplicated late CSS theme. No production data, migrations, analytics formulas, or API paths were changed.

## Bundle before and after

Production builds were measured with the same `npm run build` command.

| Artifact | Baseline raw / gzip | Final raw / gzip | Change |
|---|---:|---:|---:|
| Main JavaScript | 2,156.52 / 593.22 kB | 994.72 / 295.56 kB | -53.9% raw / -50.2% gzip |
| Main CSS | 370.60 / 68.72 kB | 150.57 / 33.00 kB | -59.4% raw / -52.0% gzip |
| Initial HTML + entry assets | 2,529.34 / 662.82 kB | 1,147.51 / 329.44 kB | -54.6% raw / -50.3% gzip |
| API Docs JavaScript | 2,943.95 / 902.27 kB | 3,356.22 / 1,027.15 kB | +14.0% raw / +13.8% gzip; still isolated |

Admin code now loads on demand. Representative final chunks:

- Admin shell: 13.26 kB / 4.16 kB gzip.
- Executive/operations dashboard: 56.87 kB / 15.58 kB gzip.
- Product Analytics: 33.80 kB / 9.82 kB gzip.
- Tourism Intelligence: 50.40 kB / 11.79 kB gzip.
- Analytics Operations: 21.78 kB / 5.34 kB gzip.
- Tourism map: 4.48 kB / 2.20 kB gzip, lazy-loaded independently.

The initial payload is substantially smaller. The intentionally isolated Scalar API reference is now 3.36 MB raw and is a documented regression/follow-up candidate rather than part of the initial route.

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
- Updated Firebase/Firebase Admin, nodemailer, Redocly, and targeted transitive dependencies to remove known advisories; Firebase Admin server code now uses the modular v14 API.
- Added Playwright and axe only as development dependencies for reproducible browser and accessibility QA; no browser runtime dependency was added.

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
