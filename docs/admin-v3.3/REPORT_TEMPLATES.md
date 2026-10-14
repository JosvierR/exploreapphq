# Report Templates

## Product matrix

| Product | Audience | Typical scope in fixture | Formats | Content behavior |
| --- | --- | ---: | --- | --- |
| Investor Snapshot | Introduction / diligence | 7 pages | A4, Letter | Skimmable traction, activity, product, markets, commercial evidence, conclusions; no engineering appendix. |
| Executive Business Report | Leadership / board | 12 pages | A4, Letter | Adds revenue boundary, quality, conclusions, and business glossary. |
| Analyst Report | Reproducible analysis | 14 pages | A4, Letter | Adds exact trend/entity tables and technical lineage; paginates without fixed limit. |
| Investor Presentation | Live narrative | 9 slides | 16:9 only | Landscape composition, one major idea per slide, no tiny analyst tables. |
| Current Dashboard | Operational export | 2 pages in samples | A4, Letter | Reflects selected dashboard, range, filters, classification, and definitions. |

## Shared input contract

Inputs include product, dashboard, range/custom dates, comparison, language, format, detail, classification, title, subtitle, recipient, organization, note, definitions, opportunities, quality, and supported section IDs. Legacy product aliases remain accepted server-side for compatibility.

The backend sanitizes and validates every input. It enforces 16:9 for presentations, supported section/product combinations, title and recipient length, authorized classifications, bounded page data, and safe download filenames. The UI presents only supported combinations.

## Section eligibility

Sections require available data, adequate coverage, compatible classification, meaningful visualization content, and a supported conclusion. The narrative engine returns both eligible sections and reasons for omission/qualification. No arbitrary text is promoted into a title hierarchy.

## Examples

The repository contains all five products plus English, Spanish, A4, Letter, and 16:9 coverage. The Eduardo example proves that `Prepared for: Eduardo` remains subordinate to `Explore Executive Business Report` and that PDF title metadata remains the report product.
