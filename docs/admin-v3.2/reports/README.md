# 3.2 Report Artifacts

- `production-ingestion-audit.json`: read-only counts, windows, taxonomy, duplicates, and release cutoff.
- `production-kpi-reconciliation.json`: 17 canonical metrics, raw invariants, normalization differences, previous-period deltas, and quality status.
- `pdf-validation.json`: metadata/text/bounds/render validation for five PDFs and 28 pages.
- `pdf-benchmark.json`: local 25-iteration performance and concurrency guard.
- `explore-intelligence-*.pdf`: nonproduction fixtures for English/Spanish, A4/Letter/16:9, revenue, tourism, and partial-quality/long-title states.
- `rendered/`: 2× PNG render of every sample page.

All monetary/report values are synthetic fixtures unless a file explicitly states `scope: read_only` production counts. PDFs are marked nonproduction.
