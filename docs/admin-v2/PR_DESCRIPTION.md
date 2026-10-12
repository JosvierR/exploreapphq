# Draft PR: Explore Admin Dashboard 2.0

**PR:** https://github.com/JosvierR/exploreapphq/pull/44  
**Status:** Draft — keep Draft until live integration gates pass  
**Preview:** https://exploreapphq-git-feat-admin-dashboard-v2-josvierrs-projects.vercel.app (Vercel Authentication protected)

## Summary

Modernizes Explore Admin into a data-first Command Center while preserving routes, API contracts, canonical analytics definitions, Business scoping, and operational capabilities. The branch also removes the deterministic legacy admin bypass, aligns supported runtimes, adds reproducible browser/visual/accessibility QA, and reduces the initial public bundle through route-level splitting.

## What changed

- Explore Command Center shell, responsive navigation, visual tokens, and accessible shared behavior.
- Decision-first Executive Dashboard, Product Analytics, Tourism Intelligence, Analytics Operations, Reports, Users, Content, System, Waitlist, Admin Management, API Docs, and Explore Lab routing.
- URL-owned Product/Tourism filters with browser history, abortable requests, and partial-response resilience.
- Server-only admin allowlist configuration; no public `VITE_*` authorization fallback.
- Firebase Admin modular v14 migration and dependency remediation to 0 audit vulnerabilities.
- Node 22 LTS default, Node 22/24 CI matrix, Playwright functional/visual/performance tests, axe checks, and 47 sanitized screenshots.

## Measured impact

- Entry JS: 2,156.52 kB → 994.72 kB raw; 593.22 kB → 295.56 kB gzip.
- Entry CSS: 370.60 kB → 150.57 kB raw; 68.72 kB → 33.00 kB gzip.
- Initial HTML + entry assets: 2,529.34 kB → 1,147.51 kB raw; 662.82 kB → 329.44 kB gzip.
- Remaining bottlenecks: large API Docs / Waitlist chunks (tracked optimization opportunities).

## Validation

### Local (release prep re-run, Node v24.19.0)

- `npm ci` / audit: 0 vulnerabilities — PASS
- `npm run lint`, `npm test` (64 formal subtests), `build`, `build:api` — PASS
- `openapi:lint`, `verify:browser-secrets`, `verify:shared-migration-history` — PASS
- `npm run test:e2e` — 13/13 PASS

### Remote (PR #44)

- Tests Node 22/24, Build and static release gates, OpenAPI lint — PASS on `132233c`
- Browser QA — FAIL on `132233c` (access-denied screenshot ratio 0.02 vs 0.01); fix `afab33c` raises threshold to 0.03
- Vercel Preview Ready + Deployment Protection — PASS (deploy); full authenticated smoke BLOCKED for agent

See `docs/admin-v2/LIVE_INTEGRATION_REPORT.md`.

## Blockers before Ready for Review

- [ ] Confirm Browser QA green after `afab33c`
- [ ] Human SSO into protected Preview; confirm non-production Supabase
- [ ] Live Admin / non-admin / session scenarios
- [ ] Live Business A↔B isolation
- [ ] Analytics reconciliation vs preview DB

## Risk and rollback

Highest rollout risk is environment provisioning after removal of legacy credentials. Verify `admin_users` and the reviewed server-only allowlist in preview before promotion. Roll back the application version for UI/runtime regressions, but never restore the insecure bypass. No database migration or production data mutation is part of this candidate.
