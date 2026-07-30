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
import {
  getAdminSystemHealth,
  getAdminSystemMetrics,
  getPublicHealth,
  type AdminHealth,
  type AdminMetricsSnapshot,
  type AdminSystemHealth,
} from "@/features/admin/observability/adminObservabilityApi";
import { configuredLabel, formatVersion, healthStatusLabel, healthTone } from "@/features/admin/observability/adminHealthFormat";
import { formatDuration, formatMetricValue, metricValue, p95Duration } from "@/features/admin/observability/adminMetricsFormat";
import { useAdminObservability } from "@/features/admin/hooks/useAdminObservability";

type LoadState = {
  publicHealth: AdminHealth | null;
  systemHealth: AdminSystemHealth | null;
  metrics: AdminMetricsSnapshot | null;
  loading: boolean;
  error: string | null;
  refreshedAt: Date | null;
};

const initialState: LoadState = {
  publicHealth: null,
  systemHealth: null,
  metrics: null,
  loading: true,
  error: null,
  refreshedAt: null,
};

export function AdminSystemPage({ adminEmail }: { adminEmail: string }) {
  const [state, setState] = useState<LoadState>(initialState);
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
  const healthCards = useMemo<Array<{ label: string; value: string; tone: AdminTone; hint: string }>>(
    () => [
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
        label: "Observability",
        value:
          checks?.loki_connectivity === "ok"
            ? "Loki connected"
            : config?.loki_ready
              ? "Loki configured"
              : "Stdout logs",
        tone:
          checks?.loki_connectivity === "ok"
            ? "green"
            : checks?.loki_connectivity === "warning"
              ? "amber"
              : config?.loki_ready
                ? "green"
                : "amber",
        hint: config?.grafana_logs_enabled
          ? `Grafana logs · level ${config?.grafana_logs_level || "default"}`
          : "Set GRAFANA_LOGS_ENABLED=true in Vercel",
      },
      {
        label: "Metrics",
        value: "In memory",
        tone: "purple",
        hint: config?.metrics_token_configured ? "Token configured · /api/metrics" : "Admin-only · /api/admin/system/metrics",
      },
      {
        label: "Last refreshed",
        value: state.refreshedAt ? formatTime(state.refreshedAt) : "Not refreshed",
        tone: "slate",
        hint: requestId ? `Request ${requestId.slice(0, 8)}` : "No request id yet",
      },
    ],
    [checks, config, publicChecks, requestId, state.publicHealth?.service, state.refreshedAt, state.systemHealth?.admin.role],
  );

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">System / Observability</p>
          <h2>Production operations status</h2>
          <p>
            Safe health, request ids, internal metrics, deployment configuration, and legal/deep-link checks for Explore Admin Console.
          </p>
        </div>
        <div className="admin-page-header__actions">
          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => void load()} disabled={state.loading}>
            {state.loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {state.error && <ErrorState title="System health unavailable" message={state.error} onRetry={() => void load()} />}

      <section className="admin-stats-grid admin-stats-grid--ops">
        {healthCards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} tone={card.tone} hint={card.hint} loading={state.loading} />
        ))}
      </section>

      {requestId && (
        <AdminNotice
          title="Request tracing"
          message="Every API response includes x-request-id. Use the request id below to correlate UI errors with server logs."
          tone="blue"
        />
      )}

      <div className="admin-dashboard-layout">
        <section className="admin-panel admin-panel--span-2">
          <SectionHeader kicker="Health checks" title="API, Supabase, and data tables" meta={requestId ? <CopyButton value={requestId} label="Copy request id" /> : null} />
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
              <div>
                <dt>Request ID</dt>
                <dd>{requestId || "Not available"}</dd>
              </div>
            </dl>
          ) : (
            <EmptyState title="Admin health unavailable" message="Sign in as an admin and retry the system health check." />
          )}
        </section>

        <section className="admin-panel">
          <SectionHeader kicker="Deployment" title="Environment" />
          <dl className="admin-system-grid admin-system-grid--single">
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
          </dl>
        </section>

        <section className="admin-panel">
          <SectionHeader kicker="Internal metrics" title="Current instance snapshot" meta={metrics?.generated_at ? formatTime(new Date(metrics.generated_at)) : undefined} />
          <div className="admin-mini-metrics">
            <MiniMetric label="API requests" value={formatMetricValue(metricValue(metrics, "explore_api_requests_total"))} />
            <MiniMetric label="API errors" value={formatMetricValue(metricValue(metrics, "explore_api_errors_total"))} />
            <MiniMetric label="Auth failures" value={formatMetricValue(metricValue(metrics, "explore_auth_failures_total"))} />
            <MiniMetric label="Admin actions" value={formatMetricValue(metricValue(metrics, "explore_admin_actions_total"))} />
            <MiniMetric label="Moderation actions" value={formatMetricValue(metricValue(metrics, "explore_moderation_actions_total"))} />
            <MiniMetric label="P95 duration" value={formatDuration(p95Duration(metrics))} />
          </div>
          <p className="admin-muted">Metrics are per serverless instance and reset when an instance is recycled.</p>
        </section>

        <section className="admin-panel">
          <SectionHeader kicker="Configuration" title="Safe flags only" />
          <dl className="admin-system-grid admin-system-grid--single">
            <ConfigRow label="Supabase URL" value={config?.supabase_url_configured ?? publicChecks?.supabase_url_configured} />
            <ConfigRow label="Supabase service key" value={config?.supabase_service_configured ?? publicChecks?.supabase_service_configured} />
            <ConfigRow label="Metrics token" value={config?.metrics_token_configured} />
            <ConfigRow label="Loki enabled" value={config?.loki_enabled} />
            <ConfigRow label="Loki URL" value={config?.loki_url_configured} />
            <ConfigRow label="Loki token" value={config?.loki_token_configured} />
          </dl>
        </section>

        <section className="admin-panel admin-panel--span-2">
          <SectionHeader kicker="Links" title="Operational, legal, and deep-link checks" />
          <div className="admin-domain-links admin-domain-links--grid" aria-label="System links">
            <a href={`${SITE.url}/api/health`} target="_blank" rel="noreferrer">Public health endpoint</a>
            <a href="/api/admin/system/health" target="_blank" rel="noreferrer">Admin system health</a>
            <a href="/api/admin/system/metrics" target="_blank" rel="noreferrer">Admin metrics</a>
            <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
            <a href="/terms" target="_blank" rel="noreferrer">Terms</a>
            <a href="/safety" target="_blank" rel="noreferrer">Safety</a>
            <a href="/.well-known/apple-app-site-association" target="_blank" rel="noreferrer">Apple association</a>
            <a href="/.well-known/assetlinks.json" target="_blank" rel="noreferrer">Android association</a>
          </div>
          <div className="admin-doc-list" aria-label="Documentation files">
            <code>docs/ADMIN_PLATFORM.md</code>
            <code>docs/OBSERVABILITY.md</code>
            <code>docs/GRAFANA_DASHBOARD.md</code>
            <code>docs/SECURITY_ADMIN_WEB.md</code>
          </div>
        </section>

        <section className="admin-panel">
          <SectionHeader kicker="Warnings" title="Latest safe warnings" />
          {state.systemHealth?.warnings.length ? (
            <ul className="admin-warning-list">
              {state.systemHealth.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          ) : (
            <EmptyState title="No warnings" message="The latest system health check did not report safe warnings." />
          )}
        </section>
      </div>
    </>
  );
}

function HealthRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd><StatusBadge label={healthStatusLabel(value)} tone={healthTone(value)} /></dd>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd><StatusBadge label={configuredLabel(value)} tone={value ? "green" : value === false ? "amber" : "slate"} /></dd>
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
