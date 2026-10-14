# Explore Report Design System

Version: `explore-report-design-v1`.

## Principles

The system uses an editorial business-report hierarchy: dark cover, light analytical pages, restrained Explore blue, compact KPI blocks, vector charts, and explicit evidence boundaries. Empty grids and decorative filler are avoided. Each page represents one coherent analytical idea.

## Identity and structure

- The real `public/icon-192.png` artwork is decoded and embedded on every page with alpha preservation.
- Cover order is product identity, report title, subtitle, optional prepared-for fields, classification, period, cutoff, and generation date.
- Recipient and organization cannot overwrite document title or PDF metadata.
- Content pages use a small kicker, 18–24 pt title, explanatory deck, rule, and a quiet footer with section, period, and page count.

## Color and typography

Ink `#0e131c`, Explore blue `#1354e8`, cyan, green, amber, and restrained tints encode structure and status. Color is never the only status cue; labels and values accompany it. Built-in Helvetica/Helvetica Bold with WinAnsi encoding keeps text searchable and Spanish accents valid. Body and chart text stay within the reviewed print scale; the 16:9 product uses the same tokens with presentation-specific geometry.

## Charts and tables

Time series are vector paths with Y-axis values, units, date anchors, gridlines, direct legend labels, and dashed previous-period comparison. Bar charts show eligible aggregated rankings only. Tables right-align numbers, constrain names, use compact headers, and paginate analyst datasets. Exact supporting values remain available in analyst tables and dashboard disclosures.

## Dynamic composition

The narrative contract decides eligibility before page creation. Revenue pages are omitted from the Investor Snapshot when no reconciled value exists; unavailable markets do not reserve an empty chart. Analyst trends/entities paginate at bounded row counts. Glossary entries are balanced across pages to avoid a nearly empty tail page.

## Metadata and accessibility

Every file contains title, author, subject, creator, UTC creation date, reporting period in the subject, and an `en-US` or `es-ES` `/Lang`. Text is selectable/searchable and images retain print resolution. Remaining limitation: the custom engine does not provide complete PDF/UA tags or embedded semantic table structures.
