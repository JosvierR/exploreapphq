# PDF Performance

Benchmark: Node v24.19.0 on Windows x64, 25 local iterations per variant, deterministic synthetic snapshot. This isolates composition CPU and is not end-to-end network latency.

| Variant | Median | p95 | Output |
| --- | ---: | ---: | ---: |
| Investor Snapshot A4 EN | 6.995 ms | 9.718 ms | 37,990 B |
| Executive Report A4 EN | 7.299 ms | 12.442 ms | 55,414 B |
| Investor Presentation 16:9 ES | 6.848 ms | 13.630 ms | 44,730 B |
| Analyst Report Letter EN | 10.944 ms | 13.460 ms | 66,681 B |
| Current Revenue Letter EN | 0.845 ms | 2.206 ms | 23,879 B |

The concurrency guard permits two simultaneous renders and rejects a third with `report_capacity_reached`; its benchmark assertion passed.

## Comparison to 3.2

3.2 p95 ranged from 1.408 ms for the small revenue file to 7.813 ms for its executive file. 3.3 deliberately spends more isolated CPU because every page now embeds the real logo and the reports contain more pages, vector charts, tables, metadata, and narrative checks. This is **not claimed as a raw generation speed improvement**. Even the 14-page analyst report remains below 14 ms p95 in the local benchmark, and bounded concurrency protects memory.

Performance work focused on predictable scaling: one decoded brand asset, compressed image streams, immutable snapshot reuse, bounded rows, dynamic omission, balanced pagination, and a hard concurrency cap. Full results are in `benchmarks/pdf-benchmark.json`.
