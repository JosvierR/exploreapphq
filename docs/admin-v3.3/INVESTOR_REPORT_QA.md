# Investor Report QA

## Automated matrix

The report test suite covers 28 product/format/language combinations and the following risk cases: long title, recipient separation, partial/unavailable data, missing revenue, structured insights, privacy suppression, analyst tables, real logo embedding, metadata, and request validation. Report-focused tests pass 21/21 as part of the full test suite.

## Artifact validation

Seven sample PDFs totaling 58 pages were regenerated from one deterministic nonproduction snapshot. `pdf-validation.json` records, per page:

- dimensions and page count;
- searchable text presence;
- expected 3.3 identity;
- metadata and `/Lang`;
- embedded logo count;
- fixture and KPI reconciliation markers;
- comparison and unavailable-state markers;
- sensitive-string and replacement-character scans;
- out-of-bounds text blocks;
- 2× rendered PNG path.

Result: **PASS**, 7 files, 58 pages, zero validator failures and zero out-of-bounds blocks.

## Visual inspection

All contact sheets and targeted full-page renders were inspected. First-pass presentation footer/revenue spacing, quality-card overlap, evidence-label crowding, narrow table headers, and glossary distribution were corrected. Final samples show clean cover hierarchy, readable axes, unclipped tables, consistent footers, and meaningful page content.

## Numerical integrity

Fixture headline values, previous baselines, and comparison markers are extracted during validation. PDF tests also build the canonical investor-safe snapshot first, ensuring renderer values come from the same immutable contract used by the report narrative. The production reconciliation is separate and never substituted into fixture artifacts.

## Accessibility and language

Text is searchable and selectable; every page has an embedded high-resolution brand image; `en-US` and `es-ES` language tags are present. Spanish accents rendered without replacement glyphs. Full tagged-PDF semantics remain a documented limitation. Canonical English evidence prose is not silently machine-translated.
