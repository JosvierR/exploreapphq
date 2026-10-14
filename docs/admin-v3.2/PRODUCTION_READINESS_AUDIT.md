# Production Readiness Audit

Audit time: 2026-10-14 UTC. Scope: repository, Vercel, Supabase, environment-name inventory, reporting, and read-only production data.

## Repository and deployment

| Surface | Observed state | Readiness |
|---|---|---|
| Local branch | `main` at pre-3.2 base `aec65f5` before this release commit | Candidate in progress |
| `origin/main` | `0427d1d` | Behind local 3.1/3.2 work |
| Live Vercel deployment | `dpl_2q7BCwFTLoeevYjQDmALzzmeR36k` | Healthy, but built from `0427d1d` |
| Live aliases | `exploreapphq.com`, `www.exploreapphq.com` | Active |
| Live API health | version `0427d1dd3f91407793514092ba790b278f19f030`; production/Supabase/BI ready | Verified read-only |
| Runtime | Node `>=22 <25`; Vercel Node 24, `iad1`, 30 s function limit | Compatible |
| Cron | Daily analytics aggregation at 05:15 UTC | Configured |
| Netlify | Legacy configuration only | Not a release target |

The live commit already contains the narrow lifecycle/route-authoring allowlist correction. Explore Intelligence 3.1 (`aec65f5`) and this 3.2 candidate are not deployed.

## Supabase compatibility

`verify:business-schema` passed with no missing relations, columns, indexes, functions, permissions, foreign keys, or configuration checks. RLS is active on all reviewed business tables; facts and maintenance RPCs are not executable by anonymous/authenticated clients. No 3.2 schema migration is required.

Current official Supabase change review found no immediate Node incompatibility (`>=22 <25` is above the dropped Node 20 line). The 2026-10-30 Data API exposure change does not require a new public schema here because reviewed analytical relations are already private/revoked. Management-log API and TLS changes must be tracked for future tooling, not this release.

## Environment and integrations

Vercel production contains Supabase, cron/admin, site, Firebase, SMTP, Twilio, and store variables. It has no environment names for AdMob reporting, RevenueCat, Stripe, promotions ledger, partner settlements, BI billing, Grafana/Loki, or `METRICS_TOKEN`. Values were not printed.

## Data-quality snapshot

- Analytics schema: complete.
- Accepted total: 29,952; dead letters: 9,285.
- Post-correction cutoff: 196 accepted, 0 rejected.
- Last accepted event: `2026-10-14T00:55:59.407598Z`.
- Last rejection: `2026-10-13T22:28:08.538269Z` (before live deployment).
- Destination event geo coverage: 50.4%; place resolution: 99.4%; route resolution: 100%.
- Aggregation failures: 0; possible duplicate places requiring review: 9.

## Compatibility matrix

| Component | Code | Integration | Data | Deployment | Production verified |
|---|---|---|---|---|---|
| Event ingestion | Ready | Ready | Partial historical coverage | Live correction; 3.2 pending | Provisional |
| Operations dashboard | Ready | Ready | Freshness can be stale during low traffic | Pending 3.2 deploy | Pending |
| Canonical KPI core | Ready | Ready | Under investigation for affected windows | Pending 3.2 deploy | Read-only reconciled |
| Investor PDFs | Ready | Ready | Confidence-aware | Pending 3.2 deploy | Fixture verified only |
| AdMob | Ready | Disconnected | Unavailable, not zero | Credentials/runbook pending | Not verified |
| Other revenue streams | Modeled | Disconnected/planned | Unavailable | Product contracts pending | Not verified |
