# PDF Reference Audit

## Reference used

The 3.3 request described an uploaded eight-page report, but no new binary PDF accompanied the text attachment. The closest verifiable reference was the eight-page 3.2 artifact `docs/admin-v3.2/reports/explore-intelligence-sample-partial-quality-en-letter.pdf`. All eight pages were rendered and inspected. This substitution is explicit so the review is reproducible.

## Page findings and structural fixes

1. **Cover:** the prior composition allowed a recipient to dominate title hierarchy and underused the page. The new cover has immutable product identity, independent title/subtitle/recipient/organization fields, real Explore artwork, classification, period, cutoff, and generation date.
2. **Executive summary:** the old summary lacked sufficient baselines and used “traveler demand” for user activity. The new summary shows current, previous, absolute, and valid percent changes and calls the metric observed user activity.
3. **Growth:** the old chart lacked readable axes and useful analysis. The new vector chart includes units, four Y ticks, three date anchors, current/previous legends, daily average, high/low points, and sessions per active user.
4. **Markets:** empty ranking space and prominent Uncategorized data weakened the page. Rankings are now eligibility-gated; category aliases normalize known values and retain an explicit Uncategorized bucket. The demand index is shown only when its inputs are eligible and its 0–100 interpretation is disclosed.
5. **Commercial opportunity:** a single generic recommendation previously consumed a page. The new compact evidence cards require a question, finding, evidence, bounded interpretation/next step, confidence, and limitation.
6. **Revenue:** missing integrations previously dominated investor output. The new page separates reconciled financial performance, observed commercial actions, and internal readiness. Unavailable financial values never become zero.
7. **Quality:** technical identifiers previously overwhelmed readers. Five human-facing dimensions now separate pipeline readiness, completeness, correctness, reporting confidence, and history. Lineage moves to the analyst appendix.
8. **Definitions:** mechanical definitions lacked business meaning. Each catalog entry now carries a plain definition, formula, unit, source, coverage gaps, privacy/export eligibility, and interpretation.

## Visual review

The generated set was rendered at 2× and visually inspected through per-page PNGs and contact sheets. Two first-pass defects—a presentation footer collision and quality-card overlap—were corrected. Compact product headers and glossary pagination were then rebalanced. Final programmatic validation found zero out-of-bounds blocks across 58 pages.

## Remaining PDF limitations

- The lightweight PDF engine provides searchable text, metadata, `/Lang`, and vector drawing, but does not emit a complete tagged-PDF structure tree.
- Spanish report chrome renders correctly, including accents. Canonical source-derived insights and metric definitions retain their validated source language when no reviewed translation exists; they are not machine-translated silently.
- The example numbers are nonproduction fixtures and are labeled on every cover. Production eligibility must be evaluated from a fresh authorized snapshot.
