# Migration reconciliation checkpoint (2026-08-11)

**Production:** `ookbeuiavzjhvezvamfu` (Explore Atlas Prd)  
**Gates:** `SAFE TO RECONCILE LOCAL HISTORY: YES` · `SAFE TO MODIFY PRODUCTION: NO`

## Do not run tomorrow until re-read

- `supabase db push` (without confirmed dry-run of intentional forwards only)
- `supabase migration repair` (especially bulk `reverted`)
- `db reset --linked`
- BI backfill / production activation
- push to `main`

## Corrected counts

| Set | Count |
|---|---:|
| Remote | 76 |
| Local | 12 |
| Matching version IDs | 2 (both **different SQL**) |
| Remote-only | 74 |
| Local-only | 10 |

Math: `2+74=76`, `2+10=12`.

## What this folder contains

| Path | Purpose |
|---|---|
| `migration-inventory.json` | Full version inventory + hashes + classification |
| `migration-sets.json` | Exact REMOTE/LOCAL/MATCHING/ONLY sets |
| `proposed-migrations/` | Canonical baseline (76 remote) + 3 BI forwards — dry-run proven |
| `recovered-from-explore-v2/` | Explore-V2 `main` tip migration files |
| `orphans/` | 3 from Explore-V2 `origin/dev` + 2 seed SQLs from `schema_migrations.statements` |
| `db-push-dry-run-after-proposed.txt` | Dry-run after temp vendor: **only** the 3 BI/snapshot migrations |
| `sql-probes/` | Read-only probe SQL used against production |
| `*.json` | Schema probes, policies, aggregate def, deep audit |

## Collisions

- `20260701120000`: local `analytics_events` vs remote Explore-V2 `moderation_visibility_lifecycle`
- `20260704160000`: local `analytics_aggregate_safe_deletes` vs remote `place_photos_position`  
  Production aggregate still has bare `DELETE FROM user_*_affinity` → needs **new** forward timestamp (do not reuse `20260704160000`)

## Next steps (local only first)

1. Vendor `proposed-migrations/` → `supabase/migrations/` permanently (replace collisions; remove redundant local-only).
2. Generate real affinity `WHERE TRUE` forward from `pg_get_functiondef` (optional before BI).
3. `npx.cmd supabase migration list --linked`
4. `npx.cmd supabase db push --linked --dry-run` → expect only intentional forwards.
5. Only then consider production apply with explicit approval.

## Note

`Explore-V2` `main` also has `20260808120000_place_photos_private_signed_urls.sql` which is **not** on production — do not vendor it into the baseline.
