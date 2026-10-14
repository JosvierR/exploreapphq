# Analyst Experience

## Implemented workflow

The executive overview now leads with a business question, a concise evidence answer, reporting period, unit, cutoff, and quality context. Chart backing tables mount only after first expansion, reducing initial DOM work while remaining keyboard-accessible.

The report builder is organized around real products rather than one generic export:

- Investor Snapshot
- Executive Business Report
- Analyst Report
- Investor Presentation
- Current Dashboard

Selecting a product changes supported format, detail, section outline, and expected scope. Title, subtitle, recipient, organization, and note are separate fields. The preview surfaces period, classification, content-aware outline, and unavailable-section warnings. Generation feedback reports only observable states; it does not invent percentage progress.

Revenue & Monetization separates verified performance, commercial signals, and stream readiness. Detailed mode exposes the metric contract and remains compatible with both v2 and v3 API payloads.

## Demonstrated analyst path

1. Open Executive Overview and select 30 days.
2. Read observed user activity with previous-period values and cutoff.
3. Compare route starts without treating the percentage as durable growth when the baseline is small.
4. Open Product Analytics and inspect route/place tables.
5. Review category and destination evidence; keep unsupported geography qualified.
6. Inspect one deterministic finding with its evidence and limitation.
7. Review the five separate readiness dimensions.
8. Open Revenue & Monetization and confirm financial performance is unavailable while one commercial action is observed.
9. Generate the appropriate investor-safe document and reconcile headline values to its snapshot.

## Interaction evidence

Playwright covers global filters, URL/history state, stale-response protection, partial and error states, navigation, CSV/PDF downloads, role denial, chart data tables, light/dark themes, and five viewport sizes. The resulting 87 screenshots are under `screenshots/`.

## Boundaries

Cohort analysis and conversion funnels remain omitted where production instrumentation is insufficient. This is intentional: 3.3 does not synthesize missing steps or causal explanations. Full cross-dashboard global filter unification beyond existing URL contracts remains follow-up work.
