# Backend Performance

## Reviewed path

The business intelligence service previously waited for independent current/comparison reads and enrichment calls in sequence. 3.3 starts current/comparison, ingestion-quality, and rejection-coverage work together, then resolves place, route, and category enrichment in parallel. Snapshot construction remains deterministic and side-effect-free.

The change removes avoidable serial wait time without changing SQL, security context, suppression rules, or canonical formulas. Report requests still create one coherent snapshot before rendering; no mid-report live queries can mix cutoffs.

## Production-safe evidence

Only bounded read-only audits were run. The current seven-day reconciliation read 2,357 normalized rows and 2,357 raw accepted rows, below the reviewed 100,000-row bound. Raw/normalized canonical invariants matched. Production was not load-tested and no cache was warmed deliberately.

Database readiness verification passed for required relations, indexes, functions, foreign keys, RLS, service-role grants, anonymous/authenticated denials, taxonomy seed, and business configuration. Aggregation reports zero failures and the latest observed run succeeded.

## Remaining risks

- The 34.38% rejection proxy is a producer/data-coverage problem, not evidence of query slowness, but it limits analytical trust.
- Large ranges are bounded in reconciliation scripts; interactive endpoint latency should be monitored with production observability after a controlled deployment.
- No new cross-request cache was added because snapshot freshness and authorization are more important than speculative caching at current volume.

Result: code-path efficiency improved by removing serial I/O, with no production load claim. A post-deploy canary should record endpoint p50/p95 and database time before increasing traffic.
