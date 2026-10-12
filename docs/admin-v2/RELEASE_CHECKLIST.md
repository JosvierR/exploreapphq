# Admin 2.0 release checklist

This checklist is intentionally conservative. A checked item has local evidence; unchecked items require the release environment or an authorized browser/session.

## Code and contracts

- [x] Canonical admin routes and existing query deep links are preserved.
- [x] Admin shell and route pages are lazy-loaded.
- [x] Executive dashboard uses real existing endpoints and canonical definitions.
- [x] Product/Tourism shared filters are URL-owned and abort stale requests.
- [x] Analytics Operations, moderation, reports, users, content, waitlist, Lab, system, and API docs remain routed.
- [x] No analytics formula, event history, schema, or migration was changed.
- [x] OpenAPI route parity and migration history pass.
- [x] Direct legacy JWT dependency and verified dead auth code were removed.

## Security

- [x] Deterministic browser, Express, and Netlify admin bypasses are removed.
- [x] Backend validates identity and role; frontend state is not authorization.
- [x] Automated 401/403 and old-token rejection tests pass.
- [x] Browser secret audit passes.
- [x] Business isolation/entitlement/cache tests pass.
- [ ] Confirm every intended operator exists in `admin_users` or the reviewed server-side allowlist in the target environment.
- [ ] Rotate/review any historic admin credentials if they were ever shared outside local development.

## Automated validation

- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm run build:api`
- [x] `npm run openapi:lint`
- [x] `npm run verify:browser-secrets`
- [x] `npm run verify:shared-migration-history`
- [x] 70 JavaScript tests and four bundled TypeScript test entrypoints pass under the available runtime.
- [ ] `npm test` passes unchanged under Node 20.

## Browser QA

- [ ] Authenticated login/session refresh/sign-out.
- [ ] Unauthorized and non-admin account behavior.
- [ ] Dashboard partial and total API failure states.
- [ ] Product filters, tabs, CSV export, copy summary, and browser back/forward.
- [ ] Tourism filters, geography drill-down, map fallback, detail drawers, and browser back/forward.
- [ ] Users/content/reports pagination, empty/error/loading states, and safe destructive confirmations.
- [ ] Analytics aggregation confirmation and failure handling.
- [ ] Keyboard-only traversal, focus restoration, reduced motion, and contrast.
- [ ] 375 / 768 / 1024 / 1440 / 1920 px screenshots.
- [ ] No unexpected console errors or failed/duplicated network requests.

## Rollout plan

1. Do not deploy from this worktree until all unchecked gates above are reviewed.
2. Provision and verify authorized admins in a non-production environment first.
3. Deploy a preview using the existing consolidated `api/index.js`; do not add serverless functions.
4. Run the screenshot/auth/data checklist with a controlled fixture account and privacy-safe dataset.
5. Promote through the normal reviewed pipeline, monitor 401/403/5xx, analytics latency, dead letters, and admin route errors.

## Rollback plan

- Roll back the application release through the hosting platform if navigation/rendering regresses.
- Do **not** restore deterministic credentials or the removed local JWT flow during rollback.
- If operators are locked out, repair `admin_users`/allowlist configuration through the approved provisioning path, then redeploy a focused auth fix.
- No database rollback is required for this change because it includes no migration or production data mutation.
