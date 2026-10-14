# AdMob Integration

The server-only adapter is `server/api-lib/intelligence/admobRevenueAdapter.mjs`. It implements the official [`accounts.networkReport:generate`](https://developers.google.com/admob/api/v1/reference/rest/v1/accounts.networkReport/generate) endpoint with the read-only scope `https://www.googleapis.com/auth/admob.readonly` and validates only documented [report dimensions and metrics](https://developers.google.com/admob/api/v1/report-metrics-dimensions).

## Configuration

Required server environment names:

- `ADMOB_PUBLISHER_ID`
- `ADMOB_OAUTH_CLIENT_ID`
- `ADMOB_OAUTH_REFRESH_TOKEN`

Optional: `ADMOB_OAUTH_CLIENT_SECRET`, `ADMOB_CURRENCY_CODE`. Secrets must stay in the Vercel server environment, never in `VITE_*`, logs, browser responses, screenshots, or PDFs. OAuth refresh uses Google’s token endpoint and the standard [offline-access refresh flow](https://developers.google.com/identity/protocols/oauth2/web-server#offline).

## Contract

- Allowed dimensions: `DATE`, `AD_UNIT`, `APP`, `COUNTRY`, `FORMAT`, `PLATFORM`.
- Metrics: requests, matched requests, impressions, clicks, estimated earnings (micros), impression RPM, match rate, and show rate.
- Hard row bound: 10,000 (below the provider’s 100,000 report maximum).
- Network timeout: 8 seconds; cache: five minutes; response errors are sanitized.
- Mixed/unknown currency is not summed; no currency means monetary value remains unavailable.
- Provider value is `provider_reported_estimate` / `estimated_not_final`; it never populates final verified revenue.

With missing credentials, configuration is `disconnected`, no network call occurs, and the UI/PDF says unavailable rather than zero. With configured but untested credentials, state is `configured_unverified`. A successful report produces `connected_estimated`, still `active_incomplete`.

Unit tests verify disconnected behavior, token/report request construction, row/micro conversion, classification, and absence of secrets in returned objects. Production credentials were absent and no live AdMob call was made.
