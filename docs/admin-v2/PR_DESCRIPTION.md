# Draft PR: Explore Admin Dashboard 2.0

Status: **not opened — release gates remain blocked**

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
- Local production-preview lab: authenticated usable 1.800 s, Product route usable 289 ms, filter response 327 ms, CLS 0.0010, no duplicate analytics requests, no unrelated map-tile requests.
- Remaining bottlenecks: 3.36 MB raw API Docs chunk and a 273 ms cold-load long task.

## Validation

- `npm test`: Node 22 and 24 pass; 64 formal subtests plus 10 direct entrypoints.
- `npm run test:e2e`: 13/13 pass, including 40 principal visual baselines, 7 state baselines, responsive overflow, workflows, races, and axe.
- `npm run test:e2e:perf`: 1/1 pass.
- TypeScript, frontend build, API build, all OpenAPI surfaces, migration history, browser-secret scan, and dependency audit pass.

## Blockers before this PR can be marked ready

- Run against an isolated protected preview with approved Admin/non-admin and Business A/B identities.
- Prove live Supabase login/session renewal and 401/403 behavior.
- Reconcile representative dashboard numbers with the preview analytics database.
- Prove A→B and B→A tenant isolation against the deployed datastore.
- Push the branch and obtain a green remote Node 22/24 workflow.

## Risk and rollback

The highest rollout risk is environment provisioning after removal of legacy credentials. Verify `admin_users` and the reviewed server-only allowlist in preview before promotion. Roll back the application version for UI/runtime regressions, but never restore the insecure bypass. No database migration or production data mutation is part of this audit.
