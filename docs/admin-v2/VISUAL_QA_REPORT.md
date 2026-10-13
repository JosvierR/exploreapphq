# Admin 2.0 visual QA report

Date: 2026-10-12

Browser: Playwright Chromium `156.0.8078.4` (build v1248), light color scheme, `en-US`, `America/New_York`, deterministic time and sanitized fixtures.

## Outcome

**PASS for local deterministic visual QA.** The 40-case principal matrix and 7 important states match reviewed baselines. No principal viewport has document-level horizontal overflow, major overlap, clipped primary controls, detached tooltips, or unusable mobile navigation.

This result does not replace preview QA with real authorization/data. The committed images contain no production users or secrets.

## Principal screenshot matrix

All files are under `docs/admin-v2/screenshots/`. Each cell exists as `principal-<view>--<viewport>.png`.

| View / route | mobile-375x812 | tablet-768x1024 | laptop-1024x768 | desktop-1440x900 | large-1920x1080 |
|---|---:|---:|---:|---:|---:|
| `executive` — `/admin` | PASS | PASS | PASS | PASS | PASS |
| `analytics-ops` — `/admin/analytics` | PASS | PASS | PASS | PASS | PASS |
| `product-analytics` — `/admin/analytics/data` | PASS | PASS | PASS | PASS | PASS |
| `tourism-intelligence` — `/admin/analytics/business` | PASS | PASS | PASS | PASS | PASS |
| `users` — `/admin?section=users` | PASS | PASS | PASS | PASS | PASS |
| `content` — `/admin?section=content` | PASS | PASS | PASS | PASS | PASS |
| `reports` — `/admin/reports` | PASS | PASS | PASS | PASS | PASS |
| `system` — `/admin?section=system` | PASS | PASS | PASS | PASS | PASS |

Examples:

- `docs/admin-v2/screenshots/principal-executive--mobile-375x812.png`
- `docs/admin-v2/screenshots/principal-product-analytics--desktop-1440x900.png`
- `docs/admin-v2/screenshots/principal-tourism-intelligence--large-1920x1080.png`
- `docs/admin-v2/screenshots/principal-reports--tablet-768x1024.png`

The complete 40-file naming inventory is enforced by `tests/e2e/admin-dashboard.spec.ts` and was rerun without snapshot-update mode.

## Important states

| State | File | Result |
|---|---|---|
| Access denied | `screenshots/states-access-denied--desktop-1440x900.png` | PASS |
| API error | `screenshots/states-api-error-product-analytics--desktop-1440x900.png` | PASS |
| Chart tooltip / selected data | `screenshots/states-chart-hover--desktop-1440x900.png` | PASS |
| Empty data | `screenshots/states-empty-tourism-intelligence--desktop-1440x900.png` | PASS |
| Loading | `screenshots/states-loading-product-analytics--desktop-1440x900.png` | PASS |
| Open mobile drawer | `screenshots/states-mobile-navigation-open--mobile-375x812.png` | PASS |
| Collapsed sidebar | `screenshots/states-sidebar-collapsed--desktop-1440x900.png` | PASS |

## Focused destinations and interactions

Waitlist, Admin Management, API Documentation, Explore Lab, Moderation, and all secondary sidebar destinations were navigated in the browser suite. Login, invalid credentials, logout, interrupted verification, expired session, access denial, mobile drawer, collapse persistence, filters, history, exports, geography drilldown, partial content, loading, empty, and API-error behavior were exercised.

## Findings and corrections

| Finding | Before | Correction / after |
|---|---|---|
| Product/Tourism query changes could lose a prior selection | Callback derived changes from a stale router snapshot and replaced history | Derive from `window.location.search`, push history, and cover back/forward/shared URLs. |
| Product page could fall into the global error boundary | Partial/aborted content payload tried to read `sections.videos` | Defensive nested access plus a repeated partial-payload browser regression. |
| Mobile drawer keyboard dismissal | Escape did not close it | Escape listener closes the drawer; browser test passes. |
| Decorative sparklines | Recharts could expose focusable semantics under `aria-hidden` | Decorative charts use `accessibilityLayer={false}`. |
| Muted/positive text contrast | Some token combinations were below the intended text threshold | Muted and positive colors were darkened; axe core-page scan has no serious/critical results. |

## Manual review notes

Contact sheets were generated locally from all 47 PNGs and visually reviewed; those temporary composites are not release artifacts. Review covered shell density, title hierarchy, cards, filter controls, tables, chart bounds, selected states, topbar, sidebar, mobile drawer, empty/error copy, and whitespace at every required width.

No redesign was introduced during QA. Corrections are narrowly scoped to confirmed behavior, accessibility, and resilient rendering.

## Accessibility

- Axe WCAG A/AA tags: no serious or critical violations on `/admin`, Product Analytics, Tourism Intelligence, and Reports.
- Visible focus styling and reduced-motion rules remain in the admin stylesheet.
- Drawer Escape behavior is automated; existing shared modal/drawer focus trap and restoration were source-reviewed.
- Decorative sparkline semantics no longer create hidden focus targets.
- Color is accompanied by text/status labels.

Limit: automated checks and local keyboard interactions do not replace a screen-reader pass in the target preview environment.
