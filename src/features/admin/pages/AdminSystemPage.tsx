import { useCallback, useEffect, useMemo, useState } from "react";
import { SITE } from "@/lib/constants";
import {
  AdminNotice,
  CopyButton,
  EmptyState,
  ErrorState,
  SectionHeader,
  StatCard,
  StatusBadge,
  LoadingState,
  type AdminTone,
} from "@/features/admin/components/AdminPrimitives";
import { ChartCard } from "@/features/admin/components/charts/ChartCard";
import { DonutBreakdownChart } from "@/features/admin/components/charts/DonutBreakdownChart";
import { HorizontalBarChart } from "@/features/admin/components/charts/HorizontalBarChart";
import { chartColors } from "@/features/admin/components/charts/chartTheme";
import {
  getAdminSystemHealth,
  getAdminSystemMetrics,
  getPublicHealth,
  type AdminHealth,
  type AdminMetricsSnapshot,
  type AdminSystemHealth,
} from "@/features/admin/observability/adminObservabilityApi";
import { configuredLabel, formatVersion, healthStatusLabel, healthTone } from "@/features/admin/observability/adminHealthFormat";
import {
  counterBreakdownByLabel,
  errorRatePercent,
  formatDuration,
  formatMetricValue,
  formatPercent,
  metricValue,
  p95Duration,
  topNamedCounters,
} from "@/features/admin/observability/adminMetricsFormat";
import { useAdminObservability } from "@/features/admin/hooks/useAdminObservability";

type LoadState = {
  publicHealth: AdminHealth | null;
  systemHealth: AdminSystemHealth | null;
  metrics: AdminMetricsSnapshot | null;
  loading: boolean;
  error: string | null;
  refreshedAt: Date | null;
};

type PayloadKind = "health" | "metrics" | null;

const initialState: LoadState = {
  publicHealth: null,
  systemHealth: null,
  metrics: null,
  loading: true,
  error: null,
  refreshedAt: null,
};

const CORE_METRIC_NAMES = [
  "explore_api_requests_total",
  "explore_api_errors_total",
  "explore_auth_failures_total",
  "explore_admin_actions_total",
  "explore_moderation_actions_total",
  "explore_health_check_total",
] as const;

export function AdminSystemPage({ adminEmail }: { adminEmail: string }) {
  const [state, setState] = useState<LoadState>(initialState);
  const [payloadKind, setPayloadKind] = useState<PayloadKind>(null);
  const observability = useAdminObservability();

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    const [publicResult, healthResult, metricsResult] = await Promise.allSettled([
      getPublicHealth(),
      getAdminSystemHealth(),
      getAdminSystemMetrics(),
    ]);

    const publicHealth = publicResult.status === "fulfilled" ? publicResult.value : null;
    const systemHealth = healthResult.status === "fulfilled" ? healthResult.value : null;
    const metrics = metricsResult.status === "fulfilled" ? metricsResult.value : null;
    const error =
      publicResult.status === "rejected" && healthResult.status === "rejected"
        ? "Unable to load system health. Check API routing and admin authorization."
        : null;

    if (error || healthResult.status === "rejected" || metricsResult.status === "rejected") {
      observability.report("health_check_failed", {
        route: "/api/admin/system/health",
        section: "system",
      });
    }

    setState({
      publicHealth,
      systemHealth,
      metrics,
      loading: false,
      error,
      refreshedAt: new Date(),
    });
  }, [observability]);

  useEffect(() => {
    void load();
  }, [load]);

  const requestId = state.systemHealth?.request_id || state.publicHealth?.request_id || state.metrics?.request_id || "";
  const config = state.systemHealth?.config;
  const checks = state.systemHealth?.checks;
  const publicChecks = state.publicHealth?.checks;
  const metrics = state.metrics;

  const overall = useMemo(() => deriveOverallStatus(checks, config), [checks, config]);

  const requestByRoute = useMemo(
    () => counterBreakdownByLabel(metrics, "explore_api_requests_total", "route"),
    [metrics],
  );
  const errorsByRoute = useMemo(
    () => counterBreakdownByLabel(metrics, "explore_api_errors_total", "route"),
    [metrics],
  );
  const authFailuresByReason = useMemo(
    () =>
      counterBreakdownByLabel(metrics, "explore_auth_failures_total", "reason").length
        ? counterBreakdownByLabel(metrics, "explore_auth_failures_total", "reason")
        : counterBreakdownByLabel(metrics, "explore_auth_failures_total", "route"),
    [metrics],
  );
  const coreBars = useMemo(() => topNamedCounters(metrics, [...CORE_METRIC_NAMES]), [metrics]);
  const errorRate = errorRatePercent(metrics);

  const missingLokiEnvs = useMemo(() => {
    const missing: string[] = [];
    if (!config?.loki_enabled) missing.push("GRAFANA_LOGS_ENABLED");
    if (!config?.loki_url_configured) missing.push("GRAFANA_LOKI_URL");
    if (!config?.loki_token_configured) missing.push("GRAFANA_LOKI_TOKEN");
    return missing;
  }, [config]);

  const payloadJson = useMemo(() => {
    if (payloadKind === "health") {
      return JSON.stringify(
        {
          public: state.publicHealth,
          admin: state.systemHealth,
        },
        null,
        2,
      );
    }
    if (payloadKind === "metrics") {
      return JSON.stringify(state.metrics, null, 2);
    }
    return "";
  }, [payloadKind, state.metrics, state.publicHealth, state.systemHealth]);

  const healthCards = useMemo<Array<{ label: string; value: string; tone: AdminTone; hint: string }>>(
    () => [
      {
        label: "Overall",
        value: overall.label,
        tone: overall.tone,
        hint: overall.hint,
      },
      {
        label: "API status",
        value: healthStatusLabel(checks?.api || publicChecks?.api),
        tone: healthTone(checks?.api || publicChecks?.api),
        hint: state.publicHealth?.service || "explore-web-admin",
      },
      {
        label: "Supabase",
        value: healthStatusLabel(checks?.supabase_connection),
        tone: healthTone(checks?.supabase_connection),
        hint: configuredLabel(config?.supabase_service_configured ?? publicChecks?.supabase_service_configured),
      },
      {
        label: "Admin auth",
        value: healthStatusLabel(checks?.admin_auth),
        tone: healthTone(checks?.admin_auth),
        hint: state.systemHealth?.admin.role || "Requires admin",
      },
      {
        label: "Loki / Grafana",
        value:
          checks?.loki_connectivity === "ok"
            ? "Connected"
            : checks?.loki_connectivity === "skipped"
              ? "Skipped"
              : config?.loki_ready
                ? "Configured"
                : "Stdout only",
        tone:
          checks?.loki_connectivity === "ok"
            ? "green"
            : checks?.loki_connectivity === "warning"
              ? "amber"
              : config?.loki_ready
                ? "green"
                : "amber",
        hint: config?.grafana_logs_enabled
          ? `External Grafana Cloud · level ${config?.grafana_logs_level || "default"}`
          : "Not embedded here · set GRAFANA_* in Vercel",
      },
      {
        label: "Last refreshed",
        value: state.refreshedAt ? formatTime(state.refreshedAt) : "Not refreshed",
        tone: "slate",
        hint: requestId ? `Request ${requestId.slice(0, 8)}` : "No request id yet",
      },
    ],
    [
      checks,
      config,
      overall,
      publicChecks,
      requestId,
      state.publicHealth?.service,
      state.refreshedAt,
      state.systemHealth?.admin.role,
    ],
  );

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">System / Observability</p>
          <h2>Operations, security, and log readiness</h2>
          <p>
            In-app health and ephemeral runtime metrics for this Vercel instance. Grafana/Loki dashboards live outside Explore
            (Grafana Cloud or local Docker) — this page shows readiness and security signals, not an embedded Grafana UI.
          </p>
        </div>
        <div className="admin-page-header__actions">
          {requestId ? <CopyButton value={requestId} label="Copy request id" /> : null}
          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => void load()} disabled={state.loading}>
            {state.loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {state.error && <ErrorState title="System health unavailable" message={state.error} onRetry={() => void load()} />}

      <section className="admin-stats-grid admin-stats-grid--ops" aria-label="Observability overview">
        {healthCards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} tone={card.tone} hint={card.hint} loading={state.loading} />
        ))}
      </section>

      {requestId && (
        <AdminNotice
          title="Request tracing"
          message="Every API response includes x-request-id. Copy it from this page to correlate UI issues with Vercel/Loki logs. Opening /api/admin/system/* in a new browser tab will show Authentication required because the browser does not send your admin bearer token."
          tone="blue"
        />
      )}

      <div className="admin-dashboard-layout">
        <section className="admin-panel admin-panel--span-2">
          <SectionHeader kicker="A · Overview" title="Deployment identity" />
          <dl className="admin-system-grid admin-system-grid--dense">
            <div>
              <dt>Environment</dt>
              <dd>{state.systemHealth?.environment || state.publicHealth?.environment || "Not available"}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{formatVersion(state.systemHealth?.version || state.publicHealth?.version)}</dd>
            </div>
            <div>
              <dt>Server time</dt>
              <dd>{state.systemHealth?.timestamp || state.publicHealth?.timestamp || "Not available"}</dd>
            </div>
            <div>
              <dt>Current admin</dt>
              <dd>{state.systemHealth?.admin.email || adminEmail}</dd>
            </div>
            <div>
              <dt>Admin role</dt>
              <dd>{state.systemHealth?.admin.role || "Not available"}</dd>
            </div>
            <div>
              <dt>Health duration</dt>
              <dd>{state.systemHealth ? `${state.systemHealth.duration_ms} ms` : "Not available"}</dd>
            </div>
          </dl>
        </section>

        <section className="admin-panel admin-panel--span-2">
          <SectionHeader kicker="B · Service health" title="API, auth, Supabase, and tables" />
          {state.loading ? (
            <LoadingState rows={5} />
          ) : state.systemHealth ? (
            <dl className="admin-system-grid admin-system-grid--dense">
              <HealthRow label="Public API" value={state.publicHealth?.ok ? "ok" : "warning"} />
              <HealthRow label="Admin auth" value={checks?.admin_auth} />
              <HealthRow label="Supabase connection" value={checks?.supabase_connection} />
              <HealthRow label="Reports table" value={checks?.reports_table} />
              <HealthRow label="Videos table" value={checks?.videos_table} />
              <HealthRow label="Places table" value={checks?.places_table} />
              <HealthRow label="Moderation actions table" value={checks?.moderation_actions_table} />
              <HealthRow label="Loki connectivity" value={checks?.loki_connectivity || (config?.loki_ready ? "configured" : "skipped")} />
              <HealthRow label="Metrics store" value={checks?.metrics || "in_memory"} />
            </dl>
          ) : (
            <EmptyState title="Admin health unavailable" message="Sign in as an admin and retry the system health check." />
          )}
        </section>

        <section className="admin-panel admin-panel--span-2">
          <SectionHeader
            kicker="C · Runtime metrics"
            title="Current serverless instance"
            meta={metrics?.generated_at ? formatTime(new Date(metrics.generated_at)) : undefined}
          />
          <div className="admin-mini-metrics">
            <MiniMetric label="API requests" value={formatMetricValue(metricValue(metrics, "explore_api_requests_total"))} />
            <MiniMetric label="API errors" value={formatMetricValue(metricValue(metrics, "explore_api_errors_total"))} />
            <MiniMetric label="Error rate" value={formatPercent(errorRate)} />
            <MiniMetric label="Auth failures" value={formatMetricValue(metricValue(metrics, "explore_auth_failures_total"))} />
            <MiniMetric label="Admin actions" value={formatMetricValue(metricValue(metrics, "explore_admin_actions_total"))} />
            <MiniMetric label="Moderation actions" value={formatMetricValue(metricValue(metrics, "explore_moderation_actions_total"))} />
            <MiniMetric label="P95 duration" value={formatDuration(p95Duration(metrics))} />
          </div>
          <p className="admin-muted">
            {metrics?.note ||
              "Metrics are in-memory per Vercel serverless instance and reset when an instance is recycled. They are not a durable analytics warehouse."}
          </p>

          <div className="admin-obs-charts">
            <ChartCard
              title="Core counters"
              subtitle="Totals on this instance"
              loading={state.loading}
              empty={coreBars.every((row) => row.value === 0)}
              emptyTitle="No counters yet"
              emptyMessage="Counters appear after API traffic hits this instance."
            >
              <HorizontalBarChart data={coreBars} valueLabel="Count" ariaLabel="Core observability counters" color={chartColors.primary} />
            </ChartCard>

            <ChartCard
              title="Requests by route"
              subtitle="Top routes from labeled counters"
              loading={state.loading}
              empty={requestByRoute.length === 0}
              emptyTitle="No route labels"
              emptyMessage="Route breakdowns appear when request counters include a route label."
            >
              <HorizontalBarChart
                data={requestByRoute}
                valueLabel="Requests"
                ariaLabel="API requests by route"
                color={chartColors.secondary}
              />
            </ChartCard>

            <ChartCard
              title="Errors by route"
              subtitle="Where failures concentrate"
              loading={state.loading}
              empty={errorsByRoute.length === 0}
              emptyTitle="No error labels"
              emptyMessage="Error route breakdowns appear when error counters include labels."
            >
              <DonutBreakdownChart data={errorsByRoute} valueLabel="Errors" ariaLabel="API errors by route" />
            </ChartCard>

            <ChartCard
              title="Auth failures"
              subtitle="Security-related auth counters"
              loading={state.loading}
              empty={authFailuresByReason.length === 0}
              emptyTitle="No auth failures recorded"
              emptyMessage="Auth failure breakdowns appear when explore_auth_failures_total has labels."
            >
              <HorizontalBarChart
                data={authFailuresByReason}
                valueLabel="Failures"
                ariaLabel="Auth failures breakdown"
                color={chartColors.warning}
              />
            </ChartCard>
          </div>
        </section>

        <section className="admin-panel">
          <SectionHeader kicker="D · Security signals" title="Abuse and readiness" />
          <dl className="admin-system-grid admin-system-grid--single">
            <div>
              <dt>Auth failures (instance)</dt>
              <dd>{formatMetricValue(metricValue(metrics, "explore_auth_failures_total"))}</dd>
            </div>
            <div>
              <dt>API errors (instance)</dt>
              <dd>{formatMetricValue(metricValue(metrics, "explore_api_errors_total"))}</dd>
            </div>
            <div>
              <dt>Error rate</dt>
              <dd>{formatPercent(errorRate)}</dd>
            </div>
            <ConfigRow label="Supabase service role" value={config?.supabase_service_configured ?? publicChecks?.supabase_service_configured} />
            <ConfigRow label="Metrics scrape token" value={config?.metrics_token_configured} />
            <ConfigRow label="Loki push enabled" value={config?.loki_enabled} />
            <ConfigRow label="Loki URL configured" value={config?.loki_url_configured} />
            <ConfigRow label="Loki token configured" value={config?.loki_token_configured} />
          </dl>
          <p className="admin-muted">
            Correlate incidents with the request id above. Raw `/api/admin/*` endpoints stay bearer-protected on purpose.
          </p>
        </section>

        <section className="admin-panel">
          <SectionHeader kicker="E · Integrations" title="Admin UI vs Grafana / Loki" />
          <div className="admin-obs-integrations">
            <article>
              <h3>In-app (this page)</h3>
              <p>Health checks, warnings, and ephemeral Prometheus-style counters for the current instance.</p>
              <code>/admin?section=system</code>
            </article>
            <article>
              <h3>Local OSS stack</h3>
              <p>Grafana + Prometheus + Loki via Docker for development.</p>
              <code>npm run obs:ready</code>
              <p className="admin-muted">Grafana: http://localhost:3002 (admin/admin)</p>
            </article>
            <article>
              <h3>Production Grafana Cloud</h3>
              <p>External log destination. Explore does not host Grafana at exploreapphq.com.</p>
              {missingLokiEnvs.length ? (
                <p>
                  Missing Vercel env names: <code>{missingLokiEnvs.join(", ")}</code>
                  {config && !config.loki_username_configured ? (
                    <>
                      {" "}
                      (also set <code>GRAFANA_LOKI_USERNAME</code> for Grafana Cloud basic auth)
                    </>
                  ) : null}
                </p>
              ) : (
                <p>Loki env flags look configured. Probe: {checks?.loki_connectivity || "unknown"}.</p>
              )}
            </article>
          </div>
          <div className="admin-doc-list" aria-label="Documentation files">
            <code>docs/OBSERVABILITY.md</code>
            <code>docs/GRAFANA_DASHBOARD.md</code>
            <code>docs/SECURITY_ADMIN_WEB.md</code>
          </div>
        </section>

        <section className="admin-panel">
          <SectionHeader kicker="Warnings" title="Latest safe warnings" />
          {state.systemHealth?.warnings.length ? (
            <ul className="admin-warning-list">
              {state.systemHealth.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No warnings" message="The latest system health check did not report safe warnings." />
          )}
        </section>

        <section className="admin-panel admin-panel--span-2">
          <SectionHeader kicker="Authenticated payloads" title="Inspect JSON without a new tab" />
          <p className="admin-muted">
            These drawers use your admin session fetch. Opening the raw URLs in a normal browser tab will always return
            Authentication required.
          </p>
          <div className="admin-obs-payload-actions">
            <button
              type="button"
              className={`admin-btn admin-btn--sm ${payloadKind === "health" ? "admin-btn--secondary" : "admin-btn--ghost"}`}
              onClick={() => setPayloadKind((current) => (current === "health" ? null : "health"))}
            >
              {payloadKind === "health" ? "Hide health JSON" : "Show health JSON"}
            </button>
            <button
              type="button"
              className={`admin-btn admin-btn--sm ${payloadKind === "metrics" ? "admin-btn--secondary" : "admin-btn--ghost"}`}
              onClick={() => setPayloadKind((current) => (current === "metrics" ? null : "metrics"))}
            >
              {payloadKind === "metrics" ? "Hide metrics JSON" : "Show metrics JSON"}
            </button>
            {payloadJson ? <CopyButton value={payloadJson} label="Copy JSON" /> : null}
          </div>
          {payloadKind && (
            <pre className="admin-obs-json" tabIndex={0}>
              {payloadJson || "Payload not loaded yet. Refresh and try again."}
            </pre>
          )}
        </section>

        <section className="admin-panel admin-panel--span-2">
          <SectionHeader kicker="F · Public checks" title="Legal and deep-link association files" />
          <div className="admin-domain-links admin-domain-links--grid" aria-label="System links">
            <a href={`${SITE.url}/api/health`} target="_blank" rel="noreferrer">
              Public health endpoint
            </a>
            <a href="/privacy" target="_blank" rel="noreferrer">
              Privacy Policy
            </a>
            <a href="/terms" target="_blank" rel="noreferrer">
              Terms
            </a>
            <a href="/safety" target="_blank" rel="noreferrer">
              Safety
            </a>
            <a href="/.well-known/apple-app-site-association" target="_blank" rel="noreferrer">
              Apple association
            </a>
            <a href="/.well-known/assetlinks.json" target="_blank" rel="noreferrer">
              Android association
            </a>
          </div>
        </section>
      </div>
    </>
  );
}

function deriveOverallStatus(
  checks: AdminSystemHealth["checks"] | undefined,
  config: AdminSystemHealth["config"] | undefined,
): { label: string; tone: AdminTone; hint: string } {
  if (!checks) {
    return { label: "Unknown", tone: "slate", hint: "Load system health to evaluate" };
  }
  const criticalKeys = ["api", "admin_auth", "supabase_connection"] as const;
  const tableKeys = ["reports_table", "videos_table", "places_table", "moderation_actions_table"] as const;
  const criticalBad = criticalKeys.some((key) => {
    const value = String(checks[key] || "");
    return value && value !== "ok";
  });
  const tablesBad = tableKeys.some((key) => {
    const value = String(checks[key] || "");
    return value && value !== "ok";
  });
  const lokiWarn =
    checks.loki_connectivity === "warning" ||
    (!config?.loki_ready && Boolean(config?.grafana_logs_enabled === false || config?.loki_enabled === false));

  if (criticalBad) {
    return { label: "Critical", tone: "red", hint: "Core API/auth/Supabase needs attention" };
  }
  if (tablesBad || lokiWarn || checks.loki_connectivity === "skipped") {
    return {
      label: "Degraded",
      tone: "amber",
      hint: tablesBad ? "One or more data tables unhealthy" : "Core OK · observability incomplete",
    };
  }
  return { label: "Healthy", tone: "green", hint: "Core services responding" };
}

function HealthRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <StatusBadge label={healthStatusLabel(value)} tone={healthTone(value)} />
      </dd>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <StatusBadge label={configuredLabel(value)} tone={value ? "green" : value === false ? "amber" : "slate"} />
      </dd>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="admin-mini-metric">
      <strong>{value}</strong>
      <em>{label}</em>
    </span>
  );
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}
