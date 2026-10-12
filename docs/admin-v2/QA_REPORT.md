# Admin 2.0 QA report

Date: 2026-10-12

Branch: `feat/admin-dashboard-v2`

Release recommendation: **BLOCKED** until an isolated preview with approved Admin and Business A/B identities is available. Local implementation and fixture-backed browser gates pass.

## Tested environment

| Item | Value |
|---|---|
| Host | Windows, local repository checkout |
| Primary runtime | Node `v24.19.0`, npm `11.17.0` |
| Compatibility runtime | Node `v22.23.3`, npm `11.17.0` |
| Repository runtime | `.nvmrc` = `22`; `engines.node` = `>=22 <25` |
| Test loader | `tsx@4.22.2` |
| Browser | Playwright Chromium `156.0.8078.4` (build v1248) |
| Browser data | Sanitized deterministic fixtures; no production user data |
| Baseline | `origin/main` at `3a9303b26238ca8fb037d2214f4e23c7de2ac89d` |

## Runtime root cause and resolution

The reported Node 24/`tsx` failure was reproduced only inside the managed Windows filesystem sandbox. The process failed in `os.userInfo()` with `uv_os_get_passwd returned ENOMEM` before application tests ran. The same unmodified `npm test` command passes outside that sandbox on Node 24, so this was not a Node loader, TypeScript, ESM/CJS, or application defect.

Runtime configuration was nevertheless inconsistent: `.nvmrc` requested obsolete Node 20 while existing CI used Node 22. The release candidate now selects Node 22 LTS, declares compatibility through Node 24, updates `tsx` to `4.22.2`, and adds a Node 22/24 CI matrix.

## Final command evidence

| Command | Result |
|---|---|
| `npm ci` | **PASS**; 870 packages installed from the lockfile. |
| `npm test` on Node 24.19.0 | **PASS**, exit 0, 64 formal subtests / 0 failed / 0 skipped, plus 10 direct entrypoints; formal runner 2.409 s, command wall time 8.1 s. |
| `npm test` on Node 22.23.3 | **PASS**, exit 0, 64 formal subtests / 0 failed / 0 skipped, plus 10 direct entrypoints; formal runner 2.818 s, command wall time 12.1 s. |
| `npm run lint` | **PASS**, TypeScript project build with `--noEmit`, 23.2 s. |
| `npm run build` | **PASS**, exit 0; Vite production build 43.38 s, command wall time 67 s. |
| `npm run build:api` | **PASS**, server TypeScript build. |
| `npm run openapi:lint` | **PASS**, Admin, Edge, and generated PostgREST surfaces valid. |
| `npm run verify:browser-secrets` | **PASS**, 120 built artifacts scanned; no configured server-secret match. |
| `npm run verify:shared-migration-history` | **PASS**, baseline 76, 11 intentional forward migrations, 0 duplicate timestamps, 0 hash mismatches. |
| `npm audit --audit-level=low` | **PASS**, 0 vulnerabilities. |
| `npm run test:e2e` | **PASS**, 13/13 in 3.3 min using one worker. |
| Product race/partial regression repeated 5 times | **PASS**, 10/10 in 1.3 min using two workers. |
| `npm run test:e2e:perf` | **PASS**, 1/1 in 6.7 s. |

The local build and browser commands required execution outside the managed sandbox because its filesystem policy prevents esbuild from resolving `vite.config.ts` and prevents `os.userInfo()`. The project commands themselves were not changed.

## Functional coverage

Fixture-backed Playwright coverage verifies:

- valid and invalid login behavior, logout, 403 access denial, expired 401 session, interrupted verification/retry, and shared authenticated state across tabs;
- sidebar navigation, collapse persistence, mobile drawer, Escape dismissal, all secondary destinations, and route titles;
- Product filters, URL persistence, back/forward, shared filtered URL, CSV export, rapid-response races, and degraded partial content payloads;
- Tourism filters, tab changes, geography drilldown, URL state, and CSV export;
- loading, empty, API-error, collapsed-sidebar, mobile-navigation, tooltip, and access-denied states;
- 8 principal views at 5 viewports, document overflow assertions, and visual baselines;
- no serious or critical axe violations on the Executive, Product, Tourism, and Reports core pages.

The Node suites additionally cover missing-token 401, non-admin 403, legacy-token rejection, canonical metric formulas, privacy rules, Business entitlements, A/B query scoping, geography tampering, and cache partitioning.

## Defects confirmed and fixed

1. The Windows sandbox failure was incorrectly attributed to Node/`tsx`; runtime configuration and CI were aligned after isolating the environmental cause.
2. Server authorization fallbacks could read the public `VITE_ADMIN_EMAILS` variable. Active server and Netlify paths now use server-only allowlist names.
3. Firebase Admin v13 and older transitive packages left audit findings. Firebase Admin was migrated to its modular v14 API and dependency advisories were resolved.
4. Product and Tourism filter callbacks could derive a new query from a stale React Router snapshot and used replacement navigation. They now derive from the current browser URL and retain history.
5. Product Analytics could crash while rendering a partial/aborted content response (`sections.videos`). Nested payload access is now defensive and has a browser regression test.
6. The mobile admin drawer did not close with Escape. Keyboard dismissal was added.
7. Decorative sparklines exposed focusable chart semantics inside `aria-hidden`. Recharts accessibility was disabled for those decorative instances.
8. Muted and positive admin tokens did not reliably meet text contrast targets. Tokens were adjusted and automated accessibility checks pass.

## Outstanding limitations

- No isolated preview URL or approved non-production Supabase identities were supplied.
- Valid Admin login, token renewal, and endpoint behavior are proven with deterministic browser fixtures and server unit/contract tests, not a live Supabase project.
- Business A/B isolation is proven in service-level automated tests, not by two real browser identities against a deployed datastore.
- Analytics definitions and endpoint contracts are verified in code/golden datasets, but displayed values were not reconciled against a live analytics database.
- Remote GitHub Actions has not run because the feature branch exists only locally and was not pushed.
- Production RUM/Core Web Vitals are unavailable; performance numbers are local lab measurements.

These are release blockers for a production-ready claim, not local test failures.
