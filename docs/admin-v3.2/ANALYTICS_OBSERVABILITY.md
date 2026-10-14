# Analytics Observability

3.2 exposes an authenticated operational view with:

- accepted/rejected/total/rate for 1h, 6h, and 24h;
- true source freshness based on the latest accepted `received_at`;
- observation time, data-updated time, lag, and incomplete-window state;
- latest rejection, top reason/source/event, and human-readable remediation;
- contract version and aggregation freshness;
- volume-gated rejection, outage, freshness, and authentication alerts.

Thresholds intentionally require volume: rejection warnings need at least 20 attempts, and possible-outage evaluation requires at least 100 attempts over 24 hours. Freshness alerts require at least 20 daily attempts. An informational recent-rejection diagnostic does not change health by itself.

Prometheus rules are in `observability/prometheus/analytics-alerts.yml`. The local stack loads them through `rule_files`. Metrics are still in-memory per serverless instance and reset on recycling; they are insufficient for durable production alerting without a collector/remote-write or log-derived monitor. Production has no reviewed Grafana/Loki/`METRICS_TOKEN` environment configuration, so alert delivery is **code-ready, deployment-pending**.

Recommended production implementation: collect structured Vercel logs and/or scrape metrics into a durable store, route critical alerts to the on-call channel, and retain enough data to evaluate hourly seasonality before tightening outage thresholds.
