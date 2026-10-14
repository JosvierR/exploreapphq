# Revenue Integrations

Revenue core version: `revenue-intelligence-v2`. The dashboard now distinguishes connection status, maturity, verified value, provider estimate, currency, and integration requirements. Null is rendered as **Unavailable**, never `$0`.

| Stream | Current status | Required source contract | Revenue treatment |
|---|---|---|---|
| Advertising | Disconnected | AdMob read-only OAuth, publisher account, currency | Estimated earnings only until financial reconciliation |
| Subscriptions | Integration pending | RevenueCat or Stripe events, products, renewals, refunds, taxes, fees, FX | Net/recognized policy must be approved before reporting |
| Promoted content | Planned | Contract + booked/delivered/invoiced/paid states and campaign delivery | Recognize only under an approved accounting event |
| Tickets & partners | Planned | Orders, refunds, commission, fees, settlement currency, payout ID | Reconcile settlement to orders before aggregation |
| Business intelligence | Planned | Billable product, entitlement, invoice/subscription source | No value until product and billing contract exist |

Commercial actions are kept as intent signals and explicitly excluded from sales/revenue. Tourism demand, opportunity, and partner readiness can support product prioritization, but they are not monetization outcomes.

Recommended sequence: connect read-only provider data; validate account/currency/date boundaries; reconcile provider totals to a controlled statement; define refund/tax/fee/FX policy; obtain finance approval; then permit an `active_measured` stream. The implementation deliberately stops at `active_incomplete` for AdMob estimates.
