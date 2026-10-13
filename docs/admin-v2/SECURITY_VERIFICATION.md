# Admin 2.0 security verification

Date: 2026-10-12

Release decision: **BLOCKED for live-environment proof**. Code, unit/contract, dependency, bundle-secret, and fixture-browser security checks pass.

## Authorization architecture reviewed

Active Admin API paths validate a Supabase bearer identity server-side and authorize through `admin_users` or an explicitly configured server-only allowlist. Browser state and public Vite variables are not authorization sources.

Reviewed entrypoints include:

- consolidated Express/Vercel middleware in `server/adminAuth.ts`;
- Netlify verification in `netlify/functions/lib/verifyAdmin.mjs`;
- moderation and admin-roster fallbacks;
- analytics and Business access middleware;
- Firebase Admin compatibility paths used by retained server features.

`VITE_ADMIN_EMAILS` remains a public UI hint only. Server authorization uses `EXPLORE_ADMIN_ALLOWED_EMAILS` or the legacy server-only `ADMIN_ALLOWED_EMAILS` fallback.

## Automated evidence

| Test | Status | Evidence |
|---|---|---|
| Missing bearer token | PASS | Returns unauthenticated/401 in `verifyAdmin.test.mjs`. |
| Legacy deterministic token | PASS | Rejected as unauthenticated. |
| Valid identity without Admin role | PASS | Returns forbidden/403. |
| Active source bypass scan | PASS | No hardcoded bypass, `ADMIN_PASSWORD`, or public `VITE_ADMIN_EMAILS` authorization fallback. |
| Browser invalid/valid/logout flow | PASS (fixture) | Playwright sanitized auth fixture. |
| Expired session / interrupted verification | PASS (fixture) | Login screen and retry behavior verified. |
| Unauthorized browser | PASS (fixture) | Access-denied state and screenshot verified. |
| Browser secret scan | PASS | 120 production artifacts; no configured `SUPABASE_SECRET_KEY` match. |
| Dependency audit | PASS | 0 vulnerabilities at all severities. |
| Business ID/location/market tampering | PASS (unit/contract) | A cannot select B; external scopes never become global. |
| Entitlements / expired grants | PASS (unit/contract) | Enforced server-side. |
| Cache isolation | PASS (golden/service) | Actor/account/location/place/market/filter scope is partitioned. |
| Raw data/privacy controls | PASS (source/contract) | Private-by-default facts and restricted maintenance/snapshot RPCs verified. |

## Dependency and configuration hardening

- Firebase Admin migrated to modular v14 APIs.
- Firebase, nodemailer, Redocly, provider utilities, and gRPC transitive dependencies were updated/remediated.
- `npm audit --audit-level=low` reports 0 vulnerabilities.
- Example environment files and helper scripts no longer advertise or inject obsolete admin passwords.
- No real credential, token, raw personal data, or production screenshot is included in this evidence.

## Business isolation

Automated tests cover Business A→B selection attempts, location/place/market scopes, geography tampering, entitlement gating, expired grants, and cache-key/value isolation. The canonical service preserves Admin's global scope while restricting external Business actors.

**Live verification remains BLOCKED.** No isolated preview, approved Business A/B identities, or non-production datastore was supplied, so browser proof against deployed RLS/data is absent. Automated coverage must not be represented as live tenant certification.

## Authentication limitations

The Playwright suite uses sanitized deterministic fixtures to verify browser state transitions. It does not prove a real Supabase password exchange, refresh token rotation, or target-environment operator provisioning. Server tests do exercise real authorization code with mocked Supabase responses, but the following require preview access:

- approved Admin login and renewal;
- direct unauthenticated URL against deployed APIs;
- non-admin identity against deployed APIs;
- invalid token and CORS behavior at the hosting edge;
- target `admin_users`/server-only allowlist provisioning.

## Unresolved security findings

No confirmed code vulnerability remains in the audited scope. Release blockers are missing environmental evidence:

1. Live Admin/non-admin authentication in an isolated preview.
2. Live Business A↔B isolation against deployed data.
3. Owner review/rotation decision for any historic deterministic credentials that may have left local development.
4. Remote CI and protected-preview verification for the final commit.

Production was not used, authentication was not weakened, and no grants or schemas were changed for testing.
