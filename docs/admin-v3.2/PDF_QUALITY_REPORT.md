# PDF Quality Report

Five representative artifacts were generated: English A4 executive, Spanish 16:9 investor, English Letter revenue, Spanish A4 tourism, and an English Letter detailed partial-quality/long-title case.

PyMuPDF validated and rendered 28 pages at 2× resolution. Results:

- metadata title/author/subject/creator/date present;
- `INTELLIGENCE 3.2`, classification, fixture warning, and report contract extract correctly;
- expected KPI `18,420` extracts from full reports;
- unavailable-revenue language is present where applicable;
- no secret patterns, replacement glyphs, or out-of-page text blocks;
- dimensions match A4, Letter, and 960×540 presentation formats.

Visual inspection found and fixed two issues before final validation: a long cover title lost its final words, and the fifth revenue-stream requirement overlapped the policy strip in 16:9. Dynamic cover typography/four-line handling and adjusted landscape row spacing resolved both. Quality, partial-state, Spanish chart, revenue, cover, and long-title pages were then re-rendered and inspected.

Evidence: [`reports/pdf-validation.json`](reports/pdf-validation.json), [`reports/pdf-benchmark.json`](reports/pdf-benchmark.json), sample PDFs, and [`reports/rendered/`](reports/rendered/).
