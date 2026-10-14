# Release Notes — Explore Intelligence 3.3

## Added

- Central metric-readiness and five-dimension data-quality contracts.
- Deterministic question/finding/evidence/interpretation/next-step/limitation insights.
- Five distinct report products with content-aware section eligibility.
- Investor-grade PDF cover, vector trend chart, compact KPI comparisons, rankings, evidence cards, revenue boundary, methodology, glossary, analyst tables, and technical lineage.
- Real Explore logo embedding, PDF metadata, language tags, A4/Letter/16:9 layouts, and English/Spanish report chrome.
- Analyst-oriented report builder with product presets, supported configuration filtering, outline preview, and separate title/recipient fields.
- Chart context for unit, period, cutoff, quality, and limitations.
- Automated artifact renderer/validator and PDF concurrency benchmark.

## Changed

- “Traveler demand” is no longer inferred from active-user movement.
- Categories are normalized through known aliases while retaining Uncategorized explicitly.
- Current/comparison and enrichment reads execute concurrently where independent.
- Revenue metrics use `verified_revenue`; commercial actions remain nonfinancial.
- Accessible chart tables defer DOM mounting until first use.
- UTC reporting labels now match server window semantics.

## Fixed

- Recipient text can no longer replace the report title.
- Percentage baselines and absolute changes appear together.
- Revenue unavailable states no longer resemble zero.
- Narrow report-table headers, glossary tail pagination, presentation footer collisions, and quality/evidence overlaps were corrected.
- Revenue detailed mode tolerates v2 and v3 metric-catalog payloads.
- Reconciliation artifacts now take their formula version from the canonical module constant.

## Compatibility

Legacy report aliases remain accepted. Existing dashboard routes, authentication, CSV exports, and admin navigation are preserved. No migration is required for this code release.
