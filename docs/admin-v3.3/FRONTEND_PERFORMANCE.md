# Frontend Performance

Environment: local production preview, Playwright Chromium, sanitized deterministic API fixtures. Measurements are lab results, not public-network RUM.

| Metric | 3.2 baseline | 3.3 | Change |
| --- | ---: | ---: | ---: |
| Authenticated usable | 1,618 ms | 1,509 ms | -6.7% |
| Product route usable | 284 ms | 243 ms | -14.4% |
| 30-day filter response | 218 ms | 197 ms | -9.6% |
| Largest observed long task | 201 ms | 173 ms | -13.9% |
| JS heap used | 20.5 MB | 18.2 MB | -11.2% |
| CLS | 0.00090 | 0.00090 | stable |
| Duplicate analytics requests | 0 | 0 | stable |
| Unrelated tile requests | 0 | 0 | stable |

The final 3.3 run also recorded DOMContentLoaded 308 ms, 46 resources, 4,685 DOM nodes, 1,347 ms aggregate task duration, and long tasks of 89/67/173 ms.

## Changes tied to the result

- Accessible chart table rows are not mounted until a user first expands the disclosure.
- The report builder is route-lazy and produces no fake interval progress or repeated polling.
- Executive chart context reuses existing payloads rather than creating another analytics request.
- Data and comparison work in the business service is parallelized where dependencies allow.

## Bundle

Initial assets remain effectively flat versus 3.2: 1,148,076 bytes raw (unchanged), 329,564 gzip (+3 bytes), and 278,795 Brotli (+20 bytes). The new `AdminReportBuilderPage` is 11.40 KB raw / 3.60 KB gzip; `AdminRevenuePage` is 7.52 KB / 2.70 KB. Existing unrelated large chunks remain: the initial application JS is 995.29 KB and API documentation is 3.36 MB raw. Further route/vendor splitting is recommended but was not required to ship the isolated 3.3 reporting work.

The performance test asserts sub-15-second authentication, sub-10-second route/filter readiness, no duplicate analytics calls, no tile work, and heap below 300 MB; all gates passed.
