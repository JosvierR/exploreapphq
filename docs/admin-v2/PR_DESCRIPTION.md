# PR: Explore Admin Dashboard 2.0

## Summary

Modernizes Explore Admin into a data-first Command Center while preserving routes, APIs, analytics definitions, Business isolation, and operational capabilities. The change also removes a confirmed deterministic admin bypass and cuts the public main bundle roughly in half through route-level code splitting.

## What changed

- New Explore Command Center shell, information architecture, tokens, responsive behavior, and accessible shared primitives.
- Decision-first `/admin` executive overview using canonical analytics plus operations data.
- Clear separation of Analytics Operations, Product Analytics, and Tourism Intelligence.
- Shareable URL filters with abortable requests and no route remount on query changes.
- Lazy admin pages, lazy tourism map, and retained lazy API docs.
- Removal of hardcoded admin credentials/tokens, legacy local JWT issuance, unused auth components, and direct JWT dependencies.
- Updated contracts and Admin 2.0 audit/design/architecture/cleanup/QA/release documentation.

## Measured impact

- Main JS: 2,156.98 kB to 992.42 kB (-54.0%).
- Main JS gzip: 593.41 kB to 294.75 kB (-50.3%).
- Main CSS: 292.97 kB to 150.57 kB (-48.6%).
- No new runtime dependency, endpoint, serverless function, schema change, or production data mutation.

## Validation

TypeScript frontend/server builds, production build, OpenAPI, secret audit, migration history, 70 JavaScript tests, and four TypeScript test entrypoints pass. The aggregate `npm test` command must be rerun under the repository-supported Node 20 because the available Node 24 `tsx` loader fails before executing a test.

## Risk and rollout

The highest rollout risk is operator provisioning after removal of legacy credentials. Verify `admin_users`/the reviewed allowlist in preview before promotion. Browser visual and authenticated end-to-end QA remain explicit release gates in `RELEASE_CHECKLIST.md`.

Rollback the application version for UI regressions, but never restore the insecure bypass. There are no database migrations to reverse.
