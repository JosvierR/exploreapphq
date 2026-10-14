# Investor Report Validation

Report contract: `explore-intelligence-report-v2`; metric catalog: `investor-metrics-v2`; confidence: `metric-confidence-v2`.

Automated coverage renders every cross-product of:

- 4 report types: current dashboard, full executive, investor presentation, detailed;
- 7 dashboards: overview, product, growth, tourism, markets, revenue, operations;
- 3 formats: A4, Letter, 16:9;
- 2 languages: English, Spanish.

All 168 combinations passed PDF structure, page count, size, privacy-string, revenue-boundary, and format assertions. Additional partial and unavailable data cases passed. Request allowlists, title/note limits, capacity control, authentication, private/no-store delivery, deterministic filenames, and non-storage behavior are tested.

Investor trust fields now travel with the snapshot and PDF: UTC timezone, reporting window, data cutoff, generation time/actor, classification, contract/catalog versions, fingerprint, quality status, rejection coverage, and metric confidence.

Narrative semantics are separated:

- **Verified observation:** canonical headline values with confidence metadata.
- **Business interpretation:** summaries/insights bounded by sample and quality.
- **Scenario:** opportunity cards; not forecasts, commitments, or audited conclusions.

Mechanics are approved for internal fixture validation. Production-data reports are not approved for external distribution while the selected window is `under_investigation`, revenue is disconnected, or post-deploy verification is pending.
