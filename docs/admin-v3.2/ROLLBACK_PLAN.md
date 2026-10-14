# Rollback Plan

No schema migration or production data write is part of 3.2, so application rollback is sufficient for the release candidate.

## Trigger conditions

- legitimate event rejection above 1% after minimum volume;
- authentication failures spike;
- accepted traffic stops during an established-volume window;
- admin API/PDF authorization or privacy regression;
- KPI invariants diverge;
- error/latency materially exceeds the pre-release baseline.

## Procedure

1. Stop promotion/traffic shift and record the failing deployment ID, time, request IDs, and health snapshot.
2. Promote the previous known-good production deployment `dpl_2q7BCwFTLoeevYjQDmALzzmeR36k` (commit `0427d1d`) through Vercel’s immutable rollback/promotion mechanism.
3. Do not run a database down migration; 3.2 has none.
4. If a newly added optional financial credential is implicated, remove/disable that provider configuration and redeploy without exposing its value.
5. Verify `/api/health`, admin authentication, `/api/events`, core dashboards, and one private report download.
6. Confirm accepted-event flow and that no new legitimate dead-letter family appears.
7. Open an incident record and preserve logs/artifacts; do not replay or delete dead letters during rollback.

The local pre-3.2 code point is `aec65f5`, but it is not the currently live production commit. Choose the rollback deployment by immutable Vercel ID, not by assuming local and production history are equal.
