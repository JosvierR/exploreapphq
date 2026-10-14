import { investorMetricCatalogForClient } from "./investorMetricCatalog.mjs";

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

export function buildRevenueIntelligence(dashboard, env = process.env) {
  const streams = STREAMS.map((stream) => {
    const configuredProviders = stream.providers.filter((provider) => providerConfigured(provider, env));
    const configured = configuredProviders.length > 0;
    return {
      id: stream.id,
      label: stream.label,
      maturity: configured ? "active_incomplete" : stream.maturityWhenMissing,
      verified_value: null,
      currency: null,
      availability: "unavailable",
      status_message: configured
        ? "A credential appears configured, but recognized revenue has not been reconciled into the canonical reporting contract."
        : "No verified financial source is connected.",
      integration_requirement: stream.requirement,
    };
  });

  const verified = streams.filter((stream) => stream.availability === "available");
  return {
    core_version: "revenue-intelligence-v1",
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
