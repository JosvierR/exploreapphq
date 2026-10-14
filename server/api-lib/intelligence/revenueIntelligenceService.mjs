import { investorMetricCatalogForClient } from "./investorMetricCatalog.mjs";
import { admobConfigurationStatus, createAdMobRevenueAdapter } from "./admobRevenueAdapter.mjs";

const STREAMS = [
  {
    id: "advertising",
    label: "Advertising",
    providers: ["ADMOB", "GOOGLE_AD_MANAGER"],
    maturityWhenMissing: "integration_pending",
    requirement: "Connect an authorized AdMob or Google Ad Manager reporting credential with account and currency scope.",
  },
  {
    id: "subscriptions",
    label: "Subscriptions",
    providers: ["REVENUECAT", "STRIPE"],
    maturityWhenMissing: "integration_pending",
    requirement: "Connect an authorized RevenueCat or Stripe source and define recognized-revenue and refund handling.",
  },
  {
    id: "promoted_content",
    label: "Promoted content",
    providers: ["PROMOTIONS_LEDGER"],
    maturityWhenMissing: "planned",
    requirement: "Implement a promotion contract ledger with booked, delivered, invoiced, and paid states.",
  },
  {
    id: "tickets_partners",
    label: "Tickets & partners",
    providers: ["PARTNER_REVENUE"],
    maturityWhenMissing: "planned",
    requirement: "Connect partner settlement data with order, refund, fee, currency, and payout identifiers.",
  },
  {
    id: "business_intelligence",
    label: "Business intelligence",
    providers: ["BI_BILLING"],
    maturityWhenMissing: "planned",
    requirement: "Define billable products and connect an invoice or subscription source before reporting value.",
  },
];

function providerConfigured(provider, env) {
  const suffixes = ["API_KEY", "SECRET_KEY", "CREDENTIALS", "ACCOUNT_ID"];
  return suffixes.some((suffix) => String(env[`${provider}_${suffix}`] || "").trim().length > 0);
}

function streamProviderStatus(stream, env) {
  if (stream.id === "advertising") return [admobConfigurationStatus(env)];
  return stream.providers.map((provider) => ({
    provider: provider.toLowerCase(),
    status: providerConfigured(provider, env) ? "configured_unverified" : "disconnected",
    configured: providerConfigured(provider, env),
  }));
}

export function buildRevenueIntelligence(dashboard, env = process.env) {
  const streams = STREAMS.map((stream) => {
    const providerStatus = streamProviderStatus(stream, env);
    const configuredProviders = providerStatus.filter((provider) => provider.configured).map((provider) => provider.provider);
    const configured = configuredProviders.length > 0;
    return {
      id: stream.id,
      label: stream.label,
      maturity: configured ? "active_incomplete" : stream.maturityWhenMissing,
      verified_value: null,
      currency: null,
      estimated_value: null,
      value_classification: null,
      availability: "unavailable",
      connection_status: configured ? "configured_unverified" : "disconnected",
      providers: providerStatus,
      status_message: configured
        ? "A credential appears configured, but recognized revenue has not been reconciled into the canonical reporting contract."
        : "No verified financial source is connected.",
      integration_requirement: stream.requirement,
    };
  });

  const verified = streams.filter((stream) => stream.availability === "available");
  return {
    core_version: "revenue-intelligence-v2",
    data_as_of: dashboard?.data_as_of || null,
    range: dashboard?.range || null,
    state: verified.length ? "partial" : "unavailable",
    total_verified_revenue: null,
    currency: null,
    unavailable_reason: verified.length
      ? null
      : "No authorized revenue integration currently provides reconciled monetary values.",
    commercial_signals: {
      actions: dashboard?.kpis?.commercial_actions ?? dashboard?.kpis?.commercial_intent ?? null,
      label: "Commercial actions",
      disclaimer: "Observed intent only — not transactions, sales, or revenue.",
    },
    streams,
    maturity_scale: {
      active_measured: "Live, reconciled, and measured",
      active_incomplete: "Connected but not fully reconciled",
      integration_pending: "Product activity may exist; financial integration is pending",
      planned: "Planned monetization stream; no actual value is reported",
    },
    metric_catalog: investorMetricCatalogForClient(),
  };
}

export async function loadRevenueIntelligence(dashboard, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const base = buildRevenueIntelligence(dashboard, env);
  const adapter = createAdMobRevenueAdapter({ env, fetchImpl });
  if (!adapter.configuration.configured) return base;

  try {
    const result = await adapter.getNetworkRevenue({
      start: String(dashboard?.range?.start || "").slice(0, 10),
      end: String(dashboard?.range?.end || "").slice(0, 10),
      dimensions: ["DATE", "APP", "COUNTRY", "FORMAT", "PLATFORM"],
    });
    const advertising = base.streams.find((stream) => stream.id === "advertising");
    if (advertising && result.data) {
      advertising.maturity = "active_incomplete";
      advertising.connection_status = "connected_estimated";
      advertising.estimated_value = result.data.estimated_earnings;
      advertising.currency = result.data.currency;
      advertising.value_classification = result.data.classification;
      advertising.status_message = "AdMob read-only reporting is connected. Value is provider-reported estimated earnings, not final recognized revenue.";
      advertising.provider_report = {
        row_count: result.data.row_count,
        impressions: result.data.impressions,
        clicks: result.data.clicks,
        finality: result.data.finality,
        cache: result.cache,
      };
      base.state = "partial";
      base.unavailable_reason = "AdMob estimates are connected, but no stream currently supplies reconciled final recognized revenue.";
    }
  } catch (error) {
    const advertising = base.streams.find((stream) => stream.id === "advertising");
    if (advertising) {
      advertising.connection_status = "error";
      advertising.status_message = error?.message || "AdMob reporting could not be verified.";
      advertising.error_code = error?.code || "admob_request_failed";
    }
  }
  return base;
}
