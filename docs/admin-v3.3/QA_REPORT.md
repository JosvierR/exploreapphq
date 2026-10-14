# QA Report

Tested on 2026-10-14 UTC.

## Passed gates

- `npm run lint`: pass.
- `npm test`: 74/74 pass, including 21/21 reporting tests and existing analytics, access, migration, API, geography, and security contracts.
- `npm run build`: pass (7,181 modules transformed).
- `npm run openapi:lint`: Admin, Edge, and generated PostgREST pass.
- `npm run verify:browser-secrets`: pass, 123 artifacts scanned.
- `npm run verify:shared-migration-history`: pass; 76 canonical migrations, 11 intentional forwards, no duplicates or hash mismatches.
- `npm run verify:business-schema`: pass; no missing schema/security checks.
- `npm run test:e2e:perf`: pass.
- `npm run test:e2e`: 16/16 pass, including all 87 screenshot comparisons and axe assertions.
- PDF validator: pass, 7 PDFs / 58 pages / zero failures.
- Read-only production reconciliation: canonical invariants pass.

The initial screenshot-generation run exposed a real v2/v3 revenue-catalog compatibility crash. The UI was corrected to tolerate the older `availability` field and absent explanatory fields. The focused workflow passed, followed by a clean 16/16 full regression and visual-comparison run.

## Coverage highlights

Authentication and permissions, filters and history, stale request protection, partial and error data, exports, responsive/dark layouts, chart backing data, accessibility, PDF products/formats/languages, metadata, recipient separation, missing revenue, dynamic section eligibility, privacy scanning, reconciliation, and concurrency limits.

## Non-blocking build warnings

Vite reports existing chunks above 500 KB (notably API docs and the initial application bundle). Rollup also removes two dependency comments it cannot interpret as pure annotations. Neither warning fails the build; both are documented for later code splitting.

## Excluded actions

No destructive test, production load test, database write, migration, replay, deployment, or financial-provider activation was performed.
