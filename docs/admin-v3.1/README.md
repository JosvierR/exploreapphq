# Explore Intelligence 3.1

Explore Intelligence 3.1 adds revenue-readiness intelligence and an authenticated, investor-safe PDF reporting system to the existing Admin 3.0 analytics foundation. It does not deploy code, mutate production data, replay analytics events, or claim unverified revenue.

## Implemented

- Added **Revenue & Monetization** at `/admin/analytics/revenue` with executive/detailed density, canonical commercial-intent context, per-stream maturity, exact unavailable states, and integration requirements.
- Added **Intelligence Reports** at `/admin/analytics/report-builder` with current-dashboard, full executive, investor presentation, and detailed modes.
- Added English and Spanish PDF composition, A4, US Letter, and 16:9 formats, 7/30/90/12-month or custom periods, comparisons, optional sections, definitions, quality, cover title, and short note.
- Replaced the Tourism dashboard's browser-print action with the dedicated report workflow. Product, Tourism, every admin topbar, Revenue, and the executive entry point now expose **Download PDF**.
- Added canonical investor metric catalog `investor-metrics-v1` and report contract `explore-intelligence-report-v1`.
- Added server routes `GET /api/admin/business/revenue` and `POST /api/admin/business/reports`, OpenAPI coverage, deterministic filenames, direct private delivery, bounded generation, and structured audit metadata.
- Added real vector/text PDF composition. The engine does not capture dashboard screenshots and does not use browser print CSS.

## Architecture

```text
Admin filter state
      |
      v
Business Analytics Core (one canonical aggregate snapshot)
      |----------------------|
      v                      v
Revenue readiness      Investor-safe projection
                             |
                   cohort suppression + PII exclusion
                             |
                    deterministic PDF composer
                             |
                   private no-store HTTP download
```

The report route authenticates with the same server-side `requireAdmin` guard as the analytics API. It fetches a single Business Analytics Core snapshot per request, projects only export-eligible aggregates, fingerprints that snapshot, and sends PDF bytes directly. No public object URL or persistent report file is created.

## Data classification

| Class | Examples | PDF eligibility |
| --- | --- | --- |
| Internal Operational | dead letters, raw event inspection, system diagnostics, operator workflows | Never investor-exported |
| Executive Business | canonical aggregate KPIs, quality status, market/category aggregates | Executive reports after projection |
| Investor-Safe | approved aggregates, cohorts of at least five, definitions, lineage, explicitly unavailable revenue | Investor reports and presentations |

## Revenue truth

No AdMob/Google Ad Manager, RevenueCat/Stripe, promotions ledger, partner settlement, or BI billing credential is configured in the reviewed environment. Consequently:

- verified revenue is **Unavailable**, never `$0`;
- verified pipeline value is **Unavailable**;
- commercial actions remain nonfinancial intent signals;
- monetary opportunity scenarios are omitted because no authorized baseline supports them.

See [Revenue data availability](revenue-data-availability.md).

## Production data readiness

The read-only production audit on 2026-10-13 found a current 24-hour rejection rate of **30.69%** (499 accepted, 221 rejected). The most recent rejection was 2026-10-13 22:28:08 UTC. Therefore, the previously implemented forward ingestion correction is **not confirmed deployed/effective**. See [Data readiness audit](data-readiness-audit.md).

## Release artifacts

### PDFs

- [Full investor-safe executive report — English A4](reports/explore-intelligence-sample-en-a4.pdf)
- [Investor presentation — Spanish 16:9](reports/explore-intelligence-sample-es-16x9.pdf)
- [Revenue dashboard — English Letter](reports/explore-intelligence-sample-revenue-en-letter.pdf)
- [Tourism dashboard — Spanish A4](reports/explore-intelligence-sample-tourism-es-a4.pdf)
- [Rasterized page previews](reports/previews/) — every page rendered through PyMuPDF, not inferred from PDF syntax.

All sample PDFs use deterministic, clearly marked nonproduction fixture aggregates.

### Screenshots

- **Before:** [`docs/admin-v3/screenshots`](../admin-v3/screenshots/)
- **After:** [`docs/admin-v3.1/screenshots`](screenshots/)

The 3.1 matrix includes Executive, Analytics Operations, Product, Growth, Tourism, Markets, Revenue, and Report Builder at 375×812, 768×1024, 1024×768, 1440×900, and 1920×1080, plus all eight destinations in desktop dark mode and six explicit loading/empty/error/navigation/chart states.

Representative comparison:

| View | Before | After |
| --- | --- | --- |
| Executive desktop | [3.0](../admin-v3/screenshots/principal-executive--desktop-1440x900.png) | [3.1](screenshots/principal-executive--desktop-1440x900.png) |
| Product mobile | [3.0](../admin-v3/screenshots/principal-product-analytics--mobile-375x812.png) | [3.1](screenshots/principal-product-analytics--mobile-375x812.png) |
| Tourism desktop | [3.0](../admin-v3/screenshots/principal-tourism-intelligence--desktop-1440x900.png) | [3.1](screenshots/principal-tourism-intelligence--desktop-1440x900.png) |

## Verification

| Check | Result |
| --- | --- |
| TypeScript | `npm run lint` passed |
| Unit/integration/contracts | `npm test` — 70 passed |
| OpenAPI | Admin, Edge, and generated PostgREST surfaces valid |
| Production build | passed; Revenue 6.35 kB and Report Builder 8.62 kB pre-gzip lazy chunks |
| Focused report download | passed |
| Full Playwright | 16 passed in 4.2 minutes |
| Responsive overflow | passed across 40 light captures and 8 dark captures |
| Accessibility | no critical or serious axe violations on core pages |
| Performance lab | 1 passed; 1,550 ms authenticated usable, 281 ms product route usable, 150 ms filter response, CLS 0.0009, no duplicate analytics requests |
| PDF structure | four report modes, both languages, and all formats exercised |
| PDF visual rendering | all sample pages rasterized successfully; margins and pagination inspected |
| Browser secret audit | passed; 123 artifacts scanned, no server secret exposed |

## Supporting specifications

- [Canonical metric catalog](metric-catalog.md)
- [Chart catalog](chart-catalog.md)
- [Revenue data availability](revenue-data-availability.md)
- [Data readiness audit](data-readiness-audit.md)
- [Security review](security-review.md)

## Operational follow-up

1. Deploy and verify the mobile event-taxonomy correction; then rerun `npm run analytics:ingestion-audit`.
2. Do not reprocess dead letters until a reviewed idempotent replay plan exists.
3. Connect financial sources only with approved read-only credentials and documented recognition/refund/currency rules.
4. Treat PDF audit logs as application logs; add a durable audit table only if retention/compliance requirements demand it.
