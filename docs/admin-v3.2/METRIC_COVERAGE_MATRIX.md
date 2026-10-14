# Metric Coverage Matrix

Confidence version: `metric-confidence-v2`. Report catalog: `investor-metrics-v2`.

| Metric group | Canonical source | Current production confidence | Reason |
|---|---|---|---|
| Active users / sessions | Normalized events, identity fallback | Under investigation | Historical rejection coverage affects the period |
| Place/route activity | Normalized event/entity resolution | Under investigation | Internally reconciled; incomplete historical producer coverage |
| Funnel/commercial actions | Canonical taxonomy | Under investigation | Very small sample plus affected window; intent only |
| Demand index | Business Analytics Core v2 | Partial/under investigation | Depends on reliable components and minimum samples |
| Destination geography | Enriched dimensions | Partial | 50.4% destination-event geo coverage |
| Ad revenue | Authorized AdMob reporting adapter | Unavailable | Credentials absent; adapter not production-verified |
| Subscription revenue | RevenueCat/Stripe + recognition policy | Unavailable | No provider connected |
| Promotions | Contract delivery/invoice/payment ledger | Unavailable/planned | No ledger exists |
| Tickets/partners | Settlement/order/refund integration | Unavailable/planned | No source exists |
| BI revenue | Invoice/subscription source | Unavailable/planned | Product and billing contract undefined |

Statuses are `verified`, `partial`, `delayed`, `unavailable`, and `under_investigation`. Every exported headline carries a per-metric status/reason/source. Revenue unavailability does not force behavioral metrics to zero and never converts commercial intent into revenue.
