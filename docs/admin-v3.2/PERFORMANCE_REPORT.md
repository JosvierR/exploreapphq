# Performance Report

## Admin browser lab

Local production preview with deterministic sanitized fixtures:

| Measure | Result | Guardrail |
|---|---:|---:|
| Authenticated usable | 1,618 ms | <15,000 ms |
| Product route usable | 284 ms | <10,000 ms |
| Filter response | 218 ms | <10,000 ms |
| CLS | 0.00090 | Informational / effectively stable |
| JS heap | 20.5 MB | <300 MB |
| Duplicate analytics requests | 0 | 0 |
| Unrelated tile requests | 0 | 0 |

Four long tasks (95, 57, 201, 62 ms) occurred in the synthetic lab. They are not release-blocking but should be rechecked on representative hardware.

## PDF benchmark

Twenty-five iterations per variant on Node v24.19.0 / Windows x64:

| Variant | Median | p95 | File size |
|---|---:|---:|---:|
| Full executive A4 EN | 3.359 ms | 7.813 ms | 18,177 B |
| Investor 16:9 ES | 3.723 ms | 6.071 ms | 18,750 B |
| Detailed Letter EN | 3.484 ms | 6.770 ms | 21,181 B |
| Current revenue Letter EN | 0.708 ms | 1.408 ms | 8,234 B |

The two-active-report guard passed and rejected the third request. These are local synthetic render times, not network/production latency.

## Bundle

Production build passed. Initial payload: 1,148,076 B raw / 329,561 B gzip. Largest lazy chunks remain API Docs (3.36 MB raw, 1.03 MB gzip) and Waitlist (687 KB raw, 173 KB gzip). These are existing optimization targets; 3.2’s Analytics/Revenue chunks are 23.55 KB and 7.22 KB raw respectively.
