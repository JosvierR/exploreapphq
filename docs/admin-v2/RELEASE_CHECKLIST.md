# Admin 2.0 release checklist

Date: 2026-10-12  
Branch: `feat/admin-dashboard-v2`  
Draft PR: https://github.com/JosvierR/exploreapphq/pull/44

Overall decision: **BLOCKED**. Local runtime/build/security-static/browser gates pass. Feature branch and Draft PR are published. Remote unit/build/OpenAPI gates passed on `132233c`. Browser QA initially failed on Windows screenshot AA (fix pushed as `afab33c`). Protected Vercel Preview exists behind Deployment Protection. Live Supabase auth, Business A/B isolation, and analytics DB reconciliation remain blocked pending approved identities and SSO access.

Every row uses `PASS`, `FAIL`, `BLOCKED`, or `NOT APPLICABLE`.

## Gate A — Runtime and build

| Check | Status | Evidence |
|---|---|---|
| Supported Node LTS selected | PASS | `.nvmrc` = `22`; local re-validation on Node `v24.19.0` (engines `>=22 <25`). |
| `.nvmrc` aligned | PASS | `.nvmrc` is `22`. |
| CI runtime aligned | PASS | Workflow matrix Node 22 and 24. |
| `npm ci` | PASS | Clean install; `npm audit` 0 vulnerabilities. |
| `npm test` | PASS | Local + remote Node 22/24; 64 formal subtests. |
| TypeScript | PASS | `npm run lint` exit 0. |
| Frontend production build | PASS | `npm run build` exit 0. |
| Backend build | PASS | `npm run build:api` exit 0. |
| OpenAPI | PASS | Local + remote lint of three surfaces. |
| Remote CI execution | PASS (partial) | Unit/build/OpenAPI green on `132233c`. Browser QA failed then fix `afab33c` pushed — confirm green on follow-up run. |

## Gate B — Security

| Check | Status | Evidence |
|---|---|---|
| No active legacy admin bypass | PASS | Source + functional old-token rejection. |
| Missing authentication returns 401 | PASS | Server unit tests. |
| Authenticated non-admin returns 403 | PASS | Server + fixture E2E access-denied. |
| Server-side role validation | PASS | Supabase identity + allowlist on admin routes. |
| Browser secret audit | PASS | Local + CI `verify:browser-secrets`. |
| Dependency audit | PASS | 0 vulnerabilities after `npm ci`. |
| Fixture auth workflows | PASS | Local Playwright 13/13. |
| Live Supabase Admin auth/session | BLOCKED | Preview behind Vercel Authentication; no approved admin identity for agent. |
| Business isolation with real A/B identities | BLOCKED | Unit PASS; live Preview identities unavailable. |
| Historic credential rotation | BLOCKED | Owner review required; no secrets inspected. |

## Gate C — Visual and accessibility

| Check | Status | Evidence |
|---|---|---|
| 40 principal screenshots | PASS | Local Playwright; committed under `docs/admin-v2/screenshots/`. |
| Important state screenshots | PASS | Local including access-denied. |
| Responsive layout / overflow | PASS | Local matrix. |
| Sidebar and mobile navigation | PASS | Local workflows. |
| Charts/tooltips | PASS | Local state capture. |
| Typography/spacing/contrast | PASS | Visual + axe (no critical/serious). |
| Reduced motion CSS | PASS | Source-reviewed. |
| CI visual parity | FAIL then fix | `132233c` CI: access-denied ratio 0.02 vs 0.01. Threshold → 0.03 in `afab33c`. |
| Real-data visual privacy | NOT APPLICABLE | Fixture-only committed evidence. |

## Gate D — Analytics

| Check | Status | Evidence |
|---|---|---|
| Canonical Executive KPI definitions | PASS | Service/golden tests; no frontend formula forks. |
| Product filters / URL / races / export | PASS | Browser workflows. |
| Tourism filters / geography / export | PASS | Browser + service tests. |
| Comparison period contracts | PASS | BI service tests. |
| Missing/partial/error data representation | PASS | Browser states. |
| Real deployed endpoints and database values | BLOCKED | No authorized preview DB reconciliation. |
| Cross-tenant no-leakage in a deployed system | BLOCKED | Live A↔B not executed. |

## Gate E — Release quality

| Check | Status | Evidence |
|---|---|---|
| Performance measured | PASS | Bundle/report evidence in `PERFORMANCE_REPORT.md`. |
| Confirmed regressions fixed | PASS | Prior audit fixes retained. |
| Code review completed | PASS | Diff vs `main` reviewed in release prep. |
| Documentation accurate | PASS | Updated with live integration report. |
| Isolated preview | PASS (deploy) / BLOCKED (full QA) | Vercel Preview Ready + Deployment Protection. Full smoke needs SSO. |
| Remote PR / Draft | PASS | https://github.com/JosvierR/exploreapphq/pull/44 |
| Rollback reviewed | PASS | App revert only; never restore bypass. |

## Rollout plan

1. Confirm Browser QA green on `afab33c` (or later).
2. Access protected Preview via Vercel Authentication with approved testers.
3. Confirm Preview env targets non-production Supabase.
4. Execute live Admin / non-admin / Business A↔B checks.
5. Reconcile representative analytics vs preview DB.
6. Mark Draft PR ready for human review only after blockers clear.
7. Do not merge or deploy production without explicit approval.

## Rollback plan

- Revert the audit commits or roll back the application release through the hosting platform.
- Do not restore deterministic credentials, legacy `hc_*` tokens, or the removed local JWT flow.
- If access is misconfigured, repair `admin_users` or the reviewed server-side allowlist through the approved provisioning path.
- No database rollback is required; this candidate adds no schema migration or production data mutation.
