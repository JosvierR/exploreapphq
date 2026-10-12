# Admin 2.0 release checklist

Date: 2026-10-12

Overall decision: **BLOCKED**. Local runtime, build, security-static, browser, visual, and performance gates pass. Preview authentication, live analytics reconciliation, and real Business A/B isolation remain blocked because no isolated environment or approved identities were available.

Every row uses `PASS`, `FAIL`, `BLOCKED`, or `NOT APPLICABLE`.

## Gate A — Runtime and build

| Check | Status | Evidence |
|---|---|---|
| Supported Node LTS selected | PASS | Node 22 LTS selected; Node 24 compatibility also tested. |
| `.nvmrc` aligned | PASS | `.nvmrc` is `22`. |
| CI runtime aligned | PASS | Local workflow matrix covers Node 22 and 24. Remote run is separately blocked below. |
| `npm ci` | PASS | Clean lockfile install completed, 870 packages. |
| `npm test` unchanged | PASS | Node 22 and 24 both exit 0; 64 formal subtests plus 10 direct entrypoints. |
| TypeScript | PASS | `npm run lint` exits 0. |
| Frontend production build | PASS | Vite 6.4.4 build exits 0. |
| Backend build | PASS | `npm run build:api` exits 0. |
| OpenAPI | PASS | All three surfaces validate. |
| Remote CI execution | BLOCKED | Branch is local and was not pushed; no remote workflow run exists. |

## Gate B — Security

| Check | Status | Evidence |
|---|---|---|
| No active legacy admin bypass | PASS | Source guard and functional old-token rejection pass. |
| Missing authentication returns 401 | PASS | Server test passes. |
| Authenticated non-admin returns 403 | PASS | Server test and fixture browser access-denied flow pass. |
| Server-side role validation | PASS | Active routes verify Supabase identity and server-side role/allowlist. |
| Browser secret audit | PASS | 120 build artifacts scanned; no server secret exposed. |
| Dependency audit | PASS | `npm audit --audit-level=low`: 0 vulnerabilities. |
| Fixture auth workflows | PASS | Valid/invalid login, logout, expired session, verification interruption, and multiple tabs pass with sanitized fixtures. |
| Live Supabase Admin auth/session renewal | BLOCKED | No approved isolated project/admin identity supplied. |
| Business isolation with real A/B identities | BLOCKED | Unit/golden coverage passes, but no live tenant identities/environment were supplied. |
| Historic credential rotation | BLOCKED | Requires owner review of external secret history; no credential values were inspected or changed. |

## Gate C — Visual and accessibility

| Check | Status | Evidence |
|---|---|---|
| 40 principal screenshots | PASS | 8 routes × 5 viewports, deterministic Chromium. |
| Important state screenshots | PASS | 7 additional states: loading, empty, API error, collapse, mobile drawer, tooltip, access denied. |
| Responsive layout / overflow | PASS | All 40 principal cases assert no document horizontal overflow; baselines reviewed in contact sheets. |
| Sidebar and mobile navigation | PASS | Collapse persistence, active routes, drawer, and Escape close pass. |
| Charts/tooltips | PASS | Core charts and tooltip state render without clipping in reviewed baselines. |
| Typography/spacing/contrast | PASS | Visual review plus updated tokens; no serious/critical axe findings on core pages. |
| Reduced motion CSS | PASS | Existing reduced-motion behavior retained and source-reviewed. |
| Real-data visual privacy | NOT APPLICABLE | Committed evidence uses sanitized fixtures; no real-user screenshots were taken. |

## Gate D — Analytics

| Check | Status | Evidence |
|---|---|---|
| Canonical Executive KPI definitions | PASS | Service/golden tests and shared API contracts pass; no frontend alternative formulas added. |
| Product filters / URL / races / export | PASS | Browser workflows and repeat regression pass. |
| Tourism filters / geography / export | PASS | Browser workflows pass; canonical geography/service tests pass. |
| Comparison period contracts | PASS | Business service tests and deterministic fixtures pass. |
| Missing/partial/error data representation | PASS | Browser states and partial payload regression pass without fabricating successful data. |
| Real deployed endpoints and database values | BLOCKED | No isolated deployed backend or live analytics dataset was available. |
| Cross-tenant no-leakage in a deployed system | BLOCKED | Automated service coverage passes; live A→B and B→A browser proof is unavailable. |

## Gate E — Release quality

| Check | Status | Evidence |
|---|---|---|
| Performance measured | PASS | Same-command baseline/candidate bundles plus production-preview browser lab recorded. |
| Confirmed regressions fixed | PASS | Stale URL, partial-response crash, Escape, contrast, and sparkline semantics fixed and retested. |
| Code review completed | PASS | Security, UI/state, CI, contracts, and documentation reviewed within feature scope. |
| Documentation accurate | PASS | QA, visual, performance, security, cleanup, PR draft, and this checklist updated. |
| Isolated preview | BLOCKED | No safely configured preview URL/credentials supplied; production was not used. |
| Remote PR checks | BLOCKED | No push or PR was authorized because mandatory gates are blocked. |
| Rollback reviewed | PASS | Application revert only; no schema/data rollback; never restore the bypass. |

## Rollout plan

1. Provision an isolated preview with non-production data and Deployment Protection.
2. Confirm the candidate SHA, Node 22 runtime, build, API routes, CORS, and protected environment variables.
3. Use approved Admin, non-admin, Business A, and Business B identities to execute live auth and A↔B isolation checks.
4. Reconcile representative Executive/Product/Tourism values with the preview database and canonical definitions.
5. Push the branch, run the Node 22/24 workflow, and open a reviewed PR only after the blocked rows pass.

## Rollback plan

- Revert the audit commits or roll back the application release through the hosting platform.
- Do not restore deterministic credentials, legacy `hc_*` tokens, or the removed local JWT flow.
- If access is misconfigured, repair `admin_users` or the reviewed server-side allowlist through the approved provisioning path.
- No database rollback is required; this audit adds no schema migration or production data mutation.
