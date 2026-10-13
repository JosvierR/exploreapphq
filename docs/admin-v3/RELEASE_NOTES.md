# Explore Admin 3.0 — release notes

## Shipped in this candidate

- Replaced the decorative executive hero and six-card summary with a compact four-KPI decision surface: Active users, Sessions, Route starts, and Commercial actions.
- Moved the overview to the canonical normalized Business Analytics dashboard contract and added route-start time-series comparisons.
- Added URL-owned Today/7/30/90/custom reporting periods, previous-period comparison, UTC/browser-timezone disclosure, refresh, and data-through context.
- Added selectable product-activity trends, an accessible data table, feature-adoption signals, honest growth/retention states, and exception-only operations status.
- Consolidated service status and account actions into compact menus; added persisted, deliberate light/dark themes.
- Added responsive behavior for 375, 768, 1024, 1440, and 1920-pixel widths with no document overflow.
- Corrected the forward analytics ingestion validator for the observed `session` entity and lifecycle/route-authoring event taxonomy; aligned docs, UI labels, and tests.
- Added repeatable read-only ingestion and executive-KPI reconciliation commands.

## Data and safety

- Existing Supabase Auth, admin authorization, business scoping, rate limits, redaction, idempotency, and server-only secret boundaries are preserved.
- No database migration was required.
- No production data was replayed, backfilled, edited, or deleted.
- No deployment was performed.

## Deployment checklist

1. Review this candidate and the visual evidence in `docs/admin-v3/screenshots`.
2. Deploy the API validator and web build through the existing approved pipeline.
3. Run authenticated production smoke checks for Overview, Product Analytics, Tourism Intelligence, and Analytics Operations.
4. Confirm new accepted lifecycle events and a falling 24-hour dead-letter rate.
5. Treat historical replay as a separate change with dry-run output, event-ID deduplication, and rollback evidence.
