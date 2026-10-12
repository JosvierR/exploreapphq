# Admin 2.0 QA report

Date: 2026-10-12

Branch: `feat/admin-dashboard-v2`

## Verified story

An authorized operator enters a lazy-loaded admin route, the browser supplies a Supabase session token, the consolidated API validates identity and role, canonical analytics/operations services return scoped responses, and the UI renders explicit loading, empty, error, quality, and partial-failure states.

## Flow evidence

| Boundary | Status | Evidence |
|---|---|---|
| Route composition | PASS | TypeScript/build plus source guards for all canonical admin routes and lazy route boundaries. |
| Client to API | PASS (contract) | Typed clients preserve existing URLs, bearer auth, `AbortSignal`, `request_id`, filters, and response types. |
| API authorization | PASS | Active consolidated routes use backend `requireAdmin`; functional tests cover 401/403 and reject the old deterministic token. |
| API to analytics/data | PASS (automated contract) | Business isolation, canonical metrics, pipeline, privacy, OpenAPI, and migration suites pass. No live production query was executed. |
| Response to UI | PASS (build/source) | Null-state formatter tests, explicit states, partial executive loading, URL filter tests, and production compilation pass. |
| Browser visual flow | BLOCKED | Browser-control is unavailable in this environment; no preview server was started and no screenshots are claimed. |

## Command results

| Command | Result |
|---|---|
| `npm run lint` | PASS, 24.1 s after final React/filter refactor. This script is TypeScript validation, not ESLint. |
| `npm run build` | PASS, 77.5 s total; Vite build 49.81 s. Required execution outside the restricted file sandbox. |
| `npm run build:api` | PASS, 16.8 s. |
| `npm run openapi:lint` | PASS; Admin, Edge, and generated PostgREST descriptions valid. |
| `npm run verify:browser-secrets` | PASS; 111 built artifacts scanned and no server secret exposed. |
| `npm run verify:shared-migration-history` | PASS; 76 baseline, 11 intentional forward migrations, 0 duplicate timestamps, 0 hash mismatches. |
| `npm test` | ENVIRONMENT BLOCKED before test execution: `.nvmrc` requires Node 20, machine provides Node 24.19.0, and the `tsx` loader fails in `uv_os_get_passwd` with `ENOMEM`. |

## Test fallback evidence

The loader failure was isolated from application failures:

- All 70 JavaScript/Node tests pass sequentially, including analytics, Business isolation, canonical metrics, migrations, OpenAPI parity, admin auth, and Admin 2.0 route/filter guards.
- The four TypeScript test entrypoints were bundled locally with the installed esbuild and executed successfully: analytics display, admin metric formatting, API-doc security, and route preview formatting.
- The production frontend and server TypeScript builds both pass.

The fallback is evidence, but it does not replace the release requirement to run the unchanged `npm test` command under repository-supported Node 20.

## Security and privacy checks

- Missing token returns 401.
- Legacy `hc_*` token returns 401.
- Authenticated Supabase user without an admin role returns 403.
- Source guard finds no active hardcoded bypass.
- Browser bundle contains no configured server secret.
- Business tests confirm account, entitlement, market, location, and cache partition isolation.
- Destination geography remains distinct from traveler origin.
- No schema/data mutation or production deployment was performed.

## Accessibility checks completed in code

- Visible focus treatment and reduced-motion rules.
- Labelled focusable table scroll regions.
- Modal/drawer initial focus, Escape close, focus trap, and focus restoration.
- Text accompanies semantic colors.
- Responsive layouts exist for 375, 768, 1024, 1440, and wide desktop ranges.

Keyboard traversal, contrast, touch targets, chart alternatives, overflow, and the exact breakpoint matrix still require a real browser pass before release.

## Open release gates

1. Run `npm test` using Node 20.
2. Test authenticated and unauthorized flows against an authorized non-production Supabase project.
3. Capture deterministic desktop/mobile screenshots for Dashboard, Product Analytics, Tourism Intelligence, Users, Content, Moderation, Analytics Operations, System, and Login.
4. Verify 375, 768, 1024, 1440, and 1920 px layouts, keyboard-only navigation, contrast, table overflow, and reduced motion.
5. Record browser console/network evidence and real Core Web Vitals or an approved lab proxy.
