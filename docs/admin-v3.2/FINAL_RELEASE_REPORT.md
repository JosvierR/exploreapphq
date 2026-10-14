# Final Release Report

Decision date: 2026-10-14 UTC.

## Decision: NO-GO for external production/investor launch

The 3.2 code candidate is ready for a controlled preview/canary, but the full launch standard is not met:

1. Production still runs commit `0427d1d`; neither 3.1 nor 3.2 is live.
2. Only 196 accepted / 0 rejected events have been observed after the live 3.0 contract correction; sustained 3.2 post-deploy verification is pending.
3. The current seven-day period contains 1,250 rejects and 34.43% operational rejection coverage, so investor KPIs are `under_investigation`.
4. Prometheus rules exist, but durable production collection/notification is not configured.
5. AdMob and all other financial sources are disconnected; verified revenue is unavailable.
6. Destination-event geography coverage is 50.4%, limiting tourism conclusions.

## What is approved

- Code readiness: **GO**.
- Controlled preview/canary deployment with rollback: **CONDITIONAL GO**.
- Internal synthetic/fixture PDF validation: **GO**.
- External investor distribution using production data: **NO-GO**.
- Historical replay: **NO-GO without separate production-write approval**.
- Financial provider activation: **NO-GO without credentials, provider reconciliation, and finance approval**.

## Exit criteria

Deploy the exact reviewed 3.2 commit, configure durable alert ownership, pass a ≥24-hour/≥100-attempt post-deploy gate below 1% with no legitimate rejects, reconcile selected investor periods, and separately verify any revenue provider/currency totals. Then rerun the final decision review.

## Evidence summary

- Live correction evidence: 196/0 after cutoff; latest rejection predates deployment.
- Production schema: complete, private-by-default checks pass, no migration required.
- QA: 73 tests; production build; OpenAPI/secret/migration gates; 168 PDF combinations; 28 rendered pages; 87 UI screenshots; Axe/performance pass.
- Rollback: immutable previous production deployment identified.

This assessment does not claim that code passing equals production verification. The readiness classifications in [README.md](README.md) remain the authoritative handoff.
