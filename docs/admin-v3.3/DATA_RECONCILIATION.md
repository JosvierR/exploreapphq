# Data Reconciliation

Audit generated 2026-10-14 UTC from `analytics_normalized_events`, `analytics_events`, and dead-letter counts. Exact evidence is in `benchmarks/production-executive-reconciliation.json` and `production-ingestion-audit.json`.

## Seven-day snapshot

| Metric | Current | Previous | Absolute | Percent | Reliable comparison |
| --- | ---: | ---: | ---: | ---: | --- |
| Active identities | 58 | 40 | +18 | +45.0% | yes |
| Sessions | 106 | 102 | +4 | +3.9% | yes |
| Place views | 34 | 8 | +26 | +325.0% | yes, normalized source |
| Route views | 14 | 12 | +2 | +16.7% | yes, normalized source |
| Route starts | 10 | 2 | +8 | +400.0% | no; small baseline |
| Route completions | 1 | 0 | +1 | unavailable | no |
| Commercial actions | 1 | 2 | -1 | -50.0% | no; small sample |
| Searches | 18 | 24 | -6 | -25.0% | yes |

Accepted normalized rows equal accepted raw rows at 2,357. All invariant metrics—active identities, sessions, starts, completions, saves, shares, commercial actions, searches, and total events—match the raw source.

Place/route views differ by design: the canonical reporting layer resolves entity semantics and found 34 place views, 8 unique place viewers, and 14 route views that the raw-name-only formula cannot safely infer. This is recorded as a normalization difference, not a mismatch.

## Coverage

The same window contains 1,235 rejected rows from 3,592 observed accepted-plus-rejected attempts, yielding a 34.38% operational proxy. Cumulative counts are 29,953 accepted and 9,285 rejected. Major rejection classes are invalid entity type (6,493 cumulative) and event not allowlisted (2,792). Repeated event IDs exist in dead letters, so the proxy must not be interpreted as unique client failures.

## Revenue

No authorized reconciled money source is connected. No currency total was displayed or reconciled. Commercial action counts remain separate and do not support revenue recognition.
