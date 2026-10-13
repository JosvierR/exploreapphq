# Admin 2.0 performance report

Date: 2026-10-12

Baseline: `origin/main` at `3a9303b26238ca8fb037d2214f4e23c7de2ac89d`

Candidate: working tree on `feat/admin-dashboard-v2`

Both artifacts were produced with the repository's production `npm run build` command. Production source maps are excluded. Raw, gzip, and Brotli measurements come from `scripts/report-bundle-sizes.mjs`.

## Bundle comparison

| Artifact | Baseline raw | Candidate raw | Baseline gzip | Candidate gzip | Baseline Brotli | Candidate Brotli |
|---|---:|---:|---:|---:|---:|---:|
| Entry JS | 2,156,516 B | 994,722 B | 593,220 B | 295,561 B | 489,140 B | 250,376 B |
| Entry CSS | 370,604 B | 150,571 B | 68,722 B | 32,998 B | 55,569 B | 27,674 B |
| HTML + entry assets | 2,529,338 B | 1,147,511 B | 662,822 B | 329,438 B | 545,371 B | 278,710 B |
| API Docs JS | 2,943,953 B | 3,356,221 B | 902,265 B | 1,027,145 B | 732,213 B | 826,007 B |

The candidate reduces initial raw payload by 54.6% and initial gzip by 50.3%. API Docs grew by 412,268 raw bytes (14.0%) but remains route-isolated; it is the largest remaining bundle bottleneck.

## Candidate route assets

| Asset | Raw | Gzip | Loading behavior |
|---|---:|---:|---|
| Admin shell JS | 13.26 kB | 4.16 kB | Lazy with admin route |
| Admin shell CSS | 59.34 kB | 10.47 kB | Admin route asset |
| Executive Dashboard | 56.87 kB | 15.58 kB | Route-lazy |
| Product Analytics | 33.80 kB | 9.82 kB | Route-lazy |
| Tourism Intelligence | 50.40 kB | 11.79 kB | Route-lazy |
| Analytics Operations | 21.78 kB | 5.34 kB | Route-lazy |
| Reports | 46.04 kB | 10.46 kB | Route-lazy |
| Tourism map component | 4.48 kB | 2.20 kB | Component-lazy |
| Chart library chunk | 417.39 kB | 120.03 kB | Loaded by chart routes |
| Waitlist | 687.19 kB | 173.18 kB | Route-lazy; follow-up candidate |
| API Docs | 3,356.22 kB | 1,027.15 kB | Route-lazy; primary follow-up candidate |

## Browser lab

Command: `npm run test:e2e:perf`

Environment: local production preview, Playwright Chromium, deterministic sanitized API fixtures. This is a lab test, not field RUM.

| Metric | Result |
|---|---:|
| Authenticated dashboard usable | 1,800 ms |
| Product route usable after navigation | 289 ms |
| Filter response | 327 ms |
| DOMContentLoaded / load | 357.0 / 357.2 ms |
| CLS | 0.00101 |
| Analytics requests | 16 |
| Duplicate analytics requests | 0 |
| Tile requests on unrelated route | 0 |
| Resources | 47 |
| JS heap used | 20.5 MB |
| CDP task / script / layout | 1,744 / 700 / 414 ms |
| Long tasks | 99, 58, 115, 273, 52 ms |
| Test result | PASS, 1/1 |

## Observations

- Admin pages, map, Waitlist, and API Docs are not part of the public initial route bundle.
- The Product route does not issue duplicate analytics requests under the measured workflow.
- Unrelated Product navigation does not load map tiles.
- Layout shift is negligible in the deterministic run.
- There is no evidence of sustained animation blocking, but the cold local run contains one 273 ms long task.

## Remaining bottlenecks

1. API Docs is 3.36 MB raw / 1.03 MB gzip and grew relative to baseline; deeper Scalar/vendor splitting is the clearest follow-up.
2. Waitlist is 687 kB raw / 173 kB gzip and should be profiled before broad rollout.
3. The 417 kB chart chunk is shared efficiently but still material on analytics routes.
4. The 273 ms cold-load long task warrants profiling on representative preview hardware.
5. No production RUM/Core Web Vitals were available, so lab measurements must not be presented as user-field performance.
