# Migration reconciliation checkpoint (2026-08-11)

**Production:** `ookbeuiavzjhvezvamfu` (Explore Atlas Prd)  
**Gates:** `SAFE TO RECONCILE LOCAL HISTORY: YES` · `SAFE TO MODIFY PRODUCTION: NO`

## Production safety rules

- Do not run `supabase db push` until the linked project, migration list, intentional forward set, and dry-run are confirmed.
- Do not use `supabase migration repair` to manufacture historical alignment.
- Do not run `db reset --linked`.
- Do not backfill or activate external Business accounts until schema, security, idempotency, and metric gates pass.
- Do not push to `main` until the full quality gate passes.

## Canonical result

| Set | Count |
|---|---:|
| Production-applied canonical baseline | 76 |
| Vendored canonical baseline | 76 |
| Historical collisions | 0 |
| Intentional forward migrations | 3 |

The tracked source of truth is `supabase/migration-baseline.json`. Run
`npm run verify:shared-migration-history` before any linked migration workflow.

## Provenance artifacts

| Path | Purpose |
|---|---|
| `migration-inventory.json` | Original version inventory, hashes, and classification |
| `migration-sets.json` | Exact pre-reconciliation remote/local/matching sets |
| `proposed-migrations/` | Canonical baseline (76 remote) plus three BI forwards |
| `recovered-from-explore-v2/` | Explore-V2 `main` tip migration files |
| `orphans/` | Three files from Explore-V2 `origin/dev` and two seed migrations recovered from `schema_migrations.statements` |
| `db-push-dry-run-after-proposed.txt` | Checkpoint dry-run showing only the three intended forwards |
| `sql-probes/` | Read-only production probe SQL |
| `*.json` | Schema probes, policies, aggregate definition, and deep audit evidence |

For the two statement-recovered files, the manifest records
`source = schema_migrations.statements` and `original_git_file = unknown`; provenance is not inferred.

## Collision and compatibility decisions

- `20260701120000` is canonically `moderation_visibility_lifecycle`; the conflicting local analytics file is retired.
- `20260704160000` is canonically `place_photos_position`; the conflicting local safe-delete file is retired.
- `AFFINITY_FORWARD_REQUIRED = YES` (corrected 2026-08-12). Even with `SECURITY DEFINER` / `postgres` ownership, PostgREST `service_role` callers still hit SQLSTATE `21000` (`DELETE requires a WHERE clause`) on bare affinity deletes. Forward `20260812160000_fix_aggregate_affinity_safe_deletes.sql` patches both affinity deletes to `WHERE TRUE`.
- `AUTHENTICATED_GRANT_REQUIRED = NO`. The canonical analytics migration revokes aggregate execution from `authenticated` and grants it to `service_role`. All repository aggregation callers—the Admin operation, cron, and backfill—use a server-side service-role client. Restoring the legacy browser-capable grant would unnecessarily broaden privileges.

## Shared migration ownership

Supabase Production is shared by Explore Mobile and Explore Web. Migration timestamps are globally unique across the production database, not per repository.

The near-term ownership flow is:

```text
canonical production baseline
        ↓
exploreapphq vendored baseline
        ↓
new forward migrations only after sync
```

If both applications continue changing the shared database, move migration ownership to a dedicated `explore-database` repository. Until then, every producer must synchronize against the canonical manifest before choosing a timestamp.

## Production workflow

1. Run `npm run verify:shared-migration-history`.
2. Run `npx.cmd supabase migration list --linked` and confirm the linked project is `ookbeuiavzjhvezvamfu`.
3. Run `npx.cmd supabase db push --linked --dry-run`; expect only the three intentional forwards.
4. Complete the pre-DDL tests, TypeScript, OpenAPI, build, security, and risk gates.
5. Only then apply production DDL.

`20260808120000_place_photos_private_signed_urls.sql` is not recorded as applied in production and is intentionally excluded. It requires a separate forward product decision.
