# Revenue Data Availability

Audit date: 2026-10-13. Scope: repository integrations and configured environment-variable names; secret values were never printed.

## Current conclusion

There is no verified revenue integration in the reviewed environment. The primary revenue KPI is therefore `null` with an explicit unavailable state. Commercial actions are available as intent observations but never relabeled as transactions, pipeline, or revenue.

| Stream | Current maturity | Verified value | Evidence reviewed | Exact requirement to advance |
| --- | --- | --- | --- | --- |
| AdMob / advertising | Integration pending | Unavailable | No AdMob or Google Ad Manager reporting adapter or credential name | Authorized reporting credential, account/property scope, currency, timezone, invalid-traffic handling, and reconciliation rule |
| Subscriptions | Integration pending | Unavailable | No RevenueCat/Stripe billing adapter or credential name | Read-only source, product mapping, recognized-revenue rule, refunds, chargebacks, taxes, fees, currency conversion, and reconciliation |
| Promoted content | Planned | Unavailable | Product intent exists; no contract/delivery/invoice ledger | Promotion ledger with booked, delivered, invoiced, paid, refunded, currency, customer, and campaign identifiers |
| Tickets & partners | Planned | Unavailable | No order or partner settlement integration | Orders, cancellations/refunds, gross amount, Explore fee, net settlement, currency, partner, and payout identifiers |
| Business intelligence | Planned | Unavailable | Analytics product exists; no billing source | Billable plan/SKU definition plus invoice or subscription source and recognition policy |

## Pipeline and opportunity boundary

- No CRM, booking ledger, contract ledger, invoice system, or billing source was found, so a “verified pipeline” value cannot be reported.
- Existing opportunity scores are product/demand signals, not monetary pipeline.
- The optional monetary scenario builder was intentionally not shipped because there is no approved baseline for price, fill rate, take rate, churn, or conversion. Shipping it would invite speculative values to be mistaken for actuals.
- Once assumptions are approved, any future scenario output must be isolated and labeled **“Scenario — not actual revenue or guaranteed forecast.”**

## Adapter rules

Future adapters must be server-only, read-only where the provider supports it, scoped to the minimum account/property, and must return normalized value, currency, source period, source as-of, reconciliation status, refunds/adjustments, and lineage. Credential presence alone produces `active_incomplete`; it never makes a value verified.
