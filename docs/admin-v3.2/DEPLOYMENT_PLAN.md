# Deployment Plan

No deployment was performed. Recommended controlled sequence:

## Preflight

1. Confirm the release commit contains only intended 3.2 files and preserves the three unrelated untracked scripts.
2. Require green unit/integration, TypeScript/build, OpenAPI, browser-secret, migration-history, PDF, accessibility, visual, and performance gates.
3. Confirm no database migration is included or required.
4. Confirm `origin/main` includes the 3.1 base plus the reviewed 3.2 commit; current production/origin are behind local work.
5. Decide whether durable monitoring will use Vercel log drains/queries or a Prometheus remote collector; configure notification ownership.
6. Keep AdMob and other financial integrations disconnected unless reviewed credentials and finance methodology are separately approved.

## Release

1. Create a Vercel preview from the exact release commit.
2. Run authenticated API smoke tests and generate one private fixture PDF.
3. Exercise ingestion with controlled test events covering session lifecycle, route authoring, invalid name/entity, and duplicate ID.
4. Verify health contract version, corrected rates, alert diagnostics, and source freshness.
5. Promote the immutable preview to production during an observed-traffic window.
6. Record deployment ID, commit, actor, UTC time, aliases, and pre/post health snapshots.

## Post-deploy gate

Monitor 15m, 1h, 6h, and 24h. Require at least 100 attempts, <1% rejection proxy, no legitimate rejections, acceptable authentication failures, fresh source during expected traffic, no aggregation failure, KPI invariants matching, and successful report download. Keep external investor distribution disabled until the 24-hour gate passes and the selected reporting period is not `under_investigation`.

AdMob activation is a separate release: add server-only credentials, verify account/currency/date totals against the provider UI, and retain `estimated_not_final` until finance reconciliation.
