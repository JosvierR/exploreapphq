# Explore Admin 3.0 — QA and release evidence

Candidate verified: 2026-10-13
Baseline: `main` at `bd1012d`
Environment: local production build/preview with deterministic browser fixtures, plus read-only queries against the configured Supabase project

## Automated verification

| Check | Result |
|---|---|
| TypeScript lint | Pass — `npm run lint` |
| Unit, contract, security, and analytics calculations | Pass — 64/64 |
| Production web build | Pass — Vite transformed 7,179 modules |
| Server TypeScript build | Pass |
| OpenAPI surfaces | Pass — Admin HTTP, Edge Functions, and generated PostgREST |
| Browser secret audit | Pass — no server secret in 120 scanned artifacts |
| Shared migration history | Pass — 0 duplicate timestamps, 0 canonical hash mismatches |
| Admin browser suite | Pass — 14/14 |
| Responsive visual matrix | Pass — 8 principal pages × 5 viewports; no horizontal overflow |
| Accessibility | Pass — no critical or serious axe findings on Overview, Product Analytics, Tourism Intelligence, or Reports |
| Performance scenario | Pass — 1/1 |
| Live ingestion audit | Pass as read-only investigation; quality issues documented separately |
| Live KPI reconciliation | Pass — canonical four-metric result matches direct normalized-source calculation |

The browser suite covers authorized and unauthorized access, invalid credentials, expired/interrupted sessions, sign-out, navigation, collapse persistence, mobile drawer keyboard close, shared URL filters, 30-day and custom ranges, previous-period toggle, rapid-filter cancellation, accessible chart data, dark-mode persistence, exports, partial content, empty/loading/error/chart-hover states, and responsive overflow.

## Visual evidence

The repository preserves the 47 prior Admin 2.0 captures and adds 47 Admin 3.0 captures.

| View | Before | After |
|---|---|---|
| Desktop overview | `docs/admin-v2/screenshots/principal-executive--desktop-1440x900.png` | `docs/admin-v3/screenshots/principal-executive--desktop-1440x900.png` |
| Mobile overview | `docs/admin-v2/screenshots/principal-executive--mobile-375x812.png` | `docs/admin-v3/screenshots/principal-executive--mobile-375x812.png` |

Admin 3.0 also includes principal captures at 768×1024, 1024×768, and 1920×1080, plus access-denied, loading, empty, API-error, collapsed-sidebar, mobile-navigation, and chart-hover states.

## Measured performance

Production preview, Playwright Chromium, sanitized deterministic fixtures:

| Measurement | Result |
|---|---:|
| Authenticated usable | 1,612 ms |
| Product Analytics route usable | 301 ms |
| 30-day filter response | 154 ms |
| Cumulative layout shift | 0.000708 |
| JS heap used | 18.2 MB |
| Duplicate analytics requests | 0 |
| Unrelated map-tile requests | 0 |
| Navigation DOM content loaded | 335 ms |

Initial production assets total 1,147,511 bytes raw / 329,442 bytes gzip / 278,837 bytes Brotli. The existing API documentation and root application chunks still trigger Vite's advisory large-chunk warning; this is a documented optimization opportunity, not a build failure.

## Live data reconciliation

At `2026-10-13T22:38:59.999Z`, the bounded read-only reconciliation loaded 2,209 current-window and 989 previous-window rows from `analytics_normalized_events` and applied the production `calculateCanonicalKpis` function:

- Active users: 55 current / 38 previous.
- Sessions: 106 / 98.
- Route starts: 10 / 2.
- Commercial actions: 1 / 2.
- Data through: `2026-10-13T22:28:06.328808Z`.

No production row, migration, identity, permission, environment variable, or deployment was changed.

## Readiness and remaining limitations

The candidate is build-, contract-, security-, browser-, accessibility-, responsive-, and performance-verified. It is ready for a reviewed deployment, followed by a production smoke test.

Remaining limitations:

- The validator fix affects future events only after deployment. Historical dead letters remain untouched.
- 9,285 historical rejected rows require a separately reviewed, deduplicating, idempotent replay tool before any backfill.
- Returning-user retention is truthfully unavailable because the current aggregated contract does not expose stable cross-period identity cohorts.
- Authentication failures occur before dead-letter insertion and require API/edge logs for quantification.
- Browser workflows use sanitized deterministic fixtures; live Supabase evidence is covered separately by the two read-only audit commands.
- Initial JS and API-doc chunks remain larger than the Vite advisory threshold.
