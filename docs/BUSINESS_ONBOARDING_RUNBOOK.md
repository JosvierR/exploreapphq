# Business Intelligence onboarding and offboarding

## Before onboarding

Use controlled per-account enablement. Confirm the company identity and an
existing Supabase Auth user through an approved channel; never invent customer
credentials or use fuzzy Place-name matching. Verify schema/history and current
Analytics Health. Keep unrelated external accounts disabled.

## Onboarding

1. Create or verify one `business_accounts` row in `pending` state with the
   reviewed company name, country, industry, and plan.
2. Add the authenticated user to `business_members` with the least-privileged
   role. A Business owner is not a platform Admin.
3. Create a `business_claims` row for the exact existing Place ID and record the
   verification method, evidence, and requester.
4. Have an authorized internal Admin approve the claim with `reviewed_by` and
   `reviewed_at`. Never infer ownership from a similar name.
5. Add the exact Place to `business_locations`, copy its canonical destination
   `geo_id`, and keep it pending until claim approval.
6. Set the reviewed plan and run `sync_business_plan_entitlements(account_id)`.
   Add contract/purchase overrides explicitly.
7. Add only permitted `business_market_access` geographies. Broader markets need
   an explicit grant even though own-location geography is included.
8. Set account/location active, then set `bi_v2_enabled=true` for this account.
9. Recompute real history twice. `fact_business_daily` may now derive from owned
   Place facts; exact fingerprints must match between runs.
10. Sign in as the Business user, not Admin, and validate own/market analytics,
    entitlements, IDOR negatives, cache isolation, and low-sample states before
    giving access.

`scripts/business-provision-pilot.mjs --dry-run` previews the internal pilot.
`--apply` requires pre-existing protected `BI_ADMIN_EMAIL` /
`BI_ADMIN_PASSWORD`, `BI_PILOT_EMAIL` / `BI_PILOT_PASSWORD`, and
`BI_CONTROL_EMAIL` / `BI_CONTROL_PASSWORD` for the final two-tenant proof. The
Admin identity must match `admin_users`, and every identity must be distinct.
The script does not create Auth users or print credentials.

## Required QA

- Business ID, location ID, Place ID, and market `geo_id` tampering returns
  403/404 or a safely filtered result.
- Business A and B cannot read one another in either cache order.
- Each account receives exactly its reviewed entitlements; unentitled exports,
  benchmarks, search, opportunities, or markets are denied.
- Destination market and traveler origin remain distinct.
- `data_as_of`, sample protections, score evidence, and empty states agree with
  Admin for the same authorized scope.

## Disable and offboard

1. Immediately set `bi_v2_enabled=false` for the account.
2. Suspend/close locations and disable or expire entitlement/market-grant rows.
3. Remove/revoke memberships only after confirming all access should end; retain
   claim review and audit evidence.
4. Invalidate tenant-scoped response caches by the configured purge or an API
   deployment/restart.
5. Confirm Business API calls return 403 and no cached tenant response remains.
6. Preserve legitimate raw events and historical facts. Access revocation is
   not authorization to erase analytics history.

For an incident, use the same kill switch, inspect aggregation/schema/quality,
repair additively, recompute affected days, repeat security QA, and re-enable
only the reviewed account.
